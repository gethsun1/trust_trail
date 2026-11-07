# M3 Implementation Plan

1. Keep M1/M2 unchanged and use their committed IDL, PDA derivation and mandate reader as contract sources.
2. Add a server-only Groq chat-completions adapter, strict Zod intent validation, bounded request handling and a no-secret health status route.
3. Add a deterministic firewall that parses the actual unsigned legacy transaction bytes, allows exactly one Anchor `execute_payment`, re-derives mandate/vault PDAs, reads current mandate/vault state from the configured Devnet RPC, and fails closed on any mismatch or unavailable state.
4. Add an M3 dashboard panel that interprets natural language, displays the validated intent, prepares an unsigned agent transaction, submits only its serialized bytes for firewall review, and presents deterministic reasons. No sign/submit action is included.
5. Add mocked-provider intent/firewall tests and exercise the available frontend/build and Rust checks; report unavailable external validator or API evidence honestly.
6. Write implementation, security, verification and demo reports with exact evidence and M4 limitations.

## Contract boundary

Groq proposes typed fields only. The server owns validation. The firewall independently decodes transaction bytes and fetches current mandate state. A firewall decision never signs or submits a transaction; Anchor remains authoritative when M4 later executes one.
