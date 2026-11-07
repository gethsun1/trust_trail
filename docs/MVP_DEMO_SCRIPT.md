# MVP Demo Script

Date: 2026-11-07 (Africa/Nairobi)

## Setup and honesty cues

1. Open Trust Trail and connect Phantom on Solana Devnet.
2. Show the live mandate owner, agent, nonce, revocation state, expiry and vault balance. Explain that the deployed M1 mandate controls native-SOL payments only.
3. Open Portfolio. Point out that no issuer-verified Devnet equity mint or trusted live quote is configured. The UI does not scan the wallet portfolio.
4. Read the disclosure: “Trust Trail limits portfolio information to the selected asset required for this assessment. Public Solana account and transaction data may still be observable on-chain.”

## Valid demonstration assessment

1. In Lending Agent, select **Valid · 30% LTV** and click **Assess lending opportunity**.
2. The browser calls the existing Groq assessment API. Show its structured recommendation separately from the server decision.
3. The server verifier checks a server-owned fixture policy and timestamp and recalculates the $1,000 fixture collateral / $300 request using integer arithmetic.
4. Expected result: `DEMO_VERIFIED`, LTV `30.00%`, source clearly says demonstration fixture, and settlement `NOT_IMPLEMENTED`.
5. Explain that this verifies deterministic behavior against sample inputs, not real equity or a real loan.

## Negative cases

- Select **Excessive LTV**. Expected server result: `REJECTED` with `EXCESSIVE_LTV`.
- Select **Unauthorized borrower**. Expected server result: `REJECTED` with `UNAUTHORIZED_BORROWER`.
- Select **Stale valuation**. Expected server result: `REJECTED` with `STALE_PRICE`.
- If Groq is unavailable or returns invalid schema, the action displays an error and creates no assessment; there is no stale or static fallback.

## Live ownership adapter boundary

The `live` mode of `POST /api/lending/verify` accepts an owner key, selected mint and token-account address, fetches the account independently from configured Devnet RPC, checks token program, mint, authority, amount and state, and reads the derived mandate/vault. Even with a valid token account it returns `UNAVAILABLE` until verified issuer identity, trusted price, lending policy, borrower eligibility and liquidity exist. Do not demonstrate an ordinary test token as stock.

No action in this demo signs a lending transaction, moves collateral, draws a loan, or submits a financial transaction.
