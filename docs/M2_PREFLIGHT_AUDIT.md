# M2 Preflight Audit

**Date:** 2026-11-07  
**Repository:** `/home/farmers-boy/Documents/GKM/trust_trail`  
**Branch:** `main`  
**HEAD:** `9773b7365ac3f897fd840251aa684a98bbeea5a5` — `test: prove transaction-level payment rollback`  
**Remote:** `origin` fetch `https://github.com/gethsun1/trust_trail.git`; push `git@github.com:gethsun1/trust_trail.git`

## Repository state

Preflight found a clean working tree (`main...origin/main`) with HEAD equal to `origin/main`. History contains M1 (`9a22e28`), M1.1 (`e7fe6f2`), and the M1.1.2 transaction rollback correction (`9773b73`). The project is an Anchor 1.2.2 / Solana 4.1.2 Rust workspace. No `AGENTS.md` files were found.

There was no frontend, TypeScript application, frontend test framework, or Anchor JS client. Existing JavaScript is a Node test harness using pinned `@solana/web3.js` 1.99.0. The repository has a generated IDL at `target/idl/tr_mandate.json` and type helper at `target/types/tr_mandate.ts`; `target/` is ignored and build-generated, so the app must use the IDL from a committed location rather than depend on ignored runtime artifacts.

## Program interface and deployment

- Program ID: `7hucMRtxEjUYn9hbKPsByneQmmu4Qrv7qDgaVG59ryEY`.
- Anchor configuration declares only `[programs.localnet]`; provider cluster is `Localnet`.
- Devnet deployment status: a read-only `getAccountInfo` query to `https://api.devnet.solana.com` returned `value: null` for the configured program ID at slot `519433421` on 2026-11-07. The program is not currently deployed at that address on Devnet. No deployment will be performed in M2.
- PDA seeds are `["mandate", owner_pubkey]` and `["vault", mandate_pubkey]`.
- `Mandate` fields are owner, agent, recipient, `max_per_tx`, `daily_limit`, `spent_today`, `day_index`, `expires_at`, nonce, revoked and bump. Serialized account size is 154 bytes including discriminator.
- Instructions and arguments: `initialize_mandate(agent, recipient, max_per_tx: u64, daily_limit: u64, expires_at: i64)`, `deposit(amount: u64)`, `withdraw(amount: u64)`, `update_mandate(agent, recipient, max_per_tx, daily_limit, expires_at)`, `revoke_agent()`, and `reactivate_agent()`. `execute_payment` exists on-chain but is excluded from M2 UI and services.
- Owner is the required signer for initialization, deposit/withdrawal and policy administration. The owner must not be asked for or handled as a raw private key.
- Updates increment nonce and preserve same-day spending and revocation state. Reactivation is explicit, increments nonce, requires an unexpired revoked mandate, and does not clear spend history.
- Withdrawal leaves the zero-data system-owned vault's rent reserve intact.

Existing M1.1.2 verification records successful local-validator tests (11/11), Rust tests (6/6), formatting and Clippy. This is local-only verification, not Devnet verification.

## Secrets, environment, dependencies

`.gitignore` excludes `.env*` except `.env.example`, key/secret/mnemonic files, wallet/keypair files, `target/`, `.anchor/`, ledgers, and `node_modules/`. No frontend environment schema exists. `Anchor.toml` has no Devnet declaration. The existing Node dependency is `@solana/web3.js` 1.99.0. Browser persistence for an agent identity must use encrypted IndexedDB records only; no current persistence convention exists. Public RPC/program configuration must be explicit and fail closed when missing or inconsistent. Devnet must never silently fall back to Mainnet or local validator.

## Architecture decision

Because the repository has no application framework or frontend infrastructure to preserve, M2 will add a Next.js App Router TypeScript client with strict type checking, Tailwind styling, Solana wallet-standard compatible integration, Anchor JS IDL client, runtime validation, and focused unit tests. Wallet and RPC configuration will be explicit and Devnet-only. The unavailable Devnet deployment will be shown as a hard on-chain capability gate; the interface can be built and tested without pretending transactions are live.
