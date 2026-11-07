# Trust Trail Lending Security Review

## Controls implemented

- AI remains server-side, advisory and schema-constrained; the lending schema rejects extra fields such as `approved`.
- The lending verifier is separate from the native SOL payment firewall and computes money checks using `bigint` fixed-point arithmetic.
- Allowlisted asset and price-source checks, token-account owner equality, price freshness, proposal/input matching, borrower allowlist, mandate identity/activity/expiry, limits, duration, liquidity and a caller-supplied replay set fail closed.
- Malformed proposals and each listed policy failure produce machine-readable reason codes. The demo labels all fixture results `SIMULATED`.
- No lending execution method exists. The deployed M1 program and IDL are unchanged.
- Groq credentials remain server-only. No secrets or `.env.local` values were copied to source or documentation.

## Limits and risks

- The live asset, price, liquidity, borrower and lending-policy evidence adapters do not exist. Fixture verification is not proof of ownership or an executable policy decision.
- The replay set is supplied by the caller and is not durable or shared. It is sufficient only for isolated tests, not production replay prevention.
- The verifier runs in browser code over caller-supplied evidence, so it is a demo check only. It does not establish a trusted server decision or an on-chain authorization boundary.
- A live authorization path must independently verify mandate state and nonce against the chain at decision time. Existing M1 mandate limits govern native SOL payments only.
- Valuation rounding currently floors collateral value to micro-units. Production policy should explicitly select conservative precision rules and reject values that round to zero.
- The in-memory IP rate limiter is process-local and not a production abuse-control system.
- Token-account verification, token-2022 extensions, issuer status, oracle integrity, borrower consent, liquidation, repayment and loan settlement are not implemented.
- UI concealment does not provide cryptographic or on-chain privacy.

## Review decision

**CONDITIONAL PASS for a clearly labeled assessment prototype only.** No real collateral eligibility, loan authorization or settlement should be claimed. Add trusted adapters, durable replay/exposure controls and a dedicated lending enforcement program or verified protocol before any live lending use.
