# M3 Demo Script

Use a connected wallet, an existing loaded agent public identity, and a mandate visible from the configured Devnet RPC. The dashboard's chain badge and mandate data must be live-verified before presenting them as live. Do not present test fixtures as chain results.

## 1. Matching payment

1. Open **Intent firewall** and click **Matching request** (or enter an explicit numeric SOL amount and the exact recipient public key shown in the mandate).
2. Click **Interpret instruction**. Show the validated `native_sol_payment`, `SOL`, recipient and exact lamport amount.
3. Select **Matching intent**, then **Prepare unsigned transaction and verify**.
4. Show `APPROVE` and the note that this is off-chain eligibility only; nothing was signed or executed.

If the vault does not contain enough spendable balance or the mandate state is unavailable, the firewall correctly rejects; do not claim a successful approval.

## 2. Tampered recipient

1. Repeat a matching request.
2. Select **Tamper recipient** before verification.
3. Show `REJECT` with `WRONG_RECIPIENT`; the browser did not change the server-bound intent token, but the decoded transaction recipient no longer matches.

## 3. Policy violation

1. Click **Exceed mandate cap** to enter an explicit amount one lamport above the current per-transaction limit.
2. Interpret the request and select **Matching intent** so the proposed transaction matches that intent.
3. Verify and show `REJECT` with `PER_TRANSACTION_LIMIT_EXCEEDED`.

## Local-only evidence

The deterministic firewall suite uses local transaction fixtures to demonstrate instruction/data/account tampering and policy failures without asserting live-chain state. The Anchor and M2 integration evidence uses a temporary local validator with the existing program binary. A separate Groq smoke test used synthetic text and a public address. No Devnet deployment, signature, or transfer is part of this demo evidence.
