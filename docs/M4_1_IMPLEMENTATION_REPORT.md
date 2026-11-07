# M4.1.1 Implementation Report

Date: 2026-11-07 (Africa/Nairobi)
Result: **PARTIAL — initialization and deposit verified on Devnet; remaining lifecycle actions blocked on owner wallet signing access.**

## Work completed

The existing M2 dashboard implements owner-authorized initialization, deposit, policy update, revoke, reactivate and withdrawal using the connected wallet, committed Anchor IDL and Devnet-gated connection. It confirms transactions and refreshes mandate/vault state. The existing local-validator integration exercises the lifecycle and rent-reserve handling. No product source, M1 semantics, dependencies, program deployment or upgrade were changed for this report.

The configured RPC was queried without disclosing its URL. Its genesis hash is Devnet's `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`. Both supplied signatures were fetched with signature status history and transaction data and independently checked against derived owner-specific accounts.

## Verified live Devnet transactions

| Action | Signature | Result | Slot | Signer and relevant accounts |
|---|---|---|---:|---|
| Initialize mandate | `2qdCizKoPLwcEDQbpQzgzj8J4KSS3rztZ3ogWFr8GUQQ3UDXoLsP3YRUFA1jz572sZ2GYqsE8FRqUZGCLPrueYcR` | Finalized, no error | `519703320` | Owner `3iwLdajQozuaXyW9Ns9Hjz6GCUAjDLcFF9tSmR7qmkvp`; program `7hucMRtxEjUYn9hbKPsByneQmmu4Qrv7qDgaVG59ryEY`; mandate `Cu7kS3rFtTW4YR8hGjyTre4mP97KMbCHqQaLB1QJxaEp`; vault `GvW3YZjFTSmUdGY3U6TUQ77A3e1J8BAWkg6bNZUeQ4H7` |
| Deposit | `3WTdnA3JytWAKHvyoFQn1A5GSU5cWFnijFfsbfzqWwuPVkE9WgqsWFU6GcvQM8ee8yRE1KbiKSzUWFDobSuWdQez` | Finalized, no error | `519705146` | Same owner signer, program, mandate and vault |

The initialization instruction discriminator matches `initialize_mandate`. Its pre/post vault balances were `0` / `650,240` lamports, establishing the rent-funded system-owned, zero-data vault. Initial policy was 100,000,000 lamports per transaction (0.1 SOL) and 500,000,000 lamports daily (0.5 SOL); recipient equals owner, agent is `CQ2MjiCcG4cbGMZzxHpwZauy9u8WLuJyXmkk2Tspfh8U`, nonce was 0 and revoked was false.

The deposit instruction discriminator matches `deposit`; its little-endian amount argument is exactly `50,000,000` lamports. The transaction's compiled instruction accounts are the owner, derived mandate, derived vault and System Program. The inner System Program transfer moves the exact amount from owner to vault. Vault pre/post balances are `650,240` and `50,650,240` lamports. Current balance equals the expected `50,650,240`; there is no unexplained difference. The reserve remains exactly `650,240` lamports, leaving `50,000,000` lamports spendable. The mandate nonce advanced from 0 to 1; policy, owner, agent and recipient remain as initialized.

## Current account state

At confirmed slot `519710509`, direct RPC account reads show:

- Owner: `3iwLdajQozuaXyW9Ns9Hjz6GCUAjDLcFF9tSmR7qmkvp`.
- Mandate PDA: `Cu7kS3rFtTW4YR8hGjyTre4mP97KMbCHqQaLB1QJxaEp`, owned by the expected program, 154-byte layout.
- Vault PDA: `GvW3YZjFTSmUdGY3U6TUQ77A3e1J8BAWkg6bNZUeQ4H7`, System Program-owned, zero data.
- Vault balance / rent reserve / spendable: `50,650,240` / `650,240` / `50,000,000` lamports.
- Mandate owner / agent / recipient: owner / `CQ2MjiCcG4cbGMZzxHpwZauy9u8WLuJyXmkk2Tspfh8U` / owner.
- Policy: `100,000,000` max per transaction; `500,000,000` daily; expiry `1798578000` Unix seconds.
- Spent today 0; nonce 1; revoked false.

## Remaining lifecycle actions and blocker

Policy update, revocation, reactivation and withdrawal were not submitted on Devnet. This environment has no browser/DOM or connected Phantom signing channel, and no owner signing key was accessed. Without owner-authorized signatures, sending these actions safely is not possible. No success is inferred from application activity history. The work stops here rather than simulating success.

The policy update's persistence and nonce increment, revoke state and execution disablement, owner-only reactivation with preserved nonce history, and owner withdrawal preserving rent reserve remain unverified live. Local tests cover these semantics, but are not Devnet evidence. No `execute_payment` was submitted.

See [Verification Report](M4_1_VERIFICATION_REPORT.md) for transaction/account evidence and test classifications, and [Security Review](M4_1_SECURITY_REVIEW.md) for boundaries and limitations.
