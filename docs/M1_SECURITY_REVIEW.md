# M1 Security Review

**Review date:** 2026-11-06 (Africa/Nairobi)
**Scope:** Static review of the M1 Anchor program and local-validator tests. No independent third-party audit.

## Security properties implemented

### PDA identity and account substitution

- Mandate is derived from `[b"mandate", owner]`; its stored owner must match the owner signer on owner instructions.
- Vault is derived from `[b"vault", mandate]` in all contexts.
- Vault must remain System Program-owned and have empty data. Mandate is deserialized as the program's `Mandate` account and constrained to its PDA.
- Payment recipient is an unchecked account only because it is compared byte-for-byte to the stored recipient before CPI. System Program is typed as `Program<System>`.
- Local tests verify the expected mandate/vault derivation, mandate ownership and data length, vault ownership and zero data, and reject a substituted vault PDA.

### Signer and policy authorization

- Owner signature is required for initialization, deposit, withdrawal, policy update, and revocation.
- Agent signer is constrained to the mandate's stored agent for payment execution.
- Payment checks revocation, expiry, exact recipient, positive amount, per-transaction limit, UTC-day allowance, expected nonce, and vault spendable balance.
- Revocation advances nonce. A later `update_mandate` can reactivate the mandate only with the owner's signature; this is the explicit recovery/reauthorization path.
- Owner withdrawal does not depend on agent status or expiry and cannot spend the rent reserve.

### Arithmetic, atomicity, and replay protection

- Amounts and limits use `u64` lamports; timestamps/day indices use `i64`. No floating point is used.
- Addition of daily spending and nonce increments use checked arithmetic. Spendable balance uses checked subtraction before outbound CPI.
- Payment state updates occur only after the transfer CPI succeeds. Solana transaction rollback preserves all program/account state when any check or CPI fails.
- Successful payments, deposits, withdrawals, policy changes, and revocation advance the nonce, invalidating stale instructions across state or balance changes.
- Daily reset is computed locally and committed only after an authorized successful payment.

### Rent and vault authority

- The vault is created at initialization as a System Program-owned zero-data account with `Rent::minimum_balance(0)` lamports.
- The program signs only System Program transfers whose source is the derived vault PDA. No raw lamport mutation or arbitrary CPI target is used.
- Both payment and withdrawal preserve the reserve. Tests withdraw all spendable funds and verify the vault remains at the reserve, then confirm a payment cannot spend more.

## Verification performed

- Anchor SBF build completed with Anchor 1.2.2, Solana CLI 4.1.2, platform-tools v1.57 and SBPF v3.
- Local validator integration passed for the positive and negative flows listed in `M1_IMPLEMENTATION_REPORT.md`.
- Rust unit tests passed for exact account sizing, UTC day calculation (including negative Unix timestamps), checked arithmetic overflow, and reserve underflow.
- Formatting and strict Clippy checks passed.
- Secret scan found no wallet/API/private-key material in tracked project files. Local test and program keypairs are ignored under `target/`.
- No cluster deployment was run.

## Risks and unresolved items

1. **Independent audit required before real funds.** This code has only repository-level review and local tests. It has not received an external security audit or formal verification.
2. **Upgrade authority/deployment governance is out of scope.** A future deployment must define who controls the upgrade authority, how upgrades are approved, and whether/when the program becomes immutable. A compromised upgrade authority could replace program behavior.
3. **Client and transaction firewall are absent.** M1 enforces policy on-chain but does not verify AI intent, inspect wallet messages, manage agent keys, or provide UX. Do not interpret this milestone as implementing those controls.
4. **Reactivation semantics:** owner policy update clears `revoked` and resets daily spending for the current day. This is intentional owner-only reauthorization, but callers must treat it as a full new authorization action and display it clearly when a client is later built.
5. **Reserve branch coverage:** under-reserve arithmetic is unit-tested, but a live under-reserved account was not generated through valid program instructions because all outgoing program paths preserve reserve. Validator state corruption would be needed to exercise the handler's `RentReserve` branch.
6. **Overflow state coverage:** overflow helpers are unit-tested; a maxed nonce/spending account cannot be reached through valid instructions and was not injected into a validator account.
7. **Expiry timing:** integration test relies on local validator wall-clock advancement and a 3-second delay. Long-term clock behavior and edge conditions around the exact expiry second are not fuzzed.
8. **Daily rollover:** Euclidean UTC-day calculation is unit-tested, while the integration suite does not wait a full UTC day to verify rollover in a transaction.
9. **Wallet and account liveness:** the program has no recovery migration if a mandate account is initialized with incorrect policy; the owner can update fields and withdraw but cannot change the owner key or close accounts.
10. **Fee/rent economics:** owner pays for mandate and vault creation and for owner instructions. Agent transaction fee-payer behavior is not part of this on-chain program.

## Review conclusion

The implementation satisfies the stated M1 on-chain behaviors under tested local-validator conditions. No deployment is approved or performed by this report. The unresolved risks above should be reviewed before a Devnet demo that claims production-like safety, and before any mainnet or material-value use.
