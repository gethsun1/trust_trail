# M2 Security Review

**Scope:** M2 browser control plane and agent identity storage. This is not an independent audit.

## Implemented safeguards

- The connected owner wallet signs administration; the app never asks for or receives its secret key.
- Agent keypair generation is client-side. The M2 UI has no agent payment signer, `execute_payment` action, AI provider, server route, telemetry or arbitrary program execution.
- IndexedDB and export paths accept only a strict encrypted-backup schema. The backup contains AES-GCM ciphertext, public-key metadata, a random salt/IV, version and work factor. Secret material is never intentionally persisted in plaintext, put in URLs, sent to RPC or emitted to logs.
- Encryption is AES-GCM-256; PBKDF2-SHA-256 uses 600,000 iterations, 16-byte random salt and 12-byte random IV. Restore validates format, authentication tag, 64-byte keypair integrity and public-key consistency.
- Explicit Lock and `pagehide` overwrite the referenced in-memory `Uint8Array` and clear React state on a best-effort basis. JavaScript copies, closures, browser memory, devtools, extensions or crash artifacts may retain copies; physical erasure is not guaranteed.
- RPC endpoint syntax is validated, then Devnet is identified by genesis hash with a timeout. A URL hostname alone never authorizes transactions. Program deployment status is read separately, and writes require both verified Devnet identity and an executable program.
- Owner transaction integration uses the connected owner as fee payer and signer, preserves the submitted blockhash strategy for confirmation, and never retries an ambiguous transaction automatically.

## Wallet verification limits

The app relies on Wallet Standard discovery and compatibility filtering. A wallet must provide Standard connect/events plus Solana sign-and-send or sign-transaction capability; mere Standard registration is not treated as sufficient. No separate legacy Phantom/Solflare adapter list is registered. The adapter provider’s built-in mobile adapter is retained and deduplicated against Standard adapters by name. Phantom, Solflare and MetaMask were not available in a real browser session, so live provider compatibility remains unverified.

## Dependency advisory review

Fresh `npm audit --omit=dev` reports **13 production dependency findings** (11 moderate, 2 high, 0 critical); npm reports `fixAvailable: false` for all affected paths. `npm audit` reports 21 findings total (19 moderate, 2 high). The findings are transitive and overlap by dependency path; the high Anchor finding is the `toml` path, not an additional independent parser issue.

| Package/version | Dependency path and advisory | Reachability in this app | Patched version / compatibility |
|---|---|---|---|
| `toml@3.0.0` (high; five GHSA records) | `@coral-xyz/anchor@0.32.1` → `toml@^3.0.0`; uncontrolled recursion, prototype pollution and parser DoS (`GHSA-82x6-q7mm-w9cf`, `GHSA-v5mp-jgw5-2x6j`, `GHSA-4qx8-w7c3-pj3p`, `GHSA-9j65-hcg3-gc64`, `GHSA-9qmh-m7c6-f92p`). | Anchor’s TOML parser is in its Node-only `workspace` helper. M2 uses browser `Program`/`AnchorProvider`; it does not parse user-provided TOML. The vulnerable parser is still present in the production dependency tree and would be relevant if Node workspace parsing were introduced. A scan of the generated `.next/static/chunks` and `.next/server/app` output found no `toml.parse` or `stream-json` code string; this supports the browser-path assessment but does not prove safety for arbitrary future server-side imports. | Current `toml` is 5.0.1 and the audit range includes through 5.0.0. Moving Anchor’s `^3` dependency to 5.x is a major override with unverified compatibility. No override applied. |
| `stream-json@1.9.1` (moderate; three GHSA records) | `@solana/web3.js@1.99.0` → `jayson@4.3.0` → `stream-json@^1.9.1`; parser DoS and prototype-pollution advisories (`GHSA-528h-pc64-c93x`, `GHSA-hqr4-qq8f-hg3x`, `GHSA-mjw6-4jj6-33hc`). | Web3’s browser connection imports Jayson’s browser client, which parses JSON using its browser implementation; it does not import Jayson’s server `stream-json` assembler/filter path. M2 does not parse user-controlled streaming JSON. | Current `stream-json` is 3.8.0, but Jayson pins the compatible range to `^1.9.1`; updating across major versions requires a Jayson/Web3 change or override. No override applied. |
| `uuid@8.3.2` (moderate) | Web3 → Jayson → uuid; advisory `GHSA-w5hq-g745-h8pq` concerns v3/v5/v6 buffer bounds. | Jayson’s browser client uses `uuid.v4`; the affected v3/v5/v6 APIs are not called by this path. | Advisory fix is `uuid >=11.1.1` (current 14.0.3), a major jump outside Jayson’s `^8.3.2`. No override applied. |
| `@solana/web3.js@1.99.0` and `jayson@4.3.0` (moderate) | Jayson/stream-json/uuid transitive paths; this causes npm to flag Web3 and its dependents. | The browser uses Web3 `Connection`, `Keypair` and `Transaction`; the specific stream-json vulnerable implementation and uuid v3/v5/v6 entry points are not used. | The 1.x line ends at 1.99.0 in the available registry metadata. Web3 3.x is a rewritten major API and is incompatible with Anchor 0.32.1 and the current wallet-adapter peer range (`^1.99.0`). No major migration or override applied. |
| `@coral-xyz/anchor@0.32.1`, wallet-adapter React `0.15.40`, Wallet Standard adapter `1.1.8`, and their base/mobile packages | Audit effects inherit the Web3/Jayson/TOML paths above; installed base is `@solana/wallet-adapter-base@0.9.28`, Wallet Standard base `1.1.7`, mobile adapter/protocol `2.3.0`. | M2 imports Anchor browser program/provider APIs and Wallet Standard compatibility adapters; it does not invoke Anchor workspace loading or mobile-specific RPC parsing in the tested desktop path. The packages remain in the dependency tree. | No compatible package remediation is offered by npm. Replacing Anchor or migrating the Solana JS SDK would be a reviewed major architecture change, outside this hardening pass. |

The official Web3 repository identifies v1.x as the legacy maintenance line; v3 is a rewritten API. [Web3.js repository](https://github.com/solana-foundation/solana-web3.js) Advisory records: [toml recursion](https://github.com/advisories/GHSA-82x6-q7mm-w9cf), [toml prototype pollution](https://github.com/advisories/GHSA-v5mp-jgw5-2x6j), [stream-json advisories](https://github.com/advisories/GHSA-528h-pc64-c93x), [uuid advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq).

No `npm audit fix --force` or breaking dependency update was run. The remaining findings should be reviewed again before exposing a Node API or moving to a new Anchor/Web3 major.

## Remaining risks

- Browser encryption does not defend against malware, malicious extensions, compromised devices, devtools inspection or an active same-origin attack. Loss of backup and passphrase permanently loses the agent.
- No external audit, browser extension audit, penetration test or production deployment review was performed.
- No real wallet extension was available; wallet and account-change behavior has unit/model tests but not Phantom/Solflare E2E evidence.
- Devnet deployment is absent. UI actions remain disabled until genesis identity and program deployment are verified.
