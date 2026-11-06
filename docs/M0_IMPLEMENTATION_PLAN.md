# M0 Implementation Plan

**Project:** tr — Solana Autonomous Agent Trust and Execution Layer  
**Plan date:** 2026-11-06  
**Status:** Proposed only. M1 requires explicit owner approval. No application code was created in M0.

## Environment-driven decisions

- Use `/home/farmers-boy/Documents/GKM/trust_trail` as the project root; it exists and was empty at audit time.
- Keep the MVP as one Next.js app plus one Anchor program workspace. No separate backend service or microservice.
- Node.js `24.22.0` is present. Pin `24` in `.nvmrc` (or exact `24.22.0`) and `engines`; use npm or pnpm consistently, with a committed lockfile. Recommendation: npm for maximum compatibility with wallet and Anchor TS examples; pnpm is also already installed.
- Candidate Anchor CLI/framework line: `1.2.1`, the stable release observed on 2026-11-06. Install through AVM and use AVM's project-based Solana/platform-tools resolution. Record the resolved exact CLI, Solana, platform-tools, and Rust versions in `Anchor.toml`/toolchain files and CI docs. Do not guess an independent Solana version before AVM resolution.
- Rust stable is required, but the exact host Rust version should be pinned after checking Anchor's selected SBF platform-tools compatibility. The SBF build uses Solana platform-tools; host Rust and SBF Rust are distinct toolchains.
- Proposed frontend package versions should be selected and pinned together when M2 begins. Use current stable Next.js App Router, React, TypeScript, Tailwind, `@solana/web3.js` v1-compatible wallet tooling (unless the selected wallet adapter explicitly supports a newer API), `@coral-xyz/anchor` client compatible with the selected Anchor IDL, and Zod. Do not install speculative versions in M0.

## Proposed repository structure

```text
trust_trail/
  Anchor.toml
  Cargo.toml
  package.json
  package-lock.json              # or pnpm-lock.yaml; one lockfile only
  .nvmrc
  rust-toolchain.toml            # exact compatible host toolchain once validated
  app/
    api/intent/route.ts          # server-side provider call; no key material
    (dashboard)/page.tsx
  components/
    wallet/
    agent/
    mandate/
    transaction/
    dashboard/
    activity/
  lib/
    ai/                          # schema and intent adapter
    solana/                      # connection, PDA, IDL client
    firewall/                    # deterministic message decoder/checker
    agent/                       # in-memory browser key lifecycle
    mandate/                     # read/write helpers and lamport conversion
    security/                    # message identity and validation helpers
  programs/
    tr_mandate/
      src/lib.rs
      Cargo.toml
  tests/
    tr_mandate.ts
    firewall.test.ts
    intent.test.ts
  docs/
    M0_ENVIRONMENT_AUDIT.md
    M0_IMPLEMENTATION_PLAN.md
    decisions/
```

Keep generated IDL/types in the normal Anchor workspace output and consume the generated IDL in the web client; avoid hand-maintained duplicate instruction layouts.

## Anchor program design

### Accounts and seeds

- `Mandate` PDA: seeds `[b"mandate", owner.key().as_ref()]`.
- `Vault` PDA: seeds `[b"vault", mandate.key().as_ref()]`.
- Store owner, agent, fixed recipient, `max_per_tx`, `daily_limit`, `spent_today`, UTC `day_index`, `expires_at`, `nonce`, `revoked`, and bump(s). Include an explicit version/discriminator accounting in space calculations. Prefer `i64` Unix timestamps/day index and `u64` lamports/counters; define whether zero agent is allowed only during setup.
- Calculate account allocation explicitly from Anchor discriminator (8 bytes), Pubkey sizes (32 bytes each), integer sizes, booleans, and bumps; use `InitSpace` if supported by the selected Anchor version and still verify the resulting exact size.

### Vault ownership choice

Use a **system-owned, zero-data PDA vault** controlled through PDA signer seeds in System Program transfers. At initialization, create/fund the PDA by transferring lamports from the owner payer to its derived address; keep it owned by the System Program with zero data. For outbound payments and owner withdrawals, CPI to System Program `transfer` with the vault PDA signer seeds. This is a single ownership model and avoids manual lamport mutation on program-owned data accounts.

