#![allow(unexpected_cfgs)]

use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};

declare_id!("7hucMRtxEjUYn9hbKPsByneQmmu4Qrv7qDgaVG59ryEY");

const DAY_SECONDS: i64 = 86_400;
const MANDATE_SEED: &[u8] = b"mandate";
const VAULT_SEED: &[u8] = b"vault";

#[program]
pub mod tr_mandate {
    use super::*;

    pub fn initialize_mandate(
        ctx: Context<InitializeMandate>,
        agent: Pubkey,
        recipient: Pubkey,
        max_per_tx: u64,
        daily_limit: u64,
        expires_at: i64,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        validate_policy(agent, recipient, max_per_tx, daily_limit, expires_at, now)?;
        let mandate = &mut ctx.accounts.mandate;
        mandate.owner = ctx.accounts.owner.key();
        mandate.agent = agent;
        mandate.recipient = recipient;
        mandate.max_per_tx = max_per_tx;
        mandate.daily_limit = daily_limit;
        mandate.spent_today = 0;
        mandate.day_index = utc_day(now);
        mandate.expires_at = expires_at;
        mandate.nonce = 0;
        mandate.revoked = false;
        mandate.bump = ctx.bumps.mandate;

        let vault_bump = [ctx.bumps.vault];
        let mandate_key = mandate.key();
        let vault_seeds: &[&[u8]] = &[VAULT_SEED, mandate_key.as_ref(), &vault_bump];
        let create_vault = anchor_lang::solana_program::system_instruction::create_account(
            &ctx.accounts.owner.key(),
            &ctx.accounts.vault.key(),
            Rent::get()?.minimum_balance(0),
            0,
            &system_program::ID,
        );
        anchor_lang::solana_program::program::invoke_signed(
            &create_vault,
            &[
                ctx.accounts.owner.to_account_info(),
                ctx.accounts.vault.to_account_info(),
                ctx.accounts.system_program.to_account_info(),
            ],
            &[vault_seeds],
        )?;
        Ok(())
    }

    pub fn deposit(ctx: Context<OwnerVault>, amount: u64) -> Result<()> {
        require!(amount > 0, MandateError::ZeroAmount);
        let next_nonce = checked_add(ctx.accounts.mandate.nonce, 1)?;
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.key(),
                Transfer {
                    from: ctx.accounts.owner.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                },
            ),
            amount,
        )?;
        ctx.accounts.mandate.nonce = next_nonce;
        Ok(())
    }

    pub fn execute_payment(
        ctx: Context<ExecutePayment>,
        amount: u64,
        expected_nonce: u64,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let mandate = &mut ctx.accounts.mandate;
        require!(!mandate.revoked, MandateError::Revoked);
        require!(is_unexpired(now, mandate.expires_at), MandateError::Expired);
        require_keys_eq!(
            ctx.accounts.recipient.key(),
            mandate.recipient,
            MandateError::WrongRecipient
        );
        require!(amount > 0, MandateError::ZeroAmount);
        require!(
            amount <= mandate.max_per_tx,
            MandateError::PerTransactionLimit
        );
        require!(expected_nonce == mandate.nonce, MandateError::InvalidNonce);

        let today = utc_day(now);
        let (effective_day, current_spent) =
            daily_state_for_day(mandate.day_index, mandate.spent_today, today);
        let next_spent = checked_add(current_spent, amount)?;
        require!(next_spent <= mandate.daily_limit, MandateError::DailyLimit);
        let next_nonce = checked_add(mandate.nonce, 1)?;

        let reserve = Rent::get()?.minimum_balance(0);
        let available = spendable_balance(ctx.accounts.vault.lamports(), reserve)?;
        require!(amount <= available, MandateError::InsufficientFunds);

        let mandate_key = mandate.key();
        let bump = [ctx.bumps.vault];
        let vault_seeds: &[&[u8]] = &[VAULT_SEED, mandate_key.as_ref(), &bump];
        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.key(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.recipient.to_account_info(),
                },
                &[vault_seeds],
            ),
            amount,
        )?;

        mandate.spent_today = next_spent;
        mandate.day_index = effective_day;
        mandate.nonce = next_nonce;
        Ok(())
    }

    pub fn withdraw(ctx: Context<OwnerVault>, amount: u64) -> Result<()> {
        let next_nonce = checked_add(ctx.accounts.mandate.nonce, 1)?;
        transfer_from_vault(
            &ctx.accounts.mandate,
            &ctx.accounts.vault,
            &ctx.accounts.owner,
            &ctx.accounts.system_program,
            ctx.bumps.vault,
            amount,
        )?;
        ctx.accounts.mandate.nonce = next_nonce;
        Ok(())
    }

    pub fn revoke_agent(ctx: Context<OwnerMandate>) -> Result<()> {
        let mandate = &mut ctx.accounts.mandate;
        mandate.revoked = true;
        mandate.nonce = checked_add(mandate.nonce, 1)?;
        Ok(())
    }

    pub fn update_mandate(
        ctx: Context<OwnerMandate>,
        agent: Pubkey,
        recipient: Pubkey,
        max_per_tx: u64,
        daily_limit: u64,
        expires_at: i64,
    ) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        validate_policy(agent, recipient, max_per_tx, daily_limit, expires_at, now)?;
        let mandate = &mut ctx.accounts.mandate;
        mandate.agent = agent;
        mandate.recipient = recipient;
        mandate.max_per_tx = max_per_tx;
        mandate.daily_limit = daily_limit;
        mandate.expires_at = expires_at;
        let (effective_day, current_spent) =
            daily_state_for_day(mandate.day_index, mandate.spent_today, utc_day(now));
        mandate.day_index = effective_day;
        mandate.spent_today = current_spent;
        mandate.nonce = checked_add(mandate.nonce, 1)?;
        Ok(())
    }

    pub fn reactivate_agent(ctx: Context<OwnerMandate>) -> Result<()> {
        let now = Clock::get()?.unix_timestamp;
        let mandate = &mut ctx.accounts.mandate;
        require!(mandate.revoked, MandateError::NotRevoked);
        require!(is_unexpired(now, mandate.expires_at), MandateError::Expired);
        mandate.nonce = checked_add(mandate.nonce, 1)?;
        mandate.revoked = false;
        Ok(())
    }
}

