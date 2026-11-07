# M3 Verification Report

Date: 2026-11-07

## Results

| Check | Result | Evidence |
|---|---|---|
| `npm run typecheck` | PASS | TypeScript completed without errors. |
| `npm test` | PASS | 6 files passed, 44 tests passed, 1 existing test skipped (local integration requires `TR_LOCAL_VALIDATOR_URL`). |
| `npx vitest run tests/frontend/intent.test.ts tests/frontend/firewall.test.ts` | PASS | 2 files passed, 28 M3 tests passed. |
| `npm run lint` | PASS | ESLint completed without errors. |
| `npm run build` | PASS | Next.js production build generated `/api/intent`, `/api/firewall`, and `/api/health` as dynamic Node routes. |
| M3 intent/firewall tests | PASS | Included in `npm test`; Groq calls are mocked. No live API key is needed. |
| `npm run test:anchor` | PASS | 11 Anchor program integration cases passed against a temporary local validator loading the existing `target/deploy/tr_mandate.so`. |
| `TR_LOCAL_VALIDATOR_URL=http://127.0.0.1:8899 npm run test:local-integration` | PASS | Existing M2 frontend lifecycle test passed against the same local validator. |
| `~/.cargo/bin/cargo fmt --check` | PASS | Rust formatting clean. |
| `~/.cargo/bin/cargo test --workspace` | PASS | 6 Rust unit tests passed; 0 failed. |
| `~/.cargo/bin/cargo clippy --workspace --all-targets -- -D warnings` | PASS | Strict Clippy completed without warnings. |
| `git diff --check` | PASS | No whitespace errors. |
| Tracked secret scan | PASS | 0 findings for Groq-shaped key patterns or public-prefixed Groq key usage. |
| Browser bundle scan | PASS | 13 files checked; 0 Groq key/provider/auth markers in `.next/static`. |
| Actual Groq API smoke test | PASS | Production `next start` returned HTTP 200 and a validated `ready` `native_sol_payment` intent for synthetic text; the API key and HMAC token were not printed. |
| Devnet deployment/transaction | NOT RUN | No Devnet deployment, signature or transfer is claimed. |
| Anchor CLI build | NOT RUN | Anchor CLI is not installed. |
| SBF build | INCOMPLETE | The installed `cargo-build-sbf` was invoked with a `/tmp` output directory and cargo PATH set, but emitted only the crate-type warning and made no further progress; it was interrupted after 2m45s. The existing program binary was used only to run local-validator tests. |

## Exact command sequence

```text
npm run typecheck
npm test
npx vitest run tests/frontend/intent.test.ts tests/frontend/firewall.test.ts
npm run lint
npm run build
npm run test:anchor
TR_LOCAL_VALIDATOR_URL=http://127.0.0.1:8899 npm run test:local-integration
~/.cargo/bin/cargo fmt --check
~/.cargo/bin/cargo test --workspace
~/.cargo/bin/cargo clippy --workspace --all-targets -- -D warnings
PATH=/home/farmers-boy/.cargo/bin:$PATH /home/farmers-boy/.local/share/solana/install/active_release/bin/cargo-build-sbf --manifest-path programs/tr_mandate/Cargo.toml --sbf-out-dir /tmp/trust-trail-m3-sbf  # incomplete; interrupted after 2m45s
git diff --check
```

The temporary test validator used `solana-test-validator --reset --quiet --ledger /tmp/trust-trail-m3-ledger --bpf-program 7hucMRtxEjUYn9hbKPsByneQmmu4Qrv7qDgaVG59ryEY target/deploy/tr_mandate.so`. The validator was stopped after tests. The binary in `target/deploy` predates this M3 work; no build or deployment to Devnet occurred.

## Evidence classification

- **Mocked Groq tests:** intent schema, field/provenance checks, malformed response, provider error, 429 and timeout.
- **Actual Groq API smoke:** one synthetic prompt on production `next start`; it returned a validated ready intent. No real recipient, user prompt, signature, or transaction was used.
- **Deterministic local firewall tests:** local unsigned transaction fixtures for match, tampered data, reordered accounts, unknown program, direct transfer/extra instruction, recipient/amount substitution, nonce, revoked/expired mandate, policy limits, balance and missing mandate.
- **Local validator:** existing Anchor test suite and M2 frontend lifecycle only.
- **Devnet:** no transaction or deployment evidence.
