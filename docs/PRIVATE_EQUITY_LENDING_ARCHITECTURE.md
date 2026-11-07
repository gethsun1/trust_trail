# Trust Trail Lending Architecture

## Existing authority path

The connected Solana wallet remains the owner identity. The existing `tr_mandate` program is deployed on Devnet and manages a native SOL vault and recipient payment mandate. It does not understand equity collateral or loan settlement. Existing M2 agent backup, mandate management and M3 unsigned payment firewall remain isolated and intact.

## Lending assessment path

1. A future asset adapter must identify one issuer-supported mint and verify the selected token account's mint, token-program ownership, token-account owner, amount and decimals.
2. A trusted price adapter must provide an asset-bound fixed-point price, source identity and timestamp. Liquidity must likewise be independently sourced.
3. `/api/lending/assess` accepts only a compact opportunity payload and calls the existing server-only Groq provider. The response is a strict `PROPOSE | REJECT | NEEDS_REVIEW` schema. It cannot express `approved: true` and is not an authority.
4. `verifyLendingProposal` checks the strict schema, owner/account identity, allowlisted mint and price source, freshness, exact proposal fields, integer valuation, LTV, collateral ratio, borrower policy, duration, liquidity, exposure, active agent mandate, expiry and replay set. It returns machine-readable reason codes. In this prototype it runs in the browser against caller-supplied evidence; it is not an authoritative server or on-chain decision.
5. Settlement is unavailable. Never pass a lending proposal to M1 `execute_payment`.

Financial values use integer micro-units and `bigint`; LTV is compared by cross multiplication and reported with conservative ceiling division. The interface's fixture flow uses test-only labels and local in-memory fixture values; it never calls RPC, Groq or a wallet.

## Privacy boundary

The portfolio UI does not enumerate all token accounts or send portfolio contents to the AI provider. This is data minimization, not ownership privacy: Solana account reads and public-chain state are visible to RPC operators and observers. No selective-disclosure proof, confidential balance or issuer attestation exists in this implementation.

## Unavailable live dependencies

No verified supported equity mint, issuer mapping, valuation oracle/feed, liquidity source, borrower registry, durable exposure ledger or dedicated lending program is configured. Therefore live equity ownership, valuation, collateral eligibility and loan execution are unavailable.
