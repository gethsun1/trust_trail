# M2 Verification Report

**Date:** 2026-11-07  
**Branch:** `main`  
**Network evidence:** Configured RPC and official Devnet returned the same expected Devnet genesis hash. Program account is absent on Devnet. Local integration is explicitly separate.

## Frontend and security checks

| Command | Fresh outcome |
|---|---|
| `npm run typecheck` | Passed (`tsc --noEmit`). |
| `npm run lint` | Passed with no lint errors. |
| `npm test` | Passed: 4 files, 16 passed; 1 local-validator-only test skipped without its environment variable. |
| `npm run build` | Passed: optimized Next.js build; `/` and `/_not-found` generated. |
| `npm audit --omit=dev` | Reports 13 findings (11 moderate, 2 high), no available fixes in current compatible dependency ranges. |

Security/network unit coverage includes correct and wrong genesis hashes, unavailable and timed-out RPC, malformed/insecure RPC configuration, strict backup shape, AES-GCM/PBKDF2 parameters, random salt/IV, bad passphrase/corruption, key/public-key consistency, encrypted-only IndexedDB record shape, fresh IndexedDB read/restore, transaction owner fee payer and wallet state/error modeling.

## Local-validator frontend integration

Freshly started `solana-test-validator` with an isolated `/tmp/tr_m2_1_validator` ledger and `target/deploy/tr_mandate.so` loaded at the existing program ID. Command:

`TR_LOCAL_VALIDATOR_URL=http://127.0.0.1:8899 npm run test:local-integration`

**Passed: 1/1 lifecycle test.** It used generated in-memory test keys and the actual M2 `createProgram`, Anchor instruction builders, `prepareOwnerTransaction` and `readMandate` decoder. It exercised initialize/read, deposit/read vault balance, update, revoke, explicit reactivation and withdrawal above the rent reserve. The validator was stopped and its temporary ledger removed. No real wallet, real SOL or user wallet key was used.

## Existing M1 verification, freshly rerun

| Command | Fresh outcome |
|---|---|
| `anchor build` | Passed; existing non-fatal `cdylib` + `lib` LTO warning. |
| `anchor build --tools-version v1.57 --arch v3` | Passed; same warning. |
| `anchor test --validator legacy --provider.wallet target/test-wallet.json` | Passed: 11/11 local-validator tests. |
| `cargo test --workspace` | Passed: 6/6 unit tests, 0 doc tests. |
| `cargo fmt --all -- --check` | Passed. |
| `cargo clippy --workspace --all-targets -- -D warnings` | Passed. |
| `git diff --check` | Passed during final workspace review. |

Commands used `/home/farmers-boy/.cargo/bin` in `PATH`. These Anchor validator tests are distinct from the new M2 client integration test and from Devnet.

## Wallet and Devnet limits

No Phantom, Solflare or MetaMask browser extension was available. The Wallet Standard adapter filters for required Solana signing features, and mocked/model tests cover connect/disconnect/account-change state and rejection mapping, but this is not live-wallet evidence. The program ID is not deployed on Devnet, so no Devnet transaction, real-wallet confirmation or Devnet account-refresh test was run. The app verifies genesis before checking deployment and disables writes unless both checks pass.

The current production dependency audit is detailed in `M2_SECURITY_REVIEW.md`. It leaves two high-severity npm findings (the Anchor → TOML path) and moderate legacy Web3/Jayson paths with no safe patch in the current Anchor/wallet-adapter version ranges. No forced audit fix or breaking SDK migration was attempted.

**Acceptance recommendation: CONDITIONAL PASS.** Agent encryption, network identity checks and the client’s local program lifecycle are verified. Devnet deployment and real Phantom/Solflare wallet verification remain outstanding; no Devnet readiness claim is made.