Validate the vault address, `system_program` ownership, empty data, and PDA derivation on every instruction. Keep `Rent::minimum_balance(0)` as the non-spendable reserve and require `lamports >= reserve + amount` before outbound CPI. Owner is required for withdrawal; agent is required for payment. Deposit is owner-authorized and transfers from owner to vault. Confirm this behavior with local-validator tests before deployment; do not use `init` to create a data-bearing, program-owned vault or mutate lamports directly under this design.

### Instructions and invariants

- `initialize_mandate`: owner signer/payer, mandate initialized, vault PDA funded/created as system-owned zero-data account, validated limits/recipient/expiry.
- `deposit`: owner signer and positive lamports; system transfer into vault.
- `execute_payment`: registered agent signer only; exact fixed recipient, nonzero amount, mandate active/not expired/not revoked, correct UTC day (`unix_timestamp.div_euclid(86_400)`), daily counter reset on day change, amount within per-tx and remaining daily allowance, exact nonce, sufficient vault balance after preserving rent. Perform CPI and state updates atomically; use checked arithmetic.
- `withdraw`: owner signer; positive bounded amount, vault reserve retained. Permit recovery regardless of agent revocation (and consider allowing after expiry); avoid accidental withdrawal semantics that let agent drain.
- `revoke_agent`: owner signer; set revoked; no way for agent to unset it.
- `update_mandate`: owner signer; validate each new value and define nonce policy. Increment nonce or rotate agent when changing authority-sensitive fields so stale built transactions cannot reuse old assumptions.

Avoid floating point in Rust and security-critical client logic. Represent SOL UI input as a decimal string and convert to integer lamports with exact decimal parsing/BigInt, bounded to `u64`.

## Frontend and agent architecture

- Next.js App Router, TypeScript, Tailwind, responsive dark charcoal/teal UI.
- Connect wallet with a maintained Solana wallet-standard adapter, chosen and version-pinned in M2. Wallet signs owner actions and pays setup/deposit fees.
- Generate a dedicated agent keypair in browser memory using cryptographically secure randomness. Do not put secret bytes in storage, cookies, API calls, logs, telemetry or React persistence. Clear references on teardown where practical. Agent signs only the execute-payment transaction; it is fee payer where the mandated account and transaction design permit.
- If page refresh loses the agent secret, explain that a new identity must be generated and authorized. Do not provide a misleading recovery mechanism.
- Read mandate/vault state from Devnet; show confirmed chain results only. Provide revoke and owner withdrawal controls.

## AI provider integration

- One server route calls Gemini or Groq using a server-side environment key. Keep the provider behind a small adapter so a fallback provider can be chosen without changing transaction security code.
- Strict Zod schema for `{ action: "transfer_sol", amountSol, recipient, purpose, requestedByUser }`. Treat model output as untrusted. Reject unsupported/missing fields, ambiguous recipients, malformed public keys, non-finite or non-positive amounts, over-precision, and amounts that cannot safely convert to `u64` lamports.
- Natural language must resolve to the one mandate-approved recipient. If user wording or recipient is ambiguous, ask the user to clarify; never infer from unrelated chat context.
- AI only parses and explains. Deterministic code and on-chain state decide whether it is eligible; never accept model-supplied program IDs, instructions, or safety decisions. Never send wallet or agent secrets to the provider.

## Transaction firewall

- Construct only the generated Anchor `execute_payment` instruction. Expected signer, agent fee payer, program ID, discriminator, mandate PDA, system-owned vault PDA, fixed recipient, readonly/system program metas, amount, and nonce all derive from verified local state and the generated IDL.
- Require exactly one instruction and expected fee payer. Decode actual compiled transaction instruction bytes and account indices, resolve static keys (and v0 address lookup tables only if support is intentionally implemented; MVP should reject v0/lookup-table messages), and compare program ID, discriminator, decoded args, ordered account keys/metas, signer/writable flags, and no extra writable keys against an independently reconstructed expected message.
- Simulate the unsigned transaction with supported `Connection.simulateTransaction` options for the pinned web3.js version. Fail closed on RPC error, program error, missing expected logs/result data, unsupported message format, or any mismatch. Be explicit that standard RPC simulation does not provide authoritative post-state for every account effect; fetch pre/post account balances where the supported API permits and do not claim simulation proves safety.
- Prefer deterministic checks available from simulation metadata: no error, expected program invocation only, fee payer and account deltas within expected bounds. If reliable post-simulation balances are unavailable, report that limitation and still rely on strict message checks plus on-chain mandate enforcement; do not fabricate effects.
- Agent signs the inspected transaction. Serialize and compare the signed transaction's message bytes to the inspected message before submitting. Submit with preflight enabled and confirm using the same recent blockhash strategy. Render “confirmed” only after RPC confirmation succeeds; persist signature and decision/rejection reason in client-side activity state for the demo (not secret material).
- Simulation is a point-in-time diagnostic, not a guarantee. The program rechecks mandate, nonce, time, recipient, limits and vault balance at execution.

