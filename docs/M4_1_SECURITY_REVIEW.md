# M4.1.1 Security Review

Date: 2026-11-07 (Africa/Nairobi)
Result: **CONDITIONAL PASS — live initialization and deposit independently verified; remaining live lifecycle actions unverified.**

## Verified controls and state

- The configured application's RPC returned Devnet genesis hash `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`; the URL was not printed. The expected program `7hucMRtxEjUYn9hbKPsByneQmmu4Qrv7qDgaVG59ryEY` exists and is executable.
- Initialization signature `2qdCizKoPLwcEDQbpQzgzj8J4KSS3rztZ3ogWFr8GUQQ3UDXoLsP3YRUFA1jz572sZ2GYqsE8FRqUZGCLPrueYcR` finalized at slot `519703320` without error. Its only required signer is the supplied owner. Its instruction account metas match the derived mandate and vault.
- Deposit signature `3WTdnA3JytWAKHvyoFQn1A5GSU5cWFnijFfsbfzqWwuPVkE9WgqsWFU6GcvQM8ee8yRE1KbiKSzUWFDobSuWdQez` finalized at slot `519705146` without error. It is owner-signed, identifies the `deposit` instruction and a 50,000,000 lamport argument, and includes the same derived mandate/vault and System Program. The inner transfer and subsequent RPC read confirm the exact amount reached the vault.
- Current mandate PDA `Cu7kS3rFtTW4YR8hGjyTre4mP97KMbCHqQaLB1QJxaEp` records the supplied owner, registered agent `CQ2MjiCcG4cbGMZzxHpwZauy9u8WLuJyXmkk2Tspfh8U`, owner as recipient, 0.1 SOL per-transaction limit, 0.5 SOL daily limit, expiry `1798578000`, nonce 1 and `revoked: false`.
- Current vault PDA `GvW3YZjFTSmUdGY3U6TUQ77A3e1J8BAWkg6bNZUeQ4H7` is System Program-owned and zero-data. At confirmed slot `519710509`, balance is `50,650,240` lamports; the zero-data rent reserve is `650,240`; spendable balance is `50,000,000`. This confirms the reserve remains intact.
- The client derives mandate from `['mandate', owner]` and vault from `['vault', mandate]`; its decoder checks program ownership, discriminator, data size, stored owner, vault owner/data and reserve state. The account was independently fetched and decoded from RPC.
- The dashboard's owner operations use the connected wallet adapter. The agent identity is separate. No private key, seed phrase or encrypted agent backup was accessed or transmitted.
- No `execute_payment` was submitted. M1 source semantics were not modified, and no program deploy/upgrade occurred.

## Lifecycle evidence gap and risk

Policy update, revoke, reactivate and withdrawal have no live Devnet transaction signatures in this run. This execution context cannot inspect or control the user's Phantom tab or sign as the owner. Therefore their live persistence/nonce behavior, revocation enforcement, owner-only reactivation and reserve-preserving withdrawal remain unverified. No result is inferred from frontend history. Existing local-validator tests cover those code paths but do not prove live-wallet execution or Devnet state transitions.

The client uses a manual binary decoder rather than Anchor account decoding, so account layout changes must keep its discriminator, length and field offsets synchronized with M1. Existing browser runtime, extension and best-effort JavaScript key clearing risks noted in prior M2 review remain. No new vulnerability was found in the reviewed M4.1 paths; this review is not a security certification.

## Recommendation

Accept the initialization and deposit evidence as verified Devnet results. Keep M4.1 lifecycle completion conditional until owner-authorized Devnet transactions for policy update, revoke, reactivate and withdrawal are independently confirmed by signatures and post-transaction account reads. See [Verification Report](M4_1_VERIFICATION_REPORT.md) for the account snapshots and the separate local/mock test classifications.
