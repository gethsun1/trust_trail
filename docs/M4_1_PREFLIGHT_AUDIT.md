# M4.1 Devnet Mandate Lifecycle Preflight Audit

Date: 2026-11-07 (Africa/Nairobi)  
Repository: `/home/farmers-boy/Documents/GKM/trust_trail`  
Branch: `main`  
HEAD: `b3d0a9159cb9541141804500309d379c28231266` (`feat: add M3 intent engine and transaction firewall`)  
Program: `tr_mandate`  
Program ID: `7hucMRtxEjUYn9hbKPsByneQmmu4Qrv7qDgaVG59ryEY`

## Decision

**BLOCKED for remaining owner-specific Devnet lifecycle actions.** Read-only Phase 0 and Phase 1 checks passed. Initially, the supplied owner's mandate and vault PDAs were absent. The user later provided an initialization signature; it is finalized and independently verified on Devnet, so the mandate now exists. This agent environment has no browser-control or DOM inspection channel to read the policy form or press wallet action buttons. The M4.0 deployment authority is explicitly not presumed to be the application owner. No deposit, policy update, revocation, reactivation or withdrawal transaction has been submitted.

The user reports Phantom is connected and supplied its public key and initialization signature. Agent-driven wallet interaction remains blocked by the current tool context. Initialization has been verified; the remaining lifecycle operations require owner selections and approvals in Phantom. This is an execution-context blocker, not a Devnet program deployment or IDL blocker. Repository-side tests and the live initialization evidence are recorded in the M4.1 verification report.

## Repository state and preservation

- `git status --short --branch`: `## main...origin/main`; local changes are `M Anchor.toml`, `?? docs/M4_0_DEPLOYMENT_READINESS.md`, and `?? docs/M4_0_DEVNET_PREFLIGHT_AUDIT.md`.
- The above M4.0 files were preserved. No reset, clean, stash, checkout, or overwrite was used. The current `Anchor.toml` modification adds the expected `[programs.devnet]` mapping; the M4.0 reports document the deployment and verification.
- M3 is present in HEAD `b3d0a91`; no uncommitted M3 file changes were reported by Git. Its server firewall remains an unsigned decision path and is not used to sign or submit payment transactions.
- No repository-level `AGENTS.md` was found. Dependency `node_modules` guidance files are unrelated to project sources.
- `.env.local` was not printed or copied. Only its presence of `NEXT_PUBLIC_SOLANA_RPC_URL` was checked; the endpoint value was kept out of command output and this report.
- No files other than this audit and the accompanying plan were changed in this preflight.

## M1 program, IDL, and semantics

- `programs/tr_mandate/src/lib.rs` declares the expected program ID. `lib/tr_mandate.json` is the committed client IDL; `target/idl/tr_mandate.json` is a generated local IDL. M4.0 reports the on-chain IDL SHA-256 matching both local copies (`2a17f77c13d0c05fce0907321abd6b07ec921e159b740cd0edf1e26ce4d53484`).
- M1 derives mandate PDA from `[b"mandate", owner]` and vault PDA from `[b"vault", mandate]`. Mandate serialized account size is 154 bytes including the discriminator.
- Owner-authorized methods are `initialize_mandate`, `deposit`, `withdraw`, `update_mandate`, `revoke_agent`, and `reactivate_agent`. `execute_payment` exists in the program/IDL but is outside this milestone's signing and submission scope.
- Source semantics preserve vault rent reserve on withdrawal; increment nonce on owner mutations; preserve revoke state during policy updates; preserve spending history; and require an unexpired mandate for reactivation. Expiry checks are strict (`now < expires_at`).

## M2 frontend and integration architecture

