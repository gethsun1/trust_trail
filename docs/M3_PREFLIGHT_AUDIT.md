# M3 Preflight Audit

Date: 2026-11-07 (Africa/Nairobi)

## Repository state

- Branch: `main`; HEAD: `408337436d8923f67bf690112881587ba1390de5` (`feat: add hardened wallet and mandate frontend`).
- Expected M2 baseline `9773b7365ac3f897fd840251aa684a98bbeea5a5` is an ancestor of HEAD; the checkout is one commit beyond it and contains the documented M2 frontend.
- `main` tracks `origin/main`; working tree was clean before M3 changes.
- `.env.local` exists, is untracked, and is ignored by `.gitignore` (`.env.*`). Its contents were not inspected.

## Source of truth

- Next.js App Router is in `app/`; client dashboard is `components/dashboard.tsx`.
- Existing wallet, identity, mandate decoder and transaction helpers are in `lib/{agent-vault,chain,mandate,transactions,wallet-state}.ts`.
- Existing Zod 4 validation and `@solana/web3.js` 1.x / Anchor 0.32 are already installed.
- Committed IDL: `lib/tr_mandate.json`; program source: `programs/tr_mandate/src/lib.rs`.
- Program ID from both is `7hucMRtxEjUYn9hbKPsByneQmmu4Qrv7qDgaVG59ryEY`.
- `execute_payment` discriminator bytes are `[86,4,7,7,120,139,232,139]`; args are `amount: u64`, then `expected_nonce: u64`.
- IDL account order/flags: `agent` writable signer; `mandate` writable; `recipient` writable; `vault` writable; `system_program` readonly, fixed to `11111111111111111111111111111111`.
- Rust constraints derive mandate as `[b"mandate", owner]`, vault as `[b"vault", mandate]`; mandate enforces `has_one = agent`, recipient is checked against mandate state by instruction logic, vault is system-owned/zero-data, and nonce equals stored nonce then increments by one.
- Mandate account layout is 154 bytes; existing decoder checks owner/discriminator/length, vault owner/data, rent reserve and RPC cluster time.
- `.env.example` contains only the public Solana RPC setting. `.gitignore` excludes `.env`/`.env.*` except `.env.example`, keys and build output.
- No tracked private key or decrypted agent backup is part of the proposed server request.

## Gate

Preflight is consistent; implementation may proceed. No M1/M2 source changes are required to establish M3. The Anchor account layout and instruction semantics remain unchanged.
