# M2 Implementation Report

**Date:** 2026-11-07  
**Status:** M2 control plane implemented; Devnet writes remain deployment-gated.  
**Branch:** `main`; no commit or push performed.

## Architecture and hardening

The Next.js 16 App Router application is client-side and has Overview, Mandate, Vault, Agent Identity and Activity sections. Wallet Standard discovery is the only explicitly configured wallet-discovery path. The Wallet Adapter provider handles standard connection, disconnection and account-change events; it exposes only wallets compatible with Standard connect/events and a Solana signing feature. It does not add a Phantom/Solflare legacy adapter list. Wallet Adapter internally provides its mobile adapter and avoids duplicate adapters when a same-name Standard wallet is present.

RPC configuration requires an HTTPS URL without embedded credentials or fragments. The application verifies `getGenesisHash()` against the known Devnet genesis hash with a five-second timeout before checking the program account. Cluster identity and program deployment are separate states. Wrong cluster, malformed configuration, unavailable RPC, timeout and missing deployment each fail closed; there is no Mainnet or Localnet fallback. The configured RPC and official Devnet endpoint returned the same expected genesis hash during this verification. The program account remains absent on Devnet.

## Agent identity

Agent keys are generated in the browser and held in transient component memory. Encrypted backups use AES-GCM-256 and PBKDF2-SHA-256 with 600,000 iterations, a random 16-byte salt and random 12-byte IV. The backup parser strictly accepts the expected encrypted fields and fixed ciphertext dimensions, rejecting unknown fields such as plaintext secret-key data. IndexedDB saves only validated ciphertext and non-secret metadata. Restore validates the 64-byte secret by deriving its keypair and checking the public-key metadata. Fresh-read recovery through IndexedDB is covered by a `fake-indexeddb` test.

The user can explicitly lock an identity; the referenced byte array is overwritten before React state is cleared. A `pagehide` handler performs the same best-effort overwrite. JavaScript runtimes, browser devtools, extensions and transient copies can retain material, so this cannot guarantee physical erasure. It does not protect against malware, malicious extensions, compromised devices or active same-origin attacks.

## Anchor and local integration

The client consumes `lib/tr_mandate.json`, derives the existing mandate/vault PDA seeds and validates the account owner, discriminator, account size and vault invariants. Owner-authorized instruction construction is tested against the actual program on a disposable local validator using the same M2 `createProgram`, instruction builders, transaction preparation and `readMandate` decoder.

The local lifecycle test passed initialization/read, deposit/read balance, policy update, revocation, explicit reactivation and withdrawal while retaining the rent reserve. It uses an ephemeral Keypair and validator ledger under `/tmp`; no configured user wallet or real funds were used. The client continues to omit `execute_payment`.

## Reproduce

- `npm run dev` starts the interface on `http://localhost:3000` using the validated configured Devnet RPC.
- `solana-test-validator --reset --ledger /tmp/tr_m2_1_validator --bpf-program 7hucMRtxEjUYn9hbKPsByneQmmu4Qrv7qDgaVG59ryEY target/deploy/tr_mandate.so` starts a disposable local validator after `anchor build`.
- `TR_LOCAL_VALIDATOR_URL=http://127.0.0.1:8899 npm run test:local-integration` runs the real client/program lifecycle test.

## Remaining dependencies

No Phantom or Solflare browser extension was available for an actual connect/disconnect/account-change run. Tests cover the Wallet Standard state model and account-change response; a real extension session remains to be verified. The program is undeployed on Devnet, so no real-wallet Devnet transaction or Devnet lifecycle claim is made. Dependency advisory and reachability analysis is in `M2_SECURITY_REVIEW.md`.