- `components/dashboard.tsx` uses the connected Wallet Adapter wallet for owner transaction submission. It constructs an Anchor provider, builds IDL-backed instructions, obtains a recent blockhash/fee estimate, requests wallet approval, confirms the signature, and refreshes account state.
- It already exposes initialization, deposit, withdrawal, policy update, revoke and reactivate paths. Initialization/deposit and other owner operations are gated on verified Devnet identity and executable program state. Deposit labels include amount and derived vault; withdrawal is checked against the rent reserve. The existing agent is generated/restored in browser memory and remains separate from the owner wallet.
- `lib/chain.ts` derives PDAs and decodes the mandate and vault from RPC reads. It validates program ownership, discriminator, account length, owner, vault owner/data, rent reserve, and derives effective daily spending using cluster time. It does not use Anchor's account decoder for mandate state; it uses a manual decoder matching the committed layout. Any future account-decoding test must explicitly characterize this.
- `lib/network.ts` verifies the configured connection's genesis hash against `lib/config.ts`; `components/providers.tsx` supplies the configured connection. The code does not change Solana CLI or Anchor global defaults.
- `lib/transactions.ts` prepares owner transactions and handles wallet errors. The dashboard distinguishes approval, submitted, confirmed, failed and unknown states and refreshes state after confirmation.

## M3 server/firewall boundary

- `app/api/firewall/route.ts` and `lib/server/firewall.ts` inspect only unsigned `execute_payment` transactions and return a deterministic decision. No signing or transaction submission is performed by those routes.
- M4.1 must not connect AI output to signing. No M3 server configuration or firewall semantics need to change for the owner lifecycle scope.

## Phase 1 read-only Devnet verification

The configured application RPC was queried without printing its URL or sending a transaction. Program identity was checked at confirmed slot `519697199` before initialization:

| Check | Result | Evidence |
|---|---|---|
| App RPC configured | PASS | `.env.local` contains `NEXT_PUBLIC_SOLANA_RPC_URL`; value intentionally omitted. |
| Actual RPC cluster | PASS | `getGenesisHash` returned `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`, matching the committed Devnet genesis hash. |
| Program address | PASS | Queried `7hucMRtxEjUYn9hbKPsByneQmmu4Qrv7qDgaVG59ryEY`, matching Rust `declare_id!`, committed IDL address and `lib/config.ts`. |
| Program account | PASS | Account exists; `executable: true`; owner is `BPFLoaderUpgradeab1e11111111111111111111111`. |
| Owner public key | PASS (user supplied) | `3iwLdajQozuaXyW9Ns9Hjz6GCUAjDLcFF9tSmR7qmkvp`. |
| Derived mandate | PASS (PDA), absent | `Cu7kS3rFtTW4YR8hGjyTre4mP97KMbCHqQaLB1QJxaEp`; confirmed account lookup returned no account. |
| Derived vault | PASS (PDA), absent | `GvW3YZjFTSmUdGY3U6TUQ77A3e1J8BAWkg6bNZUeQ4H7`; confirmed account lookup returned no account. |
| Deployment artifact and on-chain IDL | PASS by prior M4.0 evidence | M4.0 report records matching deployed SBF bytes and IDL hashes. No deploy/upgrade was performed for this audit. |
| Connected application RPC | PASS by source and endpoint check | Provider uses the configured endpoint; the endpoint returned the expected genesis hash. The production browser UI and Phantom extension have not been exercised in this context. |

At confirmed slot `519702912`, both PDAs were absent. After the user submitted initialization signature `2qdCizKoPLwcEDQbpQzgzj8J4KSS3rztZ3ogWFr8GUQQ3UDXoLsP3YRUFA1jz572sZ2GYqsE8FRqUZGCLPrueYcR`, a fresh confirmed RPC read showed the mandate and vault at the same derived PDAs. The signature is finalized at slot `519703320` with no transaction error. The mandate owner matches the supplied public key; the vault is system-owned and zero-data with `650240` lamports, exactly the rent reserve.

Command used (the script reads but never prints the endpoint):

