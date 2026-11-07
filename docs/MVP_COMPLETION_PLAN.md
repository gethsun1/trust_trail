# MVP Completion Plan

Date: 2026-11-07 (Africa/Nairobi)

## Baseline

The repository already contains the rebranded dashboard, wallet adapter, live M1 mandate client, existing Groq routes, lending proposal schema, fixed-point browser verifier, and demo UI. The main security gap was that lending verification ran in browser code against caller-supplied evidence. The repo has no verified equity mint, trusted valuation, application lending policy, borrower registry, real lending liquidity, durable replay store, or settlement integration.

The worktree was clean at the start. No existing user changes needed preservation. No `.env.local` values were copied into source or reports. The deployed M1 program and IDL remain unchanged.

## Minimum changes made

1. Added `POST /api/lending/verify`. The live mode parses public keys, reads the selected SPL/SPL-2022 token account, checks mint, authority, state and positive quantity, then independently reads the owner's derived mandate and vault. It returns `UNAVAILABLE` for lending because no verified issuer allowlist, live price, or lending policy/liquidity source is configured.
2. Added a server-owned demo fixture verifier. It uses integer arithmetic for collateral value, LTV and collateral ratio, enforces its isolated sample policy, emits evidence source/time/policy/reasons, rejects duplicate proposal IDs within the process, and never routes transactions.
3. Reworked the Lending Agent action to call the existing Groq assessment API, then call the verification endpoint. AI output and server decision are rendered separately. Groq failures surface without a fallback assessment.
4. Added explicit privacy and valuation disclosures, negative fixture scenarios for excessive LTV, unauthorized borrower and stale price, and endpoint tests for fabricated approval claims and malformed requests.
5. Updated the requested implementation, security, verification and demo reports with the observed evidence and remaining limits.

## Required boundaries

`LIVE_VERIFIED` is unreachable with the currently configured evidence. A live token account can be checked for account authority, mint and amount, but that alone does not establish tokenized equity issuer identity, transferability, collateral eligibility or value. The live M1 mandate governs native SOL only. The assessment endpoints cannot authorize financial actions or submit transactions. Replay tracking is bounded and process-local, not durable exposure control.
