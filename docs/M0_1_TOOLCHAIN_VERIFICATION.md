# M0.1 Toolchain Installation and Verification

**Project:** tr — Solana Autonomous Agent Trust and Execution Layer  
**Date:** 2026-11-06 (Africa/Nairobi)  
**Scope:** Approved user-level toolchain installation and disposable Anchor smoke verification. No tr_mandate implementation or deployment was performed.

## Result

Toolchain installation and local Anchor verification succeeded. A disposable Anchor workspace was created under `/tmp/tr_m0_1_anchor_smoke`, built, tested against a local validator, and removed after verification. No program was deployed to Devnet or mainnet. No existing wallet configuration or keypair was read or changed.

## Installed and selected versions

| Tool | Version/result |
|---|---|
| rustc default stable | `1.99.1 (58cf8f9c3 2026-10-13)` |
| Cargo default stable | `1.99.1 (5f94df478 2026-08-27)` |
| Rust toolchain required by generated Anchor template | `1.89.0` (installed by rustup; fixture's `rust-toolchain.toml` pins this MSRV) |
| AVM | `1.2.2`, built from `otter-sec/anchor` tag `v1.2.2`, commit `8d9d1488` |
| Anchor CLI | `anchor-cli 1.2.2` |
| Solana CLI | `solana-cli 4.1.2` (Agave client) |
| Platform tools | `v1.57` installed through AVM; resolved as Anchor 1.2.2 → Solana 4.1.2 → platform-tools 1.57. SBF rustc reported by resolver: `1.95.0`. |
| `cargo build-sbf` | CLI reports `cargo-build-sbf 4.1.0`; its generic `--version` output reports embedded/default platform-tools `v1.54`. Anchor build explicitly used `--tools-version v1.57`, which is the release pairing selected and installed for this smoke build. |
| Node.js | `v24.22.0` (pre-existing) |
| npm | `12.2.0` (pre-existing) |
| Temporary TS client | `@anchor-lang/core 1.2.2`, `@solana/web3.js 1.99.0` |
| Temporary TS test tools | TypeScript `5.9.3`, Mocha `11.8.0`, ts-mocha `11.1.0`, ts-node `10.9.2`, Chai `5.3.3`, `@types/mocha 10.0.10`, `@types/chai 5.2.3` |

Anchor's own generated template pinned host Rust 1.89.0, so rustup installed that additional toolchain during smoke-workspace initialization. The default rustc/Cargo remain 1.99.1. AVM also printed a notice that platform-tools v1.58 was newer; v1.57 was used because Anchor 1.2.2's release notes recommend Solana 4.1.2, platform-tools v1.57, SBPF v3.

The first AVM-driven Solana installer invocation initialized Solana 4.1.2 but returned an activation error because its lookup ran before the newly installed release path was active in the current shell. The release files and active symlink were present. Explicitly adding `$HOME/.local/share/solana/install/active_release/bin` to the current shell PATH made Solana and `agave-install` available, after which AVM reported Solana 4.1.2 already active. The installer appended that path to `~/.profile`; this was the only shell configuration change.

## Official installation and compatibility references

- [Anchor 1.2.2 release notes](https://www.anchor-lang.com/docs/updates/release-notes/1-2-2): recommended Solana 4.1.2, platform-tools v1.57, SBPF v3; AVM can resolve matching project toolchains.
- [Anchor AVM reference](https://www.anchor-lang.com/docs/references/avm): versioned Anchor installation and Solana/platform-tools resolution.
- [Anchor installation](https://www.anchor-lang.com/docs/installation): AVM installation and Rust/Solana prerequisites.
- [Anchor TypeScript client](https://www.anchor-lang.com/docs/clients/typescript): `@anchor-lang/core` uses legacy `@solana/web3.js` v1.
- [Anchor testing](https://www.anchor-lang.com/docs/testing): supported test frameworks.
- [Solana dependency installation](https://solana.com/docs/intro/installation/dependencies): Rust and Solana CLI installation guidance.
- [Rust release announcements](https://blog.rust-lang.org/releases/): Rust 1.99.1 release dated 2026-10-15.

## Commands executed

### Installation

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
  | sh -s -- -y --default-toolchain 1.99.1 --profile minimal --no-modify-path
source "$HOME/.cargo/env"
cargo install --git https://github.com/otter-sec/anchor \
  --tag v1.2.2 avm --locked --force
avm install 1.2.2
avm use 1.2.2
avm platform-tools resolve --anchor-version 1.2.2
avm solana resolve
avm solana install 4.1.2
export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$PATH"
avm solana install 4.1.2
avm platform-tools install v1.57
```

The first `avm solana install` required the subsequent explicit PATH activation described above. No apt/system package installation was run.

### Disposable workspace build and test

The workspace was initialized outside the project, with no Git initialization or package install during init:

```bash
cd /tmp
anchor init tr_m0_1_anchor_smoke --no-git --no-install \
  --template single --test-template mocha --package-manager npm \
  --provider.cluster localnet --no-security-metadata
```

The temporary fixture's test dependencies were aligned to the versions listed above using npm in `/tmp/tr_m0_1_anchor_smoke` only. A new localnet-only test wallet was generated with silent output and used only by the local test validator; it was never used against Devnet and its contents were not displayed.

```bash
anchor build --tools-version v1.57
solana-keygen new --no-bip39-passphrase --silent \
  --outfile /tmp/tr_m0_1_anchor_smoke/local-test-wallet.json
anchor test --validator legacy \
  --provider.wallet /tmp/tr_m0_1_anchor_smoke/local-test-wallet.json
```

### Devnet RPC verification

All requests were read-only JSON-RPC POSTs to `https://api.devnet.solana.com`:

```bash
curl -sS --max-time 20 -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' \
  https://api.devnet.solana.com
curl -sS --max-time 20 -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"getVersion"}' \
  https://api.devnet.solana.com
curl -sS --max-time 20 -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"getGenesisHash"}' \
  https://api.devnet.solana.com
curl -sS --max-time 20 -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"getLatestBlockhash"}' \
  https://api.devnet.solana.com
curl -sS --max-time 20 -H 'Content-Type: application/json' \
  --data '{"jsonrpc":"2.0","id":1,"method":"getBalance","params":["11111111111111111111111111111111",{"commitment":"confirmed"}]}' \
  https://api.devnet.solana.com
```

### Required version checks

```text
rustc --version   -> rustc 1.99.1 (58cf8f9c3 2026-10-13)
cargo --version   -> cargo 1.99.1 (5f94df478 2026-08-27)
solana --version  -> solana-cli 4.1.2 (src:182084b8; feat:c763ae0a, client:Agave)
anchor --version  -> anchor-cli 1.2.2
avm --version     -> avm 1.2.2
node --version    -> v24.22.0
npm --version     -> 12.2.0
```

## Build and test results

- Anchor initialization: **passed**. Generated a minimal generic Anchor sample (counter template), Anchor.toml, Rust toolchain pin, and Mocha TypeScript test.
- `anchor build --tools-version v1.57`: **passed**. SBF program compiled using `anchor-lang 1.2.2`; Anchor's host-side IDL build also completed. The fixture emitted Anchor's standard warning that its generated Rust crate declares both `cdylib` and `lib` crate types.
- `anchor test --validator legacy --provider.wallet <temporary local key>`: **passed**, `1 passing (807ms)`. The template test initialized and incremented its counter on the local validator. It did not contain financial logic and did not submit a Devnet transaction.
- npm install audit on temporary test dependencies printed 12 vulnerability findings (1 low, 8 moderate, 3 high) after installing the selected packages. The fixture and its dependency tree were temporary and removed. Do not run `npm audit fix` against this disposable result or assume these findings apply to a future locked project dependency graph; resolve/reevaluate with the actual M1/M2 lockfile.

## Devnet RPC results

| Method | Result |
|---|---|
| `getHealth` | `ok` |
| `getVersion` | `solana-core: 4.4.0`, feature-set `2681577653` |
| `getGenesisHash` | `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG` (Devnet genesis hash) |
| `getLatestBlockhash` | Success at slot `519401965`; a recent blockhash and last valid block height were returned. Ephemeral blockhash omitted here. |
| `getBalance` | System Program public address `11111111111111111111111111111111`: `1` lamport at confirmed commitment, context slot `519401968` |

The endpoint was reachable and accepted all five queries. The RPC reports Solana core 4.4.0 while the selected local CLI is 4.1.2; these calls succeeded, but this is not a deployment compatibility test.

## Wallet, secrets, and project state

- No existing Solana CLI wallet configuration was read or changed.
- The configured project provider wallet path was overridden with an explicitly generated local-test key in `/tmp`; the Anchor sample deployment key also remained under `/tmp`.
- The disposable workspace, local validator test wallet, generated program key, build products, and temporary npm dependencies were removed after verification.
- No wallet secrets were displayed, copied into the project, or sent to Devnet. No program was deployed.
- The project workspace contains the two M0 documents and this M0.1 report only. It is not a Git repository, so `git status`/`git diff` cannot be run there; `git rev-parse --is-inside-work-tree` reports that it is not a repository. No other files were added to the workspace.
- Rust/AVM/Solana user-level installations remain under the normal rustup, Cargo, AVM, and Solana installation directories. `~/.profile` contains the Solana release `bin` PATH line appended by the official installer.

## Remaining blockers and adjustments to M1

1. **Anchor 1.2.2 templates pin Rust 1.89.0.** Keep that toolchain available; the global default may remain Rust 1.99.1. Anchor/AVM may also select a pinned nightly specifically for IDL builds, as described by the release notes.
2. **Pin toolchain configuration in the actual project before M1 build work.** Set Anchor CLI/framework/crates to exact `1.2.2`; keep `solana_version = "4.1.2"` explicit in `[toolchain]`; use AVM for matching Solana/platform-tools. The generated workspace uses Rust `1.89.0` and standard npm/Mocha test setup.
3. **Build command:** Use `anchor build --tools-version v1.57 --arch v3` in reproducibility instructions if the selected CLI supports both flags; validate the normal `anchor build` path against the project pin as part of M1. Avoid relying on the unqualified `cargo build-sbf --version` platform-tools field, which reports its embedded generic default rather than the explicit version passed to Anchor.
4. **Test validator:** Anchor 1.2.2 defaults to Surfpool, which was not installed here. The verified local test used the included Solana `solana-test-validator` via `--validator legacy`. Keep that explicit for M1 unless Surfpool is separately approved and installed.
5. **Template dependency audit:** npm reported 12 findings in the temporary generated test dependency tree. Reassess against exact package versions and the actual lockfile before M2; do not apply automated fixes blindly.
6. **Devnet version skew:** Public RPC reports core 4.4.0 and the local client is 4.1.2. The requested read-only RPC methods all worked. Verify actual deployment/client behavior later on Devnet after M1 approval; do not change tool versions based only on these successful queries.
7. **Wallet extension and AI provider credentials** remain unverified/not configured; neither blocks the M1 on-chain program milestone.

## Reproducibility

1. Ensure the approved Ubuntu host has build prerequisites (`cc`, `make`, `pkg-config`; present during this verification).
2. Install Rust via rustup and select Rust `1.99.1` as default; retain/install Rust `1.89.0` for the generated Anchor workspace.
3. Install AVM from `https://github.com/otter-sec/anchor` tag `v1.2.2`, then `avm install 1.2.2` and `avm use 1.2.2`.
4. Set the Solana release bin directory on PATH: `$HOME/.local/share/solana/install/active_release/bin`; resolve/install Solana `4.1.2` and platform-tools `v1.57` with AVM.
5. Verify all seven requested tool versions before starting M1. Use explicit `--provider.cluster localnet` and a newly generated local-only key for future local tests; never allow test commands to fall back to an unknown wallet.
6. For this verification only, the fixture was generated with `anchor init tr_m0_1_anchor_smoke --no-git --no-install --template single --test-template mocha --package-manager npm --provider.cluster localnet --no-security-metadata`, then `anchor build --tools-version v1.57` and `anchor test --validator legacy` were run. No deployment command was run.