```sh
node --input-type=module -e 'import fs from "node:fs"; import {Connection,PublicKey} from "@solana/web3.js"; const src=fs.readFileSync(".env.local","utf8"); const m=src.match(/^NEXT_PUBLIC_SOLANA_RPC_URL=(.*)$/m); const url=m?.[1]?.trim().replace(/^['"'"'"]|['"'"'"]$/g,"") || "https://api.devnet.solana.com"; const c=new Connection(url,"confirmed"); const id=new PublicKey("7hucMRtxEjUYn9hbKPsByneQmmu4Qrv7qDgaVG59ryEY"); const [genesis,info,slot]=await Promise.all([c.getGenesisHash(),c.getAccountInfo(id,"confirmed"),c.getSlot("confirmed")]); console.log(JSON.stringify({configuredEndpointPresent:Boolean(m),genesis,genesisMatchesDevnet:genesis==="EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG",slot,programAddress:id.toBase58(),accountExists:Boolean(info),executable:info?.executable??false,accountOwner:info?.owner.toBase58()??null}));'
```

## Identity handling and PDA/account verification

- `lib/agent-vault.ts` creates and restores browser-generated agent keys and persists only validated encrypted backups. The dashboard shows owner wallet state and registered agent public key separately. Private owner keys, agent secret bytes and passphrases were not read or transmitted during preflight.
- Derivation uses the actual M1 seeds above in `lib/mandate.ts`; existing unit coverage asserts those seeds against `PublicKey.findProgramAddressSync`.
- `lib/chain.ts` account decoding is custom binary decoding against the committed M1 layout. Existing tests cover local integration reads; no real application owner account can be queried until the owner public key is known.

## Existing tests and integration architecture

- Vitest unit suites: `tests/frontend/{agent-vault,firewall,intent,mandate,network,transactions}.test.ts`.
- Optional local-validator lifecycle suite: `tests/frontend/local.integration.test.ts`, gated by `TR_LOCAL_VALIDATOR_URL`. It initializes, reads, deposits, updates, revokes, reactivates, withdraws, and verifies balances/nonces/rent reserve through the same client builders and decoder.
- Anchor harness: `tests/tr_mandate.test.mjs`, invoked by `npm run test:anchor`.
- No M4.1 test was run in this preflight; prior M2/M3 reports distinguish local and mocked evidence. M4.0 is deployment evidence, not lifecycle evidence.

### Verification performed after the user resumed M4.1

- `npm test`: **PASS**, 6 test files passed, 44 tests passed; 1 local-validator test file was skipped because the validator URL was not set for this invocation.
- `npm run typecheck`: **PASS** (`tsc --noEmit`).
- Started `solana-test-validator --ledger /tmp/tr_m4_1_validator --bpf-program 7hucMRtxEjUYn9hbKPsByneQmmu4Qrv7qDgaVG59ryEY target/deploy/tr_mandate.so --reset` using a new `/tmp` ledger; the validator reported version 4.1.2 and was stopped after testing.
- `TR_LOCAL_VALIDATOR_URL=http://127.0.0.1:8899 npm run test:local-integration`: **PASS**, 1 client lifecycle test. This exercised the existing Anchor JS client/decoder against the local validator artifact.
- `npm run test:anchor` with the local validator running on `127.0.0.1:8899`: **PASS**, 11/11 program tests. This suite includes simulated agent payment semantics on the local validator; it is not a Devnet payment transaction.
- The first `npm run test:anchor` attempt before starting the validator failed 11/11 because `127.0.0.1:8899` refused connections. It was rerun successfully against the temporary local validator.
- No test submits a transaction to Devnet or uses the deployment wallet.

## Blockers and required inputs

1. **The agent cannot inspect or drive the connected Phantom tab.** The public key and initialization signature are known, but no browser-control tool is available to present later lifecycle actions for wallet approval.
2. Real lifecycle evidence for deposit, policy update, revoke, reactivate and withdrawal requires owner-selected parameters, approvals in the connected wallet and independent post-transaction Devnet reads. These operations have not yet been performed.

No product-source changes were necessary: the already implemented M2 frontend contains the requested lifecycle actions. The supplied owner public key was used only for PDA derivation and read-only account inspection. Wallet actions must still be approved in Phantom. Never provide a seed phrase, private key, encrypted backup or deployment wallet secret to unblock this work.
