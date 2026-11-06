# M1.1 Security Hardening Report

**Project:** `tr_mandate` — Anchor mandate program
**Branch:** `main`
**Published M1.1 commit:** `e7fe6f238869d66af785d43f46402992bfe3e1f1` — `fix: preserve mandate spending and require explicit reactivation`
**Publication status:** committed and pushed to `origin/main`; refreshed `origin/main` and local `HEAD` resolve to this commit.
**M1.1.2 status:** the transaction-atomicity test correction and report updates in this working tree are not yet committed or pushed.
**Review scope:** mandate policy, authorization, expiry, daily spending accounting, vault reserve, arithmetic, account layout, and local test coverage. This is not an independent audit.

## Owner-approved decisions and final semantics

- **Time source and expiry:** Every expiry decision uses `Clock::get()?.unix_timestamp`. Initialization and `update_mandate` reject `expires_at <= now`. Payment execution and reactivation require `now < expires_at`; equality is expired. An expired mandate can be reactivated only after an owner policy update extends its expiry.
- **Revocation and reactivation:** `revoke_agent` disables execution. `update_mandate` leaves the revoked flag unchanged. The distinct `reactivate_agent` instruction requires the mandate owner signer, rejects an unrevoked or expired mandate, clears revocation, and increments the nonce so prior signed requests cannot be replayed. It does not reset the nonce, daily spend, or policy fields.
- **Daily spending:** `spent_today` is retained for the same UTC day across policy edits and reactivation. It is cleared only when the observed UTC day advances. A backward clock movement retains the later stored day and spend. Repeated same-day policy edits therefore cannot restore allowance.

## Finding corrected

The original `update_mandate` reset `spent_today` and set `revoked = false`. Repeated owner policy edits could restore daily allowance, and an edit could silently undo revocation. The published handler preserves accounting and revocation; reactivation is a distinct owner-authorized action.

Payment execution previously accepted the exact expiry timestamp (`now <= expires_at`). It now uses the strict `now < expires_at` boundary. The account's serialized layout and existing instruction arguments remain unchanged. `reactivate_agent` is the one intentional new instruction and takes no arguments, using the existing owner and mandate accounts. Clients must consume the refreshed IDL.

## Security review notes

- Account constraints bind mandate PDAs to the owner, payment execution to the configured agent, and vault PDAs to their mandate. The payment recipient is checked against the stored approved recipient. Vault accounts must remain system-owned and zero-data.
- Payment and withdrawal compute available lamports by checked subtraction of the rent-exempt reserve. Payment, withdrawal, deposit, policy update, revocation, and reactivation use checked nonce increments. Spending uses checked addition.
- Solana rolls back all transaction state when a later instruction fails. The M1.1.2 validator test now proves this with a successful payment CPI as instruction 0 and a deterministically underfunded System Program transfer as instruction 1. Confirmed transaction metadata identifies instruction 1 as the failure; logs show the CPI and payment instruction succeeded first. Mandate spending, nonce, vault balance, and recipient balance are then verified unchanged.
- The daily transition helper is tested at one second before midnight, midnight, and one second after midnight. Local validator time is not warped across a day boundary.

## Verification evidence

Fresh verification for the M1.1.2 working tree is recorded in [M1_1_VERIFICATION_REPORT.md](M1_1_VERIFICATION_REPORT.md). Both Anchor builds passed; the final local-validator suite passed **11/11** tests, including the strengthened transaction rollback test; `cargo test --workspace` passed **6/6** unit tests and **0** doc tests; formatting, Clippy with warnings denied, and `git diff --check` passed.

An earlier M1.1 validator attempt used JavaScript wall time for expiry. It passed the payment assertion but the validator still considered the mandate unexpired when reactivation was submitted. The test now reads the validator Clock sysvar and waits for that timestamp, then verifies expired payment and reactivation rejection, extends expiry, and reactivates.

## Remaining limitations

1. A below-reserve vault and maximum spending/nonce account state cannot be reached through valid instructions. Reserve underflow and checked arithmetic are covered at helper level; a maximum `u64` payment input is also rejected on-validator for insufficient funds.
2. UTC rollover is validated with deterministic helper tests, not by warping validator Clock across midnight.
3. Clock-based expiry follows Solana's cluster timestamp behavior; the program does not add a sticky expired state.
4. Owner key compromise and program upgrade authority are outside this milestone. No external audit, formal verification, client authorization layer, or deployment was performed.
5. Validator airdrops are local-only. No real SOL transfer or Devnet/mainnet deployment was performed.
