# Private Equity Lending Implementation Plan

1. **Reuse:** Solana wallet, Devnet identity verification, M1 mandate/vault reads and owner controls, browser agent identity, M3 Groq server integration, and unsigned SOL transaction firewall.
2. **Modify:** dashboard brand/navigation and executive overview; separate existing SOL mandate actions from lending eligibility; make intent route errors more actionable without exposing provider details.
3. **Add:** strict lending proposal schema, integer-only collateral/LTV calculation, policy verifier with reason codes, negative tests, and Portfolio/Lending Agent views that state the current adapter boundary.
4. **Live Devnet:** wallet/mandate/vault reads only. Equity mint ownership, pricing, loan liquidity and settlement are not available from verified project configuration. Do not imply otherwise.
5. **Simulated:** fixture lending assessment and rejection scenarios may demonstrate verifier behavior, visibly marked DEMO DATA/SIMULATED. They cannot qualify a real proposal or execute a loan.
6. **Blockers:** verified asset mint and issuer, trustable valuation source and freshness policy, liquidity source, dedicated lending contract/protocol, and live Phantom browser validation. Remaining M4.1 lifecycle operations are not established by the deposited state.

Implementation order: secure fixed-point verifier and tests; add clear portfolio/lending views; integrate without connecting lending to `execute_payment`; run the requested application suites and report mocked/local/live evidence separately.
