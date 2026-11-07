# M2.1 Hardening Report

**Date:** 2026-11-07  
**Repository:** `/home/farmers-boy/Documents/GKM/trust_trail`  
**Branch / HEAD:** `main` / `9773b7365ac3f897fd840251aa684a98bbeea5a5`  
**Remote:** `origin/main` resolved to the same commit during preflight.  
**Change control:** no reset, stash, commit, push or deployment. Existing M2 files were preserved.

## Preflight and M2 deviations

The working tree contained the M2 implementation and reports as uncommitted/unstaged changes. `.env.local` exists and is ignored by Git; its value was not printed or copied. Only the configured variable name was inspected. The configured RPC returned the same genesis hash as the official Devnet endpoint.

Review found these gaps relative to the approved M2 plan:

1. RPC selection trusted hostname patterns and had no authoritative cluster identity check.
2. Cluster verification and program deployment status were conflated in the UI error state.
3. Encrypted IndexedDB had no fresh-read restoration test; imported JSON was type-cast rather than strictly parsed, so extra fields could be persisted.
4. There was no explicit identity Lock or page-unload overwrite behavior.
5. No M2 client instruction-builder/account-decoder lifecycle test used a local validator.
6. The earlier wallet tests modeled state only and could not prove live Phantom/Solflare behavior.
7. The dependency audit had findings with no safe semver-compatible remediation under the pinned Anchor/Web3/wallet-adapter versions.

## Changes made

- Added authoritative `getGenesisHash()` verification for Devnet using expected hash `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG` with a five-second timeout. Endpoint parsing now requires HTTPS and rejects credentials/fragments; endpoint names do not determine cluster identity. Invalid configuration, wrong genesis, unavailable RPC and timeout fail closed. Deployment is checked only after the cluster identity passes, and writes require both Devnet verification and an executable program.
- Tightened agent backup parsing to an exact encrypted-only schema and fixed-size ciphertext metadata. Creation and restore verify the 64-byte keypair against its public-key metadata. Added fake IndexedDB fresh-read recovery coverage.
- Added explicit Lock and `pagehide` best-effort zeroization for the referenced key buffer. UI and documentation explain that JavaScript cannot guarantee erasure of every copy.
- Added a local-validator integration test using the M2 Anchor client builder, transaction preparer and decoder. A disposable validator with the built M1 program passed initialization/read, deposit/read, update, revoke, reactivate and reserve-preserving withdrawal.
- Reviewed Wallet Standard capability filtering. The app requires Standard connect/events and Solana signing features; it does not register a redundant legacy Phantom/Solflare adapter list. Actual browser extensions were unavailable, so real wallet operations remain unverified.
- Reviewed all production npm audit paths. No safe compatible patch was available; no forced or breaking upgrade was applied. Reachability, patch versions and compatibility constraints are recorded in `M2_SECURITY_REVIEW.md`.

## Network verification evidence

On 2026-11-07, both the configured RPC and `https://api.devnet.solana.com` returned Devnet genesis hash `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`. Unit tests also cover a wrong hash, unavailable RPC, a never-resolving RPC timeout, malformed URLs, HTTPS requirements and the fact that Mainnet URL syntax alone is not accepted as Devnet identity.

The configured program account remains absent on Devnet. No deployment was attempted. Network identity and deployment state remain separate in both client code and UI.

## Local and wallet verification

The local lifecycle test ran against a fresh, isolated Solana 4.1.2 validator with `target/deploy/tr_mandate.so`. The test generated owner, agent and recipient keys in memory, used only local airdrop funds, and removed the temporary ledger after completion. It exercised the actual existing Anchor program and current M2 client account decoder. This is local evidence only.

No Phantom, Solflare or MetaMask extension session was available. Wallet state, rejection, unsupported-provider state and account changes have unit/model coverage; this does not substitute for a real extension/browser test. No real wallet key or real SOL was accessed.

## Verification

Fresh outcomes are tabulated in `M2_VERIFICATION_REPORT.md`. Frontend typecheck, lint, unit tests and production build pass. The local integration passes 1/1. Both Anchor builds, the 11-test M1 validator suite, six Rust tests, formatting and strict Clippy pass. `git diff --check` is run during final workspace review.

## Remaining limitations and acceptance

- The M1 program is still not deployed to Devnet. No Devnet transaction or live-wallet Devnet confirmation was attempted. Do not call this Devnet-ready.
- Real Phantom/Solflare connect, disconnect, rejection and account-change behavior requires a browser session with those providers.
- `npm audit --omit=dev` still reports 13 findings (11 moderate, 2 high), with no compatible fix available under the current dependency constraints. The control plane does not parse untrusted TOML or use the affected server-side streaming parser path; the dependency findings remain in the production tree and need review before exposing server-side parsing or making major SDK upgrades.
- Browser memory clearing is best effort; it cannot erase copies held by the runtime, devtools, extensions or a compromised same-origin process.

**Recommendation: CONDITIONAL PASS.** Local client/program lifecycle and Devnet identity-gating evidence pass. Devnet deployment and real-wallet verification remain prerequisites for a Devnet readiness claim.
