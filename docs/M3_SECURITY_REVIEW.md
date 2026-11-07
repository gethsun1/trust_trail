# M3 Security Review

Date: 2026-11-07

## Reviewed boundaries

- Groq calls exist only in `lib/server/groq.ts`, called by the Node `/api/intent` route.
- `GROQ_API_KEY` is server-only; the key is never exposed through a public-prefixed environment variable. It is neither included in responses nor logged. User prompts and provider bodies are not logged.
- No private key, seed phrase or decrypted agent backup is passed in the AI request. The firewall receives public transaction bytes, owner public key, validated intent and an HMAC token.
- Model output is strict-schema parsed and independently checked. Recipient must be stated verbatim in the user's instruction; a single numeric SOL amount must match integer lamports exactly. Confidence is neither requested nor used.
- The HMAC binds the ready intent to server-side Groq configuration. The firewall verifies the token, but still treats the transaction itself as untrusted and decodes it from bytes.
- The firewall rejects unsupported transaction versions/serialization, signatures, programs, account lists, flags, instruction data, recipients, amounts, stale nonce, revoked/expired mandate, policy excess, insufficient spendable vault, and RPC failure.
- The only possible `APPROVE` comes from the server recomputation. The client does not send a decision field. No signer or submit path is reachable from the M3 panel.
- Anchor account state and mandate rules were not changed; Anchor remains authoritative at execution time.

## Findings and limits

1. **Accepted for M3:** Intent rate limit is an in-memory per-process best-effort guard. It will not coordinate across server replicas and depends on deployment proxy behavior for client IP headers.
2. **Accepted boundary:** Firewall approval is a point-in-time off-chain result. M4 must re-read state and re-run checks immediately before signing; on-chain checks still decide execution.
3. **Not exercised:** No deployed Devnet program or Devnet transfer was used as evidence. A live Groq smoke request used synthetic instruction text and a public address only.
4. **Scope boundary:** Only a single legacy transaction containing `execute_payment` is accepted. The firewall does not claim to inspect arbitrary CPI behavior; the Anchor source enforces the CPI transfer.

## Verification

Tracked-file and production browser-bundle scans found no Groq key patterns or Groq provider/auth markers in client assets. No secrets are included in this report.
