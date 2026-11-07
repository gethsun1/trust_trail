# M2 Implementation Plan

## Architecture and routes

Use a Next.js App Router single-page control plane at `/` with clear Dashboard, Wallet, Agent Identity, Mandate, Vault and Activity sections. Keep key handling, account decoding, validation, PDA derivation and transaction orchestration in typed client-side modules. No backend API routes are needed. The initial release is Devnet-only; endpoint and cluster are explicit configuration, and unavailable or mismatched configuration fails closed.

## Wallet and cluster

Use Solana wallet-adapter's wallet-standard compatible provider discovery for connect, disconnect, account changes and connection status. Show owner address and the configured cluster. Only the connected owner wallet can authorize administration. Use an explicit `NEXT_PUBLIC_SOLANA_RPC_URL`, validated as Devnet; never use Mainnet or local-validator fallback. Display deployment unavailable until the configured program account is verified.

## Agent identity lifecycle

Generate with `Keypair.generate()` in the browser, keep the secret only in transient component/application memory, expose the public key, and warn against generating a replacement for an existing mandate. Restore from an encrypted backup or explicit secret-key input with immediate in-memory handling and validation. Persistent backup is an IndexedDB record containing ciphertext, salt, IV, version and public-key metadata. Encrypt the 64-byte secret key using AES-GCM; derive AES key with PBKDF2-SHA-256, unique 16-byte salt and at least 600,000 iterations. Require passphrase on every unlock; never persist passphrase or derived key. Include export/import and incorrect-passphrase/corruption handling. Do not send agent material to network, logs or telemetry. Document same-origin compromise, malware and extension limits.

## Anchor integration and state

Consume the current generated IDL and pinned program ID. Derive `["mandate", owner]`, then `["vault", mandate]` with `PublicKey.findProgramAddressSync`. Use Anchor's typed `Program` and wallet adapter provider for actual instructions/account metas. Read account and vault state before policy updates and after confirmed writes. Keep `execute_payment` out of all user-facing actions. Validate public keys, decimal SOL inputs, positive integer lamports, `u64` bounds, `i64` expiry, per-transaction ≤ daily limit and future expiry using integer/BigInt conversion. Show rent reserve and spendable balance.

## Transaction lifecycle

For each administrative action: validate, derive PDAs, fetch relevant state, build an Anchor instruction, show a summary/fee, request owner-wallet signature, submit to configured Devnet, confirm using blockhash strategy, and refresh state. Track awaiting approval, submitted, confirmed, failed and unknown/timeout distinctly; never mark success on signature receipt alone. Disable duplicate submission. On ambiguous confirmation, retain signature and inspect signature/state before any retry.

## Security boundaries

The browser never receives the owner's private key. The dedicated agent key never signs or submits M2 payments. No server, AI, telemetry or arbitrary program execution is added. The Anchor program remains authoritative. Devnet unavailability disables writes and is not represented as local-validator functionality. Browser encryption protects stored backups at rest but cannot defend an actively compromised same-origin environment.

## Testing and verification

Add unit tests for policy/lamport validation, PDA derivation, encrypted backup round-trip and tamper/passphrase failures, wallet state handling, and transaction lifecycle/error mapping. Mock RPC/wallet where appropriate and clearly label mocks. Run frontend typecheck, lint, unit tests and production build. Preserve and rerun the existing Anchor, Rust, formatting and Clippy checks where the available toolchain allows. No deployment or program change is in scope.

## Acceptance criteria

1. Owner wallet can connect/disconnect, account changes are reflected, and the UI clearly reports Devnet/deployment status.
2. A separate agent identity can be generated, encrypted to IndexedDB, exported, unlocked and restored without plaintext persistence or network transmission.
3. Mandate/vault state is decoded from RPC or explicitly unavailable; no fabricated on-chain values are shown.
4. Initialization, deposit, withdrawal, update, revoke and reactivation use the exact IDL and owner signer, with accurate transaction status.
5. Expiry, nonce, spend and revocation semantics match M1.1.2. No autonomous execution or M3 work is included.
6. Tests and production build pass; local-validator and Devnet evidence are distinguished.
