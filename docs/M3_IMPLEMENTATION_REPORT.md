# M3 Implementation Report

Date: 2026-11-07

## Delivered architecture

The M3 slice adds two server-side routes and an M3 dashboard panel. `/api/intent` accepts only a bounded natural-language instruction, calls Groq from the Node server, validates a strict schema, and returns a server-HMAC-bound intent. `/api/firewall` verifies that HMAC, parses the supplied base64 unsigned legacy transaction, decodes the `execute_payment` instruction against `lib/tr_mandate.json`, independently re-derives mandate/vault PDAs, reads current mandate/vault state through the existing decoder, and recomputes a deterministic decision. The response contains a decision, reason codes and explanation. No route signs or submits a transaction.

The browser displays the intent first. If an active connected wallet, loaded agent public identity and mandate exist, it creates exactly one unsigned instruction using the committed IDL discriminator and argument layout. The interface offers a matching request, recipient substitution, and per-transaction cap violation scenario. These are generated from current mandate state; tests use explicitly local transaction fixtures. The panel does not invoke the M2 owner transaction submit helper.

## Groq integration

- Endpoint: official Groq chat completions API.
- Default model: `openai/gpt-oss-20b`; overridden by server-only `GROQ_MODEL`.
- Required secret: `GROQ_API_KEY`; it is not prefixed with `NEXT_PUBLIC_`, returned, or logged.
- Request uses strict JSON Schema, temperature 0, at most 300 output tokens, and a 12-second timeout.
- Provider errors, 429 responses, timeout, absent configuration, malformed content and field validation errors fail closed with safe client error codes.
- The system prompt treats user text as untrusted data and forbids invented recipients/amounts and unsupported actions.
- The server independently requires the recipient key to appear in the user's instruction and exactly one explicit numeric SOL amount whose exact integer lamport conversion matches the returned amount. Missing or mismatched evidence becomes clarification-required.
- Health endpoint returns only configuration booleans.

The chosen default model is documented by Groq as supporting strict structured outputs; see [Groq Structured Outputs](https://console.groq.com/docs/structured-outputs) and [Groq API Reference](https://console.groq.com/docs/api-reference). A production-server smoke request with synthetic public-key data completed successfully; no sensitive prompt or transaction data was used.

## Intent schema

The schema is strict and rejects extra model fields. It contains `action`, `asset`, `recipient`, `amountLamports`, and `missingFields`; the application attaches the original instruction and machine status (`ready`, `clarification_required`, `unsupported`). Only `native_sol_payment` with `SOL` can be ready. Lamports are positive integer strings in the u64 range; conversion and comparisons use `BigInt`.

## Firewall checks and reason codes

The firewall only accepts a legacy unsigned transaction up to Solana's 1232-byte serialized limit, with one top-level instruction. It checks no nonzero transaction signatures are present; exact program ID, discriminator, argument length/order; exact IDL account count/order and signer/writable flags; agent as sole required signer and fee payer; fixed System Program; amount and recipient match; owner-derived mandate/vault PDAs; current mandate agent/recipient/nonce; revoked/expiry state; per-transaction and daily caps; and vault balance above rent reserve. It rejects added instructions, including direct System Program transfers. The inner System Program CPI is not observable in the unsigned top-level message; Anchor remains responsible for enforcing it on-chain.

Implemented reason codes include `INTENT_TRANSACTION_MISMATCH`, `UNSUPPORTED_PROGRAM`, `UNEXPECTED_INSTRUCTION`, `WRONG_RECIPIENT`, `AMOUNT_MISMATCH`, `INVALID_AGENT_SIGNER`, `INVALID_MANDATE`, `MANDATE_REVOKED`, `MANDATE_EXPIRED`, `PER_TRANSACTION_LIMIT_EXCEEDED`, `DAILY_LIMIT_EXCEEDED`, `NONCE_MISMATCH`, `INSUFFICIENT_VAULT_BALANCE`, `UNVERIFIABLE_TRANSACTION`, and `MANDATE_STATE_UNAVAILABLE`.

## Failure behavior and boundaries

Unknown formats, malformed requests, invalid intents, provider/RPC errors and stale or unavailable state cannot approve. The browser cannot submit an authoritative decision: the server verifies a keyed intent token and recomputes the firewall result from transaction bytes and current RPC state. The Groq secret is used as the HMAC key and stays server-side. M3 approval means only that off-chain checks passed; it is not a signature, submission, execution, or waiver of Anchor checks.

## Limitations and M4 work

- Rate limiting for the intent route is process-local and best effort; production needs a shared limiter behind trusted proxy address handling.
- No Devnet transaction was performed. The only live Groq request used a synthetic instruction and a public program address.
- RPC reads are confirmed reads and cannot eliminate state changes between review and a later M4 submission; M4 must obtain a fresh nonce/state and the program must remain the final authority.
- The current builder uses the live mandate and a latest blockhash but does not sign or submit. A read-only policy state may change while the UI remains open.
- The firewall supports only the current legacy transaction shape and the one committed Anchor instruction. Versioned transactions, SPL tokens, swaps, generic program scanning, and all execution/signing are outside scope.
- M4 must add an explicit human authorization step, fresh firewall review immediately before signing, signer separation, secure key lifecycle, submission/confirmation recovery, and transaction-level audit evidence. Do not wire AI output directly into signing.
