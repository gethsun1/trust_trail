# M4.1.1 Verification Report

Date: 2026-11-07 (Africa/Nairobi)
Result: **PARTIAL — initialization and exact deposit verified on Devnet; policy update, revoke, reactivate and withdrawal remain blocked/unverified.**

## Devnet verification method

Read-only checks used the configured application RPC without printing its URL. The RPC genesis hash is `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG` (Devnet). Each signature was looked up with `getSignatureStatuses` using transaction-history search and fetched with `getTransaction` at confirmed commitment (max transaction version 0). Both returned finalized status and no transaction error. Account state was independently fetched with `getAccountInfo`; the Mandate account was decoded against the committed 154-byte layout. Confirmed account snapshot slot: `519710509`.

Program `7hucMRtxEjUYn9hbKPsByneQmmu4Qrv7qDgaVG59ryEY` exists and is executable. The supplied owner is `3iwLdajQozuaXyW9Ns9Hjz6GCUAjDLcFF9tSmR7qmkvp`. Derived addresses are mandate `Cu7kS3rFtTW4YR8hGjyTre4mP97KMbCHqQaLB1QJxaEp` and vault `GvW3YZjFTSmUdGY3U6TUQ77A3e1J8BAWkg6bNZUeQ4H7`.

## Live Devnet transaction evidence

| Action | Signature | Finalized slot | Signer | Instruction/account verification |
|---|---|---:|---|---|
| Initialize | `2qdCizKoPLwcEDQbpQzgzj8J4KSS3rztZ3ogWFr8GUQQ3UDXoLsP3YRUFA1jz572sZ2GYqsE8FRqUZGCLPrueYcR` | `519703320` | Owner public key | Program instruction discriminator identifies `initialize_mandate`; accounts include the supplied owner, derived mandate, derived vault and System Program. No error. |
| Deposit 0.05 SOL | `3WTdnA3JytWAKHvyoFQn1A5GSU5cWFnijFfsbfzqWwuPVkE9WgqsWFU6GcvQM8ee8yRE1KbiKSzUWFDobSuWdQez` | `519705146` | Owner public key | Program instruction discriminator identifies `deposit`; amount argument is exactly `50,000,000` lamports; accounts are owner, same mandate/vault and System Program. Inner System Program transfer is owner to vault. No error. |

| State | Before deposit (post-init) | After deposit / current read |
|---|---:|---:|
| Vault lamports | `650,240` | `50,650,240` |
| Rent reserve (current rent exemption for zero-data account) | `650,240` | `650,240` |
| Spendable vault balance | `0` | `50,000,000` |
| Mandate nonce | `0` | `1` |

The expected post-deposit balance is `650,240 + 50,000,000 = 50,650,240` lamports, exactly equal to the observed value. No discrepancy exists. The reserve is intact. The vault is at the derived PDA, System Program-owned and zero-data; its owner identity is the mandate owner. The user wallet and the vault address are distinct and correctly match the owner-to-vault transfer instruction.

Current decoded mandate state: owner `3iwLdajQozuaXyW9Ns9Hjz6GCUAjDLcFF9tSmR7qmkvp`; agent `CQ2MjiCcG4cbGMZzxHpwZauy9u8WLuJyXmkk2Tspfh8U`; recipient equals owner; max per transaction `100,000,000` lamports; daily limit `500,000,000` lamports; expiry `1798578000`; spent today `0`; nonce `1`; revoked `false`. Mandate account is program-owned and 154 bytes.

This reconciles the earlier M4.1 report's “deposit not yet performed” status: it accurately described the pre-deposit snapshot, but is superseded by the later finalized deposit at slot `519705146` and current account read above. The application activity entry was not used as proof.

## Lifecycle outcomes

| Requirement | Devnet outcome | Evidence/status |
|---|---|---|
| Initialization | **PASS** | Signature and independent account state above. |
| Deposit exactly 50,000,000 lamports | **PASS** | Finalized deposit signature; instruction amount and account keys checked; vault read confirms exact delta. |
| Policy update persists and increments nonce | **BLOCKED / unverified** | No owner wallet signing interface available in this agent session; no transaction submitted. |
| Revocation sets revoked and disables agent execution | **BLOCKED / unverified** | No transaction submitted; no live execution attempt. |
| Reactivation owner-only and nonce history preserved | **BLOCKED / unverified** | No transaction submitted; no live authorization attempt. |
| Withdrawal by owner preserves rent reserve | **BLOCKED / unverified** | No transaction submitted. |
| Payment execution | **NOT SUBMITTED** | Explicitly outside scope. |

The blocker is the lack of access to the connected owner wallet signing interface, not a claim that UI activity proves a transaction. No secret key was requested or read. The remaining actions need owner wallet approvals and then fresh signature/account verification.

## Automated and local verification (separate from Devnet)

| Command | Result | Classification |
|---|---|---|
| `npm test` | 6 files passed; 44 passed, 1 skipped | Unit tests/mocks; local integration skipped in this invocation |
| `npm run typecheck` | Passed (`tsc --noEmit`) | Static TypeScript check |
| `solana-test-validator --ledger /tmp/tr_m4_1_validator --bpf-program 7hucMRtxEjUYn9hbKPsByneQmmu4Qrv7qDgaVG59ryEY target/deploy/tr_mandate.so --reset` | Started local validator v4.1.2 with existing staged artifact; stopped after tests | Local validator only |
| `TR_LOCAL_VALIDATOR_URL=http://127.0.0.1:8899 npm run test:local-integration` | 1 passed | Local client/program lifecycle integration: initialize, read, deposit, policy update, revoke, reactivate and withdrawal |
| `npm run test:anchor` with validator running on `127.0.0.1:8899` | 11 passed, 0 failed | Local program tests, including local-only payment semantics |

The first Anchor test invocation failed because no local validator was listening; rerunning against the temporary validator passed. These local tests do not establish live Devnet outcomes. Prior M4.0 reports document deployed bytes and IDL hash matching local artifacts. No deploy or upgrade was performed for M4.1.1.