## Testing strategy

- Anchor local-validator positive and negative integration tests for initialization, deposit, payment, withdrawal, update, revocation, expiry, nonce, daily rollover, amount boundaries, reserve preservation, wrong identities, and arithmetic failures.
- Keep a focused set of TypeScript unit tests for exact SOL-to-lamports conversion, intent schema, IDL-driven transaction construction/decoding, account-meta checking, signature/message identity, and fail-closed simulation outcomes.
- Test actual generated Anchor instruction bytes and account ordering; do not hand-wave discriminator or Borsh layout.
- Add malicious/altered transaction cases: alternate program, extra instruction, altered account, recipient/amount/nonce, writable meta, message mutation, and RPC/simulation failure.
- Establish baseline toolchain and run `anchor build`, `anchor test`, frontend typecheck, and targeted unit tests as milestone work. Never report unrun tests as passing.

## Devnet deployment strategy

1. First validate local build/tests and deterministic program ID/keypair workflow.
2. Configure `Anchor.toml` explicitly for Devnet and confirm wallet path without printing wallet content. Use a dedicated test wallet and request a Devnet airdrop only when approved.
3. Deploy only the program to Devnet after local tests pass and owner explicitly approves that milestone action. Record program ID, deployment signature, cluster, tool versions, and verification evidence.
4. Initialize a fresh demo mandate, authorize a browser-generated agent, deposit small Devnet SOL, execute controlled test payment, then verify signature/recipient/vault/state using RPC.
5. Keep a documented redeploy path and avoid mainnet configuration or production custody claims.

## Weekend milestones and acceptance criteria

| Milestone | Scope | Acceptance criteria |
|---|---|---|
| M0 | Environment audit and plan | Completed audit/plan docs; no code or installation; stop for explicit approval. |
| M1 | Anchor mandate program | Builds with pinned toolchain; local positive and negative tests pass; vault ownership/reserve model verified; report and stop. |
| M2 | Wallet, agent, mandate, dashboard | Owner connects on Devnet; generates in-memory agent; initializes mandate, deposits, reads state, withdraws/revokes; transaction evidence and report; stop. |
| M3 | Intent + firewall | Schema rejects invalid/ambiguous intent; actual message inspection, simulation, message identity, and fail-closed tests pass; report and stop. |
| M4 | End-to-end Devnet | Confirmed permitted payment; excessive amount, wrong recipient, revoked agent rejected; verified balances/state/signatures; evidence report; stop. |
| M5 | Demo/submission | Focused demo script, screenshots, architecture/security narrative and submission text; claims backed by evidence; stop. |

## Complexity and weekend priorities

This is a high-complexity solo weekend build because the core value depends on a real Anchor program plus correctly decoded and simulated transactions. A polished broad dashboard is lower priority than secure state transitions, negative tests, and one verifiable native SOL payment.

Suggested order: (1) toolchain and smallest tested mandate program; (2) vault deposit/payment/withdraw/revoke with tests; (3) minimal wallet and mandate UI; (4) deterministic firewall tests and one server-side intent provider; (5) Devnet proof and concise demo. Defer visual polish and optional providers until the end-to-end chain flow is reliable. If time contracts, reduce UI scope, not the on-chain rules or transaction inspection.

## M0 blockers and approval needed

- Rust, Cargo, AVM, Anchor and Solana CLI need installation before M1 can build. Exact candidate commands and version policy are in `M0_ENVIRONMENT_AUDIT.md`; none were executed.
- A browser wallet and provider API key are not yet confirmed. AI key setup is needed only when M3 begins; never place it in client bundles.
- Owner approval is required before any installation or M1 implementation, as specified in the project brief. No later milestone starts without its own explicit approval.
