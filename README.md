# Trust Trail (`tr`)

**Think. Verify. Authorize. Execute.**

Trust Trail is a Solana Devnet prototype for owner-controlled mandates and AI-assisted lending assessment. Its product direction is privacy-aware lending against tokenized equity: an AI agent may assess an opportunity, deterministic checks evaluate it against supplied policy evidence, and the owner retains control of supported on-chain actions.

> **Prototype status:** The deployed program handles native SOL mandates and payments only. Tokenized-equity ownership verification, trusted valuation, liquidity, loan accounting, collateral locking, liquidation, repayment, and loan settlement are not implemented. Lending screen scenarios use local fixtures and must not be represented as live collateral or a real loan.

## What works today

| Capability | Status | Notes |
|---|---|---|
| Solana wallet connection | Implemented | Wallet Standard-compatible connection in the browser, including Phantom when available. |
| Separate agent identity | Implemented | Browser-generated identity; encrypted IndexedDB backup uses PBKDF2 and AES-GCM. |
| Devnet identity check | Implemented | The application checks the configured RPC genesis hash before enabling mandate operations. |
| Native SOL mandate and vault | Live on Devnet | Owner-authorized initialize, deposit, policy update, revoke, reactivate, and withdrawal paths. |
| AI interpretation of native SOL payment requests | Implemented | Server-side Groq structured output. Its result is untrusted and is not authority to execute. |
| Native SOL payment firewall | Implemented | Decodes the actual unsigned transaction and compares it with the signed intent and current mandate. It does not sign or submit the transaction. |
| Equity portfolio ownership and valuation | Unavailable | No supported issuer-verified mint or trusted price source is configured. The app does not enumerate the wallet's entire token portfolio. |
| Lending proposal verification | Fixture-only | Integer/fixed-point verifier and negative tests exist. The UI uses local test data, not live ownership, price, liquidity, policy, or mandate evidence. |
| Lending transaction settlement | Not implemented | Never route lending through the M1 native SOL payment instruction. |

