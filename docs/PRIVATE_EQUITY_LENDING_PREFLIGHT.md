# Trust Trail Private Equity Lending Preflight

Date: 2026-11-07 (Africa/Nairobi)  
Branch: `main`  
HEAD at audit: `b3d0a9159cb9541141804500309d379c28231266`

## Repository state and preservation

The working tree began with a user modification to `Anchor.toml` and untracked M4.0/M4.1 deployment and lifecycle reports. Those files are preserved. `.env.local` was checked only for whether relevant variables are present; secret values were not read or emitted. No reset, cleanup, dependency change, deployment or commit is part of this work.

## Existing implementation

- **M1 / live Devnet:** `tr_mandate` at `7hucMRtxEjUYn9hbKPsByneQmmu4Qrv7qDgaVG59ryEY` provides native SOL mandates and vault operations. It has no tokenized-equity collateral, USDC lending, loan accounting, LTV enforcement, liquidation or repayment.
- **M2:** `components/dashboard.tsx`, `lib/chain.ts`, `lib/mandate.ts` and `lib/agent-vault.ts` provide wallet connection, owner-authorized mandate lifecycle, account reads, agent identity and encrypted backup. Preserve these paths.
- **M3:** `lib/server/groq.ts`, `lib/server/intent.ts`, `/api/intent` and `/api/firewall` provide server-side payment intent extraction and an unsigned-transaction firewall. AI output is not signing authority. The payment firewall remains a distinct legacy SOL path.
- **M4.1 Devnet evidence:** `docs/M4_1_VERIFICATION_REPORT.md` verifies initialization and the exact 50,000,000 lamport deposit. Latest snapshot: 50,650,240 lamports in the vault, 650,240 rent reserve, 50,000,000 spendable. Policy update, revoke, reactivation and withdrawal are unverified. This supersedes the earlier pre-deposit status in `M4_1_PREFLIGHT_AUDIT.md`.
- **UI:** one client dashboard and global dark styling; current navigation exposes Overview, Mandate, Vault, Agent identity, Activity and Intent firewall. No portfolio or lending workflow exists.
- **Tests:** Vitest frontend unit/mocked suites, optional local-validator integration, and Anchor program tests. No existing equity ownership or lending tests.
- **Configuration:** server-only `GROQ_API_KEY`, default `GROQ_MODEL=openai/gpt-oss-20b`; Devnet RPC is configured. Never expose the env values.

## Root-cause status: `INTENT_UNAVAILABLE`

The route deliberately maps provider and validation errors to `INTENT_UNAVAILABLE`, while logging only a sanitized internal error category. Presence checks show the Groq key and model variables exist, but do not establish that the key is valid or that the configured model supports the request. The route's status mapping identifies missing key/unsupported model and rate limits, but several validation errors become generic 502s; malformed/unsupported provider structured-output responses also map to the generic UI result. A live provider request is needed to prove a particular credential/model/provider failure. Changes in this implementation make the error category mapping precise and preserve safe client-facing messages; they do not hardcode a successful result.

## Asset and privacy blockers

No verified tokenized-equity mint allowlist, issuer relationship, approved Devnet market, trusted price feed, price freshness policy, loan liquidity source or lending program integration is present. No real asset ownership or valuation can therefore be claimed. Portfolio discovery must remain selected-asset and opt-in, and no entire portfolio or personal wallet inventory should be sent to Groq. UI-only hiding is not privacy from RPC providers or the public chain.

## Scope decision

Reuse the wallet, identity, Devnet, mandate, vault and legacy payment-firewall components. Add a fixed-point lending policy/verifier and strict proposal schema as a standalone boundary. Add clearly labeled fixture assessment only, with no transaction execution. Rebrand the dashboard navigation and provide honest unavailable states for live ownership and valuation. Do not modify or redeploy M1.
