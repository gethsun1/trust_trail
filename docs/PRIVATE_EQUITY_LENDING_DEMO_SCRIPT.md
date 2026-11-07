# Trust Trail Demo Script

## Current prototype walkthrough

1. Open Trust Trail and point out the Solana Devnet identity banner and the five primary destinations.
2. Connect Phantom only if owner-authorized mandate actions are being demonstrated. The Overview's equity collateral state should read unavailable, not zero-valued collateral.
3. Open Portfolio. Explain that the app does not enumerate the full wallet; no issuer-verified equity mint or trusted price source is configured, so ownership and valuation remain unavailable.
4. Open Lending Agent. Show the fixture selector and explain that its values are test-only, generated locally, and never sent to RPC, Groq or a wallet.
5. Run the 30% LTV fixture: the fixed-point verifier reports a simulated verification result. This does not establish asset ownership or a real lending decision.
6. Run Excessive LTV: expect `EXCESSIVE_LTV` (and other relevant policy reasons when inputs trigger them).
7. Run Unauthorized borrower: expect `UNAUTHORIZED_BORROWER`.
8. Point out the execution boundary: settlement is not implemented. M1's native SOL payment instruction cannot issue an equity-backed or USDC loan.
9. Open Mandate and show owner-controlled M1 operations as native SOL only. Existing policy edits, revocation/reactivation and withdrawal remain distinct from lending policy.
10. If demonstrating M3, use an explicit SOL instruction and explain that its firewall verifies unsigned native SOL payment bytes; it does not sign or submit transactions.

All lending scenarios above use fixtures. No live equity ownership, valuation, loan, collateral lock or privacy proof is demonstrated.
