# MVP Security Review

Date: 2026-11-07 (Africa/Nairobi)

## Controls

- Lending verification now runs on the server. Caller fields are untrusted; no client ownership, mandate, price-freshness, approval, or risk flags are consumed as evidence.
- Live mode validates Solana public keys, fetches only the selected token account, checks account-program owner, mint, authority, token amount and initialized state, then independently derives and reads the owner's mandate and vault. It verifies the mandate program owner, discriminator, data length, owner, registered agent, nonce, expiry and revocation state, and reports the vault lamport balance.
- The current endpoint returns `UNAVAILABLE` for live lending because issuer allowlisting, trusted valuation, lending policy and liquidity are absent. A demo fixture can only return `DEMO_VERIFIED`, never `LIVE_VERIFIED`.
- The demo verifier recalculates value and ratios with `bigint`; it ignores any caller-supplied approval or evidence claims and validates the Groq proposal against a strict schema.
- Groq remains server-only, uses the existing model and 1,024 output-token cap, and cannot set deterministic evidence. Provider/schema failures do not silently substitute an assessment.
- Assessment endpoints do not submit transactions. No loan execution exists. M1 and its IDL were not changed.
- Request bodies are bounded; malformed requests fail; assessment/verification routes use process-local rate limits. Replay identifiers are process-local and bounded; this is documented as a limitation, not durable protection.
- The UI explains selected-asset data minimization and public-chain observability without claiming cryptographic privacy.

## Negative evidence

Unit/route tests reject excessive LTV, unauthorized borrower, stale valuation, wrong owner fixture, invalid/stale price, malformed proposal, forged `approved`/ownership fields, replay, and inactive mandate fixture. These are local tests. No live Devnet revocation was performed.

## Remaining risks

- RPC token-account reads do not prove issuer identity, genuine equity status, legal title, transferability, or collateral suitability. SPL-2022 extensions are not interpreted beyond base account fields.
- No trusted live price/valuation source, lending policy registry, borrower authority source, liquidity source, durable replay store or exposure ledger is configured.
- A process-local replay set and rate limiter are not production abuse or financial-risk controls.
- M1's on-chain mandate governs native SOL payment instructions, not equity collateral or USDC lending.
- No lending contract, custody, liquidation, repayment, privacy proof or execution path exists.

## Decision

**CONDITIONAL PASS for a clearly labeled demonstration assessment prototype.** Do not claim production lending, live equity-backed collateral, loan authorization or real loan execution.
