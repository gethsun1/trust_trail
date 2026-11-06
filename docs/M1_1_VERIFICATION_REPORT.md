# M1.1 Verification Report

**Project:** `tr_mandate`
**Branch:** `main`
**Published M1.1 commit:** `e7fe6f238869d66af785d43f46402992bfe3e1f1` — `fix: preserve mandate spending and require explicit reactivation`
**Publication status:** M1.1 is committed and pushed. Preflight fetched `origin`; local `HEAD` and `origin/main` both resolve to the published commit.
**M1.1.2 working-tree status:** only `tests/tr_mandate.test.mjs` and the two M1.1 reports are intentionally modified for this milestone; these changes have not been committed or pushed.
**Environment:** Anchor CLI 1.2.2; Solana CLI 4.1.2; Rust/Cargo 1.89.0; Node.js 24.22.0; npm 12.2.0. Verification commands were run after adding `/home/farmers-boy/.cargo/bin` to `PATH`.

## Repository preflight

- Working tree was clean before M1.1.2 edits.
- Current branch was `main`; local `HEAD` was `e7fe6f238869d66af785d43f46402992bfe3e1f1`.
- After `git fetch origin`, `origin/main` was also `e7fe6f238869d66af785d43f46402992bfe3e1f1`.
- The published commit message is `fix: preserve mandate spending and require explicit reactivation`.

## Fresh verification commands and outcomes

| Exact command | Final outcome |
|---|---|
| `anchor build` | **Passed**; non-fatal warning that `cdylib` plus `lib` disables LTO for this crate. |
| `anchor build --tools-version v1.57 --arch v3` | **Passed**; same non-fatal crate-type/LTO warning. |
| `anchor test --validator legacy --provider.wallet target/test-wallet.json` | **Passed: 11 tests, 11 passed, 0 failed, 0 skipped.** |
| `cargo test --workspace` | **Passed: 6 unit tests, 0 failed; 0 doc tests.** |
| `cargo fmt --all -- --check` | **Passed.** |
| `cargo clippy --workspace --all-targets -- -D warnings` | **Passed.** |
| `git diff --check` | **Passed** after the final report and test edits. |

`anchor build`, `anchor build --tools-version v1.57 --arch v3`, `cargo test --workspace`, formatting, and Clippy each passed on their first attempt after the toolchain path was corrected. The final Anchor test suite passed all 11 tests. The strengthened rollback case verifies a confirmed transaction whose first instruction is `tr_mandate::execute_payment` and whose second instruction is a System Program transfer of 1,000,000,000 lamports, greater than the funded agent's balance. The transaction is sent with preflight disabled. Metadata reports instruction index 1 with System Program custom error 1; inner-instruction metadata and logs show the payment's System Program CPI and `tr_mandate` instruction succeeded before the later transfer failed for insufficient lamports. The test verifies `spent_today`, nonce, vault balance, and approved-recipient balance all match their pre-transaction values.

The integration suite also covers initialization and expiry policy validation; PDA/account ownership and rent reserve; authorized payment; rejected agent, recipient, vault, amount, limit, nonce, and funds cases; unchanged state on rejection; same-day policy updates; revocation persistence; owner-only reactivation and spending preservation; expired reactivation rejection and extension; and maximum payment arithmetic. Rust tests cover account allocation, UTC day arithmetic, midnight rollover and clock regression, repeated same-day accounting, exact expiry boundary, reserve arithmetic, and checked `u64` arithmetic.

## Failed attempts during this verification

These failures were retained in the record and corrected before the final passing run:

- The exact requested command forms were initially attempted with the default `PATH`; all six Anchor/Cargo commands returned exit code **127** (`anchor: command not found` or `cargo: command not found`). The installed binaries were present under `/home/farmers-boy/.cargo/bin`; all commands were rerun with that directory added to `PATH`, producing the final outcomes above.
- The first validator run of the new test passed 10/11 cases. The expected named `InsufficientFunds` error did not match this validator's metadata representation (`Custom: 1` at instruction index 1).
- The second validator run passed 10/11. The test treated RPC-decoded legacy instructions as exposing a direct `programId`; this client exposes `programIdIndex` and transaction account keys.
- The third validator run passed 10/11. A strict log lookup did not match the validator's emitted failure lines. The assertion now checks the actual ordered System Program invoke/failure log entries and the insufficient-lamports message.
- The final rerun passed **11/11**, with no skipped tests.

## Publication and scope

The M1.1 source is published at the commit above. The M1.1.2 test correction and report updates are local working-tree changes only. `.gitignore` excludes `.env` files, secret/key/seed/mnemonic patterns, wallet and keypair JSON files, `target/`, `.anchor/`, and validator ledgers. `target/test-wallet.json` and `.anchor/test-ledger/validator-keypair.json` are ignored. No program deployment, external audit, commit, push, or M2 work was performed.

## Remaining verification limits

- Validator Clock was not warped across a UTC day boundary; daily rollover is covered by deterministic Rust helper tests.
- An invalid reserve state and maximum nonce/spending state cannot be created through valid instructions; those checks use helper-level tests.
- This is local validator verification, not Devnet verification, deployment, an external audit, or formal verification.
