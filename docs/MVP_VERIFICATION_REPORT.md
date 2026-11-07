# MVP Verification Report

Date: 2026-11-07 (Africa/Nairobi)

## Automated checks

| Check | Result | Evidence type |
|---|---|---|
| `cargo test --workspace` | PASS, 6 passed | Rust unit tests |
| `npm test` | PASS, 9 files / 73 passed; 1 optional test skipped | Unit tests and mocks, including API route and server-owned lending verifier |
| `TR_LOCAL_VALIDATOR_URL=http://127.0.0.1:8899 npm run test:local-integration` | PASS, 1 passed | Isolated local validator lifecycle |
| `npm run test:anchor` | PASS, 8 tests printed, 0 failures | Local validator using staged M1 artifact |
| `npm run typecheck` | PASS | TypeScript static check |
| `npm run lint` | PASS, no warnings | ESLint |
| `npm run build` | PASS | Next.js production build |
| Targeted secret scan | PASS; no embedded Groq key or private-key material found in changed source/docs; `.env.local` excluded | Static source scan |
| `git diff --check` | PASS | Whitespace and patch integrity |
| Groq lending request + `/api/lending/verify` | PASS, Groq HTTP 200; server decision HTTP 200 `DEMO_VERIFIED`, 3,000 bps LTV | Live Groq integration plus local app endpoint; evidence remains demonstration fixture |
| Devnet read-only mandate check | PASS at slot `519735404` | Live Devnet RPC; owner/agent/nonce/revocation/expiry/vault checked |

The first local integration attempt was run before starting a validator and failed to connect. It was rerun against a temporary local validator and passed. The first live Groq assessment requests exposed model output-shape and JSON-mode prompt requirements; after explicitly specifying JSON and exact schema keys, a real Groq request passed local schema validation. Those failed attempts were not counted as passing tests.

## Lending security cases

Server verifier unit cases passed for a valid 30% LTV demo, excessive LTV, unauthorized borrower, stale valuation fixture, forged approval claims, malformed proposal, and replay. Existing deterministic verifier fixtures continue to cover unsupported mint, wrong owner, zero collateral, invalid/future/stale price, minimum ratio, maximum loan, policy expiry, revoked agent, liquidity, duration, proposal tampering, replay and untrusted price source. No live token-account ownership case was available because no configured supported equity mint/account exists.

## Live Devnet state

The configured RPC returned the expected Devnet genesis. At slot `519735404`, mandate owner was `3iwLdajQozuaXyW9Ns9Hjz6GCUAjDLcFF9tSmR7qmkvp`, registered agent `CQ2MjiCcG4cbGMZzxHpwZauy9u8WLuJyXmkk2Tspfh8U`, nonce `1`, revoked `false`, expiry `1798578000`, and vault balance `50,650,240` lamports. No Devnet transaction was submitted. The existing M4.1 reports contain prior initialization and deposit signatures. No live revocation test occurred.

## Classification and result

Groq supplies advisory recommendation only; fixture evidence yields `DEMO_VERIFIED`. Live asset eligibility and valuation return `UNAVAILABLE` because no verified issuer asset, price, lending policy or liquidity integration is configured. There is no lending execution path. Overall result: **CONDITIONAL PASS** for the prototype demo, not production lending.
