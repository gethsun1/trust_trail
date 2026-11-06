# M1 Implementation Report

**Project:** tr — Anchor Mandate Program
**Date:** 2026-11-06 (Africa/Nairobi)
**Status:** Implemented and locally verified; no deployment performed.

## Scope

M1 implements only the Anchor on-chain mandate program for native SOL. It does not include a frontend, AI integration, transaction firewall UI, or application backend. The program has not been deployed to Devnet or mainnet.

## Architecture and account layout

Program name: `tr_mandate`
Program address for this local workspace: `7hucMRtxEjUYn9hbKPsByneQmmu4Qrv7qDgaVG59ryEY`.

The mandate PDA uses seeds `[b"mandate", owner_pubkey]`. The vault PDA uses `[b"vault", mandate_pda]`. Anchor checks both derivations on every instruction that uses the corresponding account. The mandate is program-owned Anchor data. Its allocation is 154 bytes:

| Field | Type | Bytes |
|---|---:|---:|
| Anchor discriminator | bytes | 8 |
| owner, agent, recipient | `Pubkey` × 3 | 96 |
| max_per_tx, daily_limit, spent_today, day_index, expires_at, nonce | 64-bit integer × 6 | 48 |
| revoked, bump | `bool`, `u8` | 2 |
| **Total** |  | **154** |

All amounts are integer lamports. `day_index` and `expires_at` are signed Unix seconds/day values; spending counters and nonce are unsigned 64-bit values.

## Vault model and rent handling

Initialization creates the vault PDA as a zero-data account owned by the System Program and funds it with `Rent::minimum_balance(0)`. It is not an Anchor data account. Owner deposits use the System Program transfer instruction. Payments and withdrawals use System Program transfer CPI with `invoke_signed` and the vault PDA seeds.

Every outgoing transfer checks `vault_lamports - Rent::minimum_balance(0)` using checked subtraction and rejects an amount above the resulting spendable balance. A balance below reserve returns `RentReserve`; an amount above spendable funds returns `InsufficientFunds`. No program path can withdraw the reserve. Owner withdrawals remain available when the agent is revoked or the mandate has expired.

## Instruction behavior

- `initialize_mandate`: owner pays for the mandate account and vault rent; policy must have nonzero agent and recipient, positive limits, `max_per_tx <= daily_limit`, and a future expiry.
- `deposit`: owner transfers a positive lamport amount to the vault.
- `execute_payment`: authorized agent signer can transfer only to the stored recipient and only when not revoked or expired, under the per-transaction and UTC daily limits, with the expected nonce and sufficient spendable balance.
- `withdraw`: only the owner can transfer positive spendable lamports back to the owner.
- `revoke_agent`: owner marks the mandate revoked and advances the nonce.
- `update_mandate`: owner replaces agent, recipient, limits, and expiry; resets daily usage to the current UTC day; advances nonce; and reactivates the mandate. Reactivation is an explicit owner-authorized policy update.

Payments, deposits, withdrawals, and policy changes increment the nonce (payment/deposit/withdrawal and policy transitions) so prepared transactions become stale when the vault balance, policy, or spending state changes. All state mutations and CPIs execute in one Solana transaction, so CPI failure rolls back the state change.

## UTC daily spending

The program computes `unix_timestamp.div_euclid(86_400)`. This gives UTC calendar-day buckets and handles timestamps before the Unix epoch consistently. When an execution occurs on a different day from `day_index`, its prior `spent_today` is treated as zero; the successful payment stores the new day and checked next total. A rejected payment does not persist a daily reset, nonce change, or counter update.

## Verification results

Toolchain recorded from the installed environment and M0.1 verification:

| Tool | Version |
|---|---|
| Rust default / Cargo default | `1.99.1` |
| Workspace host Rust pin | `1.89.0` |
| AVM / Anchor CLI / Anchor Rust crate | `1.2.2` |
| Solana CLI | `4.1.2` |
| SBF platform-tools | `v1.57` (SBPF v3) |
| Node.js / npm | `v24.22.0` / `12.2.0` |
| Web3.js test dependency | `1.99.0` |

Results from this implementation pass:

- `anchor build --tools-version v1.57 --arch v3`: passed; generated SBF program and IDL.
- `anchor test --validator legacy --provider.wallet target/test-wallet.json`: passed; 1 local-validator integration test covering initialization, ownership/space/PDA checks, deposit, authorized payment, recipient/PDA/nonce/amount/limit/agent checks, state rollback, insufficient funds, owner authorization, update, revocation, post-revocation withdrawal, reserve retention, and expiry.
- `cargo test --workspace`: passed, 3 tests for account allocation, UTC day arithmetic, and arithmetic overflow/reserve underflow.
- `cargo fmt --all -- --check`: passed.
- `cargo clippy --workspace --all-targets -- -D warnings`: passed.
- No Devnet or mainnet transaction/deployment was performed.

## Reproduce locally

The configured local test wallet and local program keypair are deliberately ignored under `target/`; do not copy a production wallet there. From a fresh checkout, ensure the pinned tools are installed and create a disposable local keypair. If Anchor reports that the local program keypair is missing, create one and synchronize the local declaration before building:

```bash
export PATH="$HOME/.cargo/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH"
avm use 1.2.2
mkdir -p target/deploy
solana-keygen new --no-bip39-passphrase --silent --outfile target/test-wallet.json
solana-keygen new --no-bip39-passphrase --silent --outfile target/deploy/tr_mandate-keypair.json
anchor keys sync
anchor build --tools-version v1.57 --arch v3
npm ci
cargo test --workspace
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
anchor test --validator legacy --provider.wallet target/test-wallet.json
```

`anchor keys sync` updates the local program address in `declare_id!` and `Anchor.toml` to match the newly generated local-only deployment key. Keep the two generated keypairs private and untracked. Use a separate explicitly reviewed deployment procedure for any cluster deployment.

## Known limitations

- The local validator harness checks one sequential state path rather than exhaustive adversarial transaction scheduling or fuzzed instruction inputs.
- Expiry is tested with a short wall-clock delay because this harness does not warp the validator clock.
- The rent reserve underflow is tested at the arithmetic helper level. No supported program operation can lower an initialized vault below reserve, so the below-reserve handler branch cannot be induced through the normal instruction set without corrupting validator account state.
- Arithmetic overflow/underflow paths are tested at the checked helper level; reaching the stored `u64::MAX` mandate state through valid instructions is intentionally impossible.
- A rent-exempt reserve prevents the vault PDA from being closed through an empty transfer. No close or migration instruction is implemented.
- This is not an audited production custody program. Upgrade authority, deployment operations, external wallet handling, and client transaction construction are outside M1.