fn validate_policy(
    agent: Pubkey,
    recipient: Pubkey,
    max_per_tx: u64,
    daily_limit: u64,
    expires_at: i64,
    now: i64,
) -> Result<()> {
    require!(
        agent != Pubkey::default() && recipient != Pubkey::default(),
        MandateError::InvalidPolicy
    );
    require!(
        max_per_tx > 0 && daily_limit > 0 && max_per_tx <= daily_limit,
        MandateError::InvalidPolicy
    );
    require!(expires_at > now, MandateError::InvalidPolicy);
    Ok(())
}

fn utc_day(unix_timestamp: i64) -> i64 {
    unix_timestamp.div_euclid(DAY_SECONDS)
}

fn is_unexpired(now: i64, expires_at: i64) -> bool {
    now < expires_at
}

fn daily_state_for_day(stored_day: i64, spent: u64, current_day: i64) -> (i64, u64) {
    if current_day > stored_day {
        (current_day, 0)
    } else {
        // Never restore an earlier day's allowance if the cluster clock moves backward.
        (stored_day, spent)
    }
}

fn checked_add(left: u64, right: u64) -> Result<u64> {
    left.checked_add(right)
        .ok_or_else(|| error!(MandateError::ArithmeticOverflow))
}

fn spendable_balance(balance: u64, reserve: u64) -> Result<u64> {
    balance
        .checked_sub(reserve)
        .ok_or_else(|| error!(MandateError::RentReserve))
}

fn transfer_from_vault<'info>(
    mandate: &Account<'info, Mandate>,
    vault: &UncheckedAccount<'info>,
    destination: &Signer<'info>,
    system_program_account: &Program<'info, System>,
    bump: u8,
    amount: u64,
) -> Result<()> {
    require!(amount > 0, MandateError::ZeroAmount);
    let reserve = Rent::get()?.minimum_balance(0);
    let available = spendable_balance(vault.lamports(), reserve)?;
    require!(amount <= available, MandateError::InsufficientFunds);
    let mandate_key = mandate.key();
    let bump_seed = [bump];
    let seeds: &[&[u8]] = &[VAULT_SEED, mandate_key.as_ref(), &bump_seed];
    system_program::transfer(
        CpiContext::new_with_signer(
            system_program_account.key(),
            Transfer {
                from: vault.to_account_info(),
                to: destination.to_account_info(),
            },
            &[seeds],
        ),
        amount,
    )?;
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeMandate<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(init, payer = owner, space = Mandate::SPACE, seeds = [MANDATE_SEED, owner.key().as_ref()], bump)]
    pub mandate: Account<'info, Mandate>,
    /// CHECK: Derived PDA, system-owned and zero-data by invariant.
    #[account(mut, seeds = [VAULT_SEED, mandate.key().as_ref()], bump, owner = system_program::ID, constraint = vault.data_is_empty())]
    pub vault: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct OwnerVault<'info> {
    #[account(mut, address = mandate.owner)]
    pub owner: Signer<'info>,
    #[account(mut, seeds = [MANDATE_SEED, owner.key().as_ref()], bump = mandate.bump, has_one = owner)]
    pub mandate: Account<'info, Mandate>,
    /// CHECK: Derived PDA, system-owned, zero-data and rent-reserve checked.
    #[account(mut, seeds = [VAULT_SEED, mandate.key().as_ref()], bump, owner = system_program::ID, constraint = vault.data_is_empty())]
    pub vault: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ExecutePayment<'info> {
    #[account(mut)]
    pub agent: Signer<'info>,
    #[account(mut, seeds = [MANDATE_SEED, mandate.owner.as_ref()], bump = mandate.bump, has_one = agent)]
    pub mandate: Account<'info, Mandate>,
    /// CHECK: Key must equal the mandate's fixed recipient.
    #[account(mut)]
    pub recipient: UncheckedAccount<'info>,
    /// CHECK: Derived PDA, system-owned, zero-data and rent-reserve checked.
    #[account(mut, seeds = [VAULT_SEED, mandate.key().as_ref()], bump, owner = system_program::ID, constraint = vault.data_is_empty())]
    pub vault: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct OwnerMandate<'info> {
    pub owner: Signer<'info>,
    #[account(mut, seeds = [MANDATE_SEED, owner.key().as_ref()], bump = mandate.bump, has_one = owner)]
    pub mandate: Account<'info, Mandate>,
}

