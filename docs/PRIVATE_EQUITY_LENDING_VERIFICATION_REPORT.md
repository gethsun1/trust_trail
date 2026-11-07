# Trust Trail Lending Verification Report

Date: 2026-11-07 (Africa/Nairobi)

## Automated checks

| Command | Result | Evidence type |
|---|---|---|
| `npm run typecheck` | PASS | TypeScript static check |
| `npm test` | PASS, 7 files / 64 tests passed; 1 optional local-validator test file skipped | Unit tests and mocks; includes 20 lending fixture verifier cases |
| `npm run lint` | PASS | ESLint |
| `npm run build` | PASS | Next.js production build |
| `TR_LOCAL_VALIDATOR_URL=http://127.0.0.1:8899 npm run test:local-integration` | PASS, 1 lifecycle test | Local validator, isolated `/tmp` ledger |
| `npm run test:anchor` | PASS, 11/11 | Local validator + existing staged M1 artifact; no Devnet transaction |

The validator was stopped after the local tests. No Rust source, deployment settings, deployed M1 program or IDL changed.

## Lending test coverage

The unit fixture suite covers a valid 30% LTV calculation, unsupported mint, wrong token-account owner, zero collateral, nonpositive/future/stale price, excessive LTV, insufficient collateral ratio, excessive loan, unauthorized borrower, expired policy, revoked agent, missing liquidity, excessive duration, tampered proposal, replay, untrusted price source, attempted `approved` field, and `NEEDS_REVIEW`. These are test fixtures, not Devnet ownership or price verification.

## Live Devnet evidence

No Devnet transaction was submitted or needed. Existing `docs/M4_1_VERIFICATION_REPORT.md` independently verifies initialization and a 50,000,000 lamport deposit. The latest recorded account snapshot has 50,650,240 vault lamports including the 650,240 rent reserve. No equity ownership, valuation, loan or remaining M4.1 lifecycle action is established here.

## Live Groq regression check

With configured server-side credentials (values not recorded), a valid instruction was POSTed to the existing `/api/intent` route. Before the fix it returned HTTP 502. Safe server logs showed `AI_REQUEST_REJECTED_JSON_VALIDATE_FAILED`; a provider diagnostic showed completion ended before a valid JSON document because the 300-token completion limit was exhausted. Raising the cap to 1,024 returned HTTP 200 with a ready intent for 10,000,000 lamports. The route's validation independently checked that amount. No credential or authorization token is included here.

The new lending Groq route compiles and enforces strict response schema, but was not live-called with fabricated collateral inputs. The UI fixture path does not contact Groq.

## Classification

Lending firewall evidence is unit-test/fixture only. The payment intent regression is a live Groq/API request. Mandate facts come from prior Devnet evidence. No live portfolio check, lending execution or ownership privacy proof occurred.
