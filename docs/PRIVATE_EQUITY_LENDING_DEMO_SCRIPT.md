# Trust Trail Lending Demo Script

## Current prototype walkthrough

1. Open Trust Trail and point out the Solana Devnet identity banner and the five primary destinations.
2. Connect a wallet only if demonstrating owner-authorized mandate actions. M1 controls native SOL only.
3. Open Portfolio. Explain that the app does not enumerate the full wallet. No issuer allowlist or trusted price source is configured, so live equity eligibility and valuation are unavailable.
4. Open Lending Agent. Explain that the assessment inputs are fictional demonstration values and that the selected scenarios do not represent collateral or loan transactions.
5. Run **Valid · 30% LTV**. The browser requests an advisory proposal from Groq through `POST /api/lending/assess`, then submits it to `POST /api/lending/verify`. The server independently verifies it against server-owned fictional evidence.
6. Expected demo result: `DEMO_VERIFIED`, a recalculated LTV, demonstration-fixture evidence, and `NOT_IMPLEMENTED` settlement. Groq's recommendation remains advisory and is not authority.
7. Run **Excessive LTV**, **Unauthorized borrower**, and **Stale valuation** to show deterministic negative results from the server verifier.
8. Explain the live path: verification independently reads the selected SPL/SPL-2022 token account and derived native-SOL mandate/vault from Devnet. Even then, lending eligibility is unavailable without an issuer allowlist, trusted valuation, lending policy, borrower registry, and liquidity source.
9. Point out that the M1 program controls native SOL only. No tokenized-equity collateral lock, loan settlement, liquidation, or repayment is implemented.
10. Explain that selective disclosure means data minimization, not cryptographic privacy; Solana account state and RPC queries can be observed.

The lending walkthrough makes no real collateral, loan, transfer, or lending transaction. Replay detection and rate limiting are process-local and are not shared across server instances.
