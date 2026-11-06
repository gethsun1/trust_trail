# M1.1 Verification Report

**Project:** `tr_mandate`
**Branch:** `main`
**Source base commit:** `9a22e28aff9dd6b417097972f352cd59a5ce98ae`
**Remote comparison:** fetched `origin/main`; it resolves to the same SHA.
**Final source status:** uncommitted local M1.1 changes. No commit SHA exists for the modified source. No commit or push was made.
**Environment:** Anchor CLI 1.2.2; Solana CLI 4.1.2; Rust/Cargo 1.89.0; Node.js 24.22.0; npm 12.2.0. `~/.cargo/bin` was added to `PATH` for verification commands.

## Final verification commands

| Exact command | Outcome |
|---|---|
| `anchor build` | **Passed**; non-fatal warning that `cdylib` plus `lib` disables LTO for this crate. |
| `anchor build --tools-version v1.57 --arch v3` | **Passed**; same non-fatal crate-type/LTO warning. |
| `anchor test --validator legacy --provider.wallet target/test-wallet.json` | **Passed: 11 tests, 11 passed, 0 failed, 0 skipped.** |
| `cargo test --workspace` | **Passed: 6 unit tests, 0 failed; 0 doc tests.** |
| `cargo fmt --all -- --check` | **Passed.** |
| `cargo clippy --workspace --all-targets -- -D warnings` | **Passed.** |
| `git diff --check` | **Passed** before staging and is repeated after report updates. |

The integration suite covers initialization and invalid expiry policies; PDA/account ownership and rent reserve; authorized payment; rejected agent, recipient, vault, amount, limit, nonce, and funds cases; failed-state preservation; same-day and repeated policy updates; revocation persistence; owner-only reactivation and preservation of spending; expired reactivation rejection and extension flow; and rollback after transaction finalization failure. The expiry integration test reads the validator Clock sysvar rather than assuming the validator clock matches JavaScript wall time.

Rust tests cover account allocation, UTC day arithmetic, midnight rollover and clock regression, repeated same-day accounting, exact expiry boundary, reserve arithmetic, and checked `u64` arithmetic.

## Earlier harness failure and resolution

The first final-suite attempt ran 11 integration cases with **10 passed and 1 failed**. The expiry case used JavaScript wall time; the payment assertion passed but the validator still considered the mandate unexpired when reactivation was submitted. The test now reads timestamp from the validator Clock sysvar and waits for that timestamp. The complete rerun passed **11/11**. The implementation was also adjusted to enforce strict expiry during reactivation.

## Local source comparison and publication checks

The working branch is `main`, HEAD is `9a22e28aff9dd6b417097972f352cd59a5ce98ae`, and refreshed `origin/main` matches. M1.1 is local working-tree content; it is not represented by a commit yet.

The intended changed files are:

- `programs/tr_mandate/src/lib.rs`
- `tests/tr_mandate.test.mjs`
- `docs/M1_1_SECURITY_HARDENING_REPORT.md`
- `docs/M1_1_VERIFICATION_REPORT.md`

`.gitignore` excludes `.env` files, secret/key/seed/mnemonic patterns, wallet and keypair JSON files, `target/`, `.anchor/`, and validator ledgers. `target/test-wallet.json` and `.anchor/test-ledger/validator-keypair.json` were confirmed ignored. No credential, wallet, or validator files are tracked. Build outputs and wallet files are excluded from the intended staged set.

## Remaining verification limits

- Validator Clock was not warped across a UTC day boundary; daily rollover is covered by deterministic Rust helper tests.
- An invalid reserve state and maximum nonce/spending state cannot be created through valid instructions; those checks use helper-level tests.
- This is local verification, not an external audit or deployment. No Devnet/mainnet action, commit, push, or M2 work was performed.