#[account]
pub struct Mandate {
    pub owner: Pubkey,
    pub agent: Pubkey,
    pub recipient: Pubkey,
    pub max_per_tx: u64,
    pub daily_limit: u64,
    pub spent_today: u64,
    pub day_index: i64,
    pub expires_at: i64,
    pub nonce: u64,
    pub revoked: bool,
    pub bump: u8,
}

// 8-byte discriminator + 96 pubkey bytes + 48 integer bytes + 2 single-byte fields.
impl Mandate {
    pub const SPACE: usize = 8 + 32 * 3 + 8 * 6 + 1 + 1;
}

#[error_code]
pub enum MandateError {
    #[msg("Payment amount must be positive")]
    ZeroAmount,
    #[msg("Mandate is revoked")]
    Revoked,
    #[msg("Mandate has expired")]
    Expired,
    #[msg("Recipient does not match approved recipient")]
    WrongRecipient,
    #[msg("Payment exceeds per-transaction limit")]
    PerTransactionLimit,
    #[msg("Daily spending allowance exceeded")]
    DailyLimit,
    #[msg("Nonce does not match mandate state")]
    InvalidNonce,
    #[msg("Vault cannot retain the rent-exempt reserve")]
    RentReserve,
    #[msg("Vault has insufficient spendable balance")]
    InsufficientFunds,
    #[msg("Checked arithmetic failed")]
    ArithmeticOverflow,
    #[msg("Invalid mandate policy")]
    InvalidPolicy,
    #[msg("Mandate is not revoked")]
    NotRevoked,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn account_space_matches_serialized_layout() {
        assert_eq!(Mandate::SPACE, 154);
    }

    #[test]
    fn utc_days_use_euclidean_division_before_epoch() {
        assert_eq!(utc_day(0), 0);
        assert_eq!(utc_day(86_399), 0);
        assert_eq!(utc_day(86_400), 1);
        assert_eq!(utc_day(-1), -1);
    }

    #[test]
    fn expiry_boundary_is_exclusive() {
        assert!(is_unexpired(99, 100));
        assert!(!is_unexpired(100, 100));
        assert!(!is_unexpired(101, 100));
    }

    #[test]
    fn spending_rolls_over_at_utc_midnight_only() {
        let before_midnight = 86_399;
        let midnight = 86_400;
        let after_midnight = 86_401;

        assert_eq!(utc_day(before_midnight), 0);
        assert_eq!(
            daily_state_for_day(0, 55, utc_day(before_midnight)),
            (0, 55)
        );
        assert_eq!(utc_day(midnight), 1);
        assert_eq!(daily_state_for_day(0, 55, utc_day(midnight)), (1, 0));
        assert_eq!(utc_day(after_midnight), 1);
        assert_eq!(daily_state_for_day(1, 13, utc_day(after_midnight)), (1, 13));
        assert_eq!(
            daily_state_for_day(1, 13, utc_day(before_midnight)),
            (1, 13)
        );
    }

    #[test]
    fn policy_change_keeps_same_day_spend_but_rollover_clears_it() {
        assert_eq!(daily_state_for_day(20, 70, 20), (20, 70));
        assert_eq!(daily_state_for_day(20, 70, 21), (21, 0));
        // Repeated same-day updates invoke the same pure transition and cannot clear spend.
        let state = daily_state_for_day(20, 70, 20);
        assert_eq!(daily_state_for_day(state.0, state.1, 20), (20, 70));
    }

    #[test]
    fn checked_arithmetic_rejects_overflow_and_reserve_underflow() {
        assert!(checked_add(u64::MAX, 1).is_err());
        assert_eq!(checked_add(u64::MAX, 0).unwrap(), u64::MAX);
        assert!(spendable_balance(9, 10).is_err());
        assert_eq!(spendable_balance(10, 10).unwrap(), 0);
        assert_eq!(spendable_balance(u64::MAX, 0).unwrap(), u64::MAX);
    }
}
