# M4.1 Devnet Mandate Lifecycle Implementation Plan

Date: 2026-11-07 (Africa/Nairobi)  
Status: **Initialization verified on Devnet; remaining live owner-wallet actions blocked on browser control.**  
Preflight: [M4.1 Preflight Audit](M4_1_PREFLIGHT_AUDIT.md)

## Current implementation baseline

The M2 frontend already contains the Devnet-gated, owner-wallet operations required for the mandate lifecycle. It uses the committed IDL and the connected wallet to build and submit owner-authorized instructions, then confirms the signature and reloads RPC state. The existing local-validator integration test covers initialize/read, deposit/read balance, policy update, revoke, reactivate and withdrawal with rent-reserve checks. Accordingly, implementation work should begin with gap verification against this code rather than duplicating transaction functionality.

## Gate before product changes or Devnet writes

The user reports Phantom is connected and supplied its public key. The user then approved initialization: signature `2qdCizKoPLwcEDQbpQzgzj8J4KSS3rztZ3ogWFr8GUQQ3UDXoLsP3YRUFA1jz572sZ2GYqsE8FRqUZGCLPrueYcR` finalized at slot `519703320`, and independent reads verified the new mandate and vault. This agent environment cannot inspect or drive the user's browser tab to present later actions. Do not select the deployment authority by default. The owner must review each action and approve it in Phantom. Never request or transmit private keys, recovery phrases or encrypted agent backups.

## Work sequence after the gate is cleared

1. **Reconfirm read-only context:** recheck branch/worktree, configured RPC genesis hash, executable program address, program ID versus committed IDL, and connected app RPC identity. Keep Devnet explicit; do not change Solana CLI or Anchor defaults.
2. **Close code/test gaps only:** review actual UI rendering and handlers against requirements. Existing `npm test`, typecheck, client lifecycle local-validator integration and Anchor local-validator tests pass (see verification report). Add tests only for missing coverage: identity/PDA/decoder; initialization and agent-key match; deposit preview and rent/account reread; update/revoke/reactivate/withdraw semantics; wrong-network and RPC failures. Label each as mocked, local-validator or Devnet.
3. **Owner initialization — complete:** initialized with the separate agent identity and verified owner/agent/recipient/policy fields, mandate and vault addresses, finalized signature, and rent-reserve balance. Evidence is in the verification report.
4. **Small Devnet deposit:** show exact SOL amount and destination vault before signing; keep the amount small and leave reserve untouched. Confirm the signature, then independently fetch mandate state and vault lamports from Devnet. Record signature, slot/commitment, account addresses and balances.
5. **Policy lifecycle:** exercise policy update, revoke, reactivate and withdrawal using dedicated Devnet accounts and small amounts. Before and after each action independently read account state. Confirm that policy update does not clear revocation, nonce and spending history persist according to M1, expiry remains strict, reactivation is owner-authorized and withdrawal leaves rent reserve.
6. **Evidence and review:** record exact commands, tool versions, RPC identity, account addresses, signatures, confirmed state and balances. Keep mock/local/Devnet results distinct. Produce `M4_1_IMPLEMENTATION_REPORT.md`, `M4_1_SECURITY_REVIEW.md` and `M4_1_VERIFICATION_REPORT.md`, with PASS / CONDITIONAL PASS / BLOCKED classification and limitations.

## Guardrails

- Do not implement or submit `execute_payment`, autonomous execution, token support or arbitrary program execution.
- Do not alter M1 financial authorization semantics or deploy/upgrade the program.
- Preserve all existing M3 and M4.0 work and all uncommitted files.
- Never use the deployment authority as owner without direct confirmation from the application owner.
- Do not commit or push without explicit approval.
- Stop after M4.1; M4.2 requires separate review and approval.

## Current result

Phase 1 read-only checks passed against the configured RPC: it returned the expected Devnet genesis hash and an executable account at the expected program ID. The supplied owner initialization is finalized and independently verified; the vault currently contains only its rent reserve. M4.0 prior evidence records deployed bytes and IDL matching local artifacts. Repo unit/typecheck/local-validator suites pass. Deposit and policy lifecycle operations remain **BLOCKED** because this agent cannot read the app state or control the Phantom approval tab. No additional Devnet transaction has been sent.