The current Devnet program address is [`7hucMRtxEjUYn9hbKPsByneQmmu4Qrv7qDgaVG59ryEY`](https://explorer.solana.com/address/7hucMRtxEjUYn9hbKPsByneQmmu4Qrv7qDgaVG59ryEY?cluster=devnet). The configured application RPC is checked against Devnet genesis hash `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`.

## Technology

- Next.js App Router, React, TypeScript, Tailwind CSS
- Solana Wallet Adapter / Wallet Standard, `@solana/web3.js`, Anchor TypeScript client
- Anchor and Rust program `tr_mandate`
- Groq Chat Completions API, with default model `openai/gpt-oss-20b`; all provider access is server-side
- Zod structured input/output validation
- Vitest for frontend, API-helper, and lending-verifier tests; Node test runner for Anchor program tests

## Run locally

### Prerequisites

- Node.js and npm compatible with the versions used by this repository's Next.js toolchain
- For Anchor program builds/tests: Rust toolchain pinned in `rust-toolchain.toml`, Anchor and Solana CLI versions pinned in `Anchor.toml`, and a local Solana test validator
- A Groq API key is optional for the application. Without it, AI assessment and intent interpretation return an unavailable state.

### Install and configure

```bash
npm ci
cp .env.example .env.local
```

Edit `.env.local` locally:

```dotenv
# Optional: verified HTTPS RPC endpoint; the app defaults to Solana Devnet.
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com

# Optional; server-side only. Never use a NEXT_PUBLIC_ prefix.
GROQ_API_KEY=
GROQ_MODEL=openai/gpt-oss-20b
```

Keep `.env.local`, wallet keypairs, agent secrets, and encrypted backup exports out of version control. Do not paste secret values into issue reports or logs. The application only accepts HTTPS RPC URLs for browser configuration and verifies that the endpoint is actually Devnet before enabling owner mandate actions.

### Start the app

```bash
npm run dev
```

Open the local Next.js URL printed by the development server. Connect a wallet to read its mandate account. Owner actions require the verified Devnet connection and wallet approval. The lending fixture flow is local-only and does not sign or submit a transaction.

## Product flow and security boundaries

### Existing native SOL path

1. The owner connects a Solana wallet and the app verifies the RPC cluster.
2. The owner creates or manages a mandate for a separate agent identity. Mandate policy includes the approved recipient, per-transaction and daily SOL limits, expiry, revocation state, and nonce.
3. The server-side Groq integration can interpret a plain-language SOL payment request into a strict structured intent. Explicit amount and recipient validation runs after the model response.
4. The firewall decodes the proposed unsigned transaction bytes and checks the instruction, account keys, recipient, amount, intent token, and current mandate state.
5. The app presents verification results. M3 does not sign or submit the payment transaction.

The deployed M1 program enforces its supported native SOL mandate instructions on-chain. It does not enforce any future equity lending policy.

### Lending assessment path

- `POST /api/lending/assess` validates a compact opportunity payload and requests a strict Groq proposal. Its response is explicitly advisory and marks settlement as not implemented.
- `lib/lending.ts` defines a strict proposal schema and integer-only verifier. Collateral valuation, LTV and collateral-ratio decisions use `bigint` fixed-point amounts rather than floating-point authorization arithmetic.
- The verifier checks supplied evidence and policy. In the current prototype it runs in browser code against caller-supplied evidence; it is not a trusted server or on-chain authorization boundary.
- The Lending Agent page's demonstration scenarios are fixtures generated locally. They do not contact Groq, RPC, or a wallet and are labeled as simulated.
- A live implementation still needs a supported issuer/mint registry, verified token-account ownership source, trustworthy timestamped valuation, verified liquidity, borrower eligibility, durable replay and exposure state, and a dedicated lending program or verified protocol integration.

### Privacy

The Portfolio view avoids fetching and transmitting the user's entire token inventory. This is data minimization only. Solana account state is public, and RPC operators can observe queries. The application does not provide cryptographic selective-disclosure proofs, confidential balances, or issuer attestations. Do not describe the current UI as making on-chain holdings private.

### Failure behavior

Groq output is untrusted. Missing configuration, provider failures, rate limits, timeouts, malformed output, unsupported models, or validation errors do not create an authorized transaction. The default payment intent route has a bounded completion-token budget for the configured reasoning model. Provider credentials remain on the server.

## Mandate program

- Program: `tr_mandate`
- Program ID: `7hucMRtxEjUYn9hbKPsByneQmmu4Qrv7qDgaVG59ryEY`
- Network: Solana Devnet
- Instructions: `initialize_mandate`, `deposit`, `execute_payment`, `withdraw`, `revoke_agent`, `update_mandate`, and `reactivate_agent`

`execute_payment` is a native SOL payment instruction. It is not a lending, collateral, token, or USDC settlement instruction. No program upgrade is needed for the current prototype, and this repository does not include a new lending contract.

The M4.0 deployment and M4.1 lifecycle evidence are recorded in [`docs/M4_0_DEPLOYMENT_READINESS.md`](docs/M4_0_DEPLOYMENT_READINESS.md), [`docs/M4_0_DEVNET_PREFLIGHT_AUDIT.md`](docs/M4_0_DEVNET_PREFLIGHT_AUDIT.md), and [`docs/M4_1_VERIFICATION_REPORT.md`](docs/M4_1_VERIFICATION_REPORT.md). The M4.1.1 report verifies initialization and a 0.05 SOL deposit at the time of its snapshot; it does not verify later policy update, revocation, reactivation, withdrawal, or payment execution.

## Development and tests

```bash
# TypeScript type check
npm run typecheck

# Frontend and library tests
npm test

# Lint
npm run lint

# Optimized Next.js production build
npm run build
```

Anchor program tests need a local validator listening at the configured local endpoint (default `127.0.0.1:8899`):

```bash
npm run test:anchor
```

The optional client/program lifecycle integration test uses `TR_LOCAL_VALIDATOR_URL`:

```bash
TR_LOCAL_VALIDATOR_URL=http://127.0.0.1:8899 npm run test:local-integration
```

These are local or fixture-based tests. They do not submit transactions to Devnet or establish live token ownership, prices, or lending execution. The lending unit cases include invalid mint/owner/price, stale price, excessive LTV, insufficient collateral ratio, excessive loan, unauthorized borrower, expired policy, revoked agent, missing liquidity, malformed/tampered proposal, replay, and review-required outcomes.

## Repository map

```text
app/                         Next.js routes and API handlers
  api/intent/                 Native SOL intent extraction
  api/firewall/               Unsigned SOL transaction verification
  api/lending/assess/         Advisory lending proposal route
components/                   Dashboard, wallet, and lending UI
lib/                          Solana clients, mandate logic, and verifiers
  server/                     Server-only Groq, intent, and payment firewall code
programs/tr_mandate/          Anchor/Rust native SOL mandate program
tests/                        Frontend/unit, local integration, and Anchor tests
docs/                         Milestone reports, audits, architecture, and demo guide
```

## Project documentation

- [Private equity lending preflight audit](docs/PRIVATE_EQUITY_LENDING_PREFLIGHT.md)
- [Implementation plan](docs/PRIVATE_EQUITY_LENDING_IMPLEMENTATION_PLAN.md)
- [Architecture](docs/PRIVATE_EQUITY_LENDING_ARCHITECTURE.md)
- [Implementation report](docs/PRIVATE_EQUITY_LENDING_IMPLEMENTATION_REPORT.md)
- [Security review](docs/PRIVATE_EQUITY_LENDING_SECURITY_REVIEW.md)
- [Verification report](docs/PRIVATE_EQUITY_LENDING_VERIFICATION_REPORT.md)
- [Demo script](docs/PRIVATE_EQUITY_LENDING_DEMO_SCRIPT.md)
- [M1–M3 implementation, security, and verification reports](docs/)

## Current next milestone

Before displaying live eligible collateral, integrate verifiable token-account ownership for a specifically supported issuer asset and a trusted, timestamped valuation source. Before any real lending action, also establish independent liquidity and borrower evidence, durable policy/replay/exposure controls, and a dedicated on-chain or verified protocol settlement boundary. Keep native SOL mandate operations separate throughout.
