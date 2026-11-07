# M4.0 Devnet Preflight Audit

Date: 2026-11-07 (Africa/Nairobi)  
Scope: M4.0 follow-up readiness and deployment preparation for `tr_mandate`  
Expected program ID: `7hucMRtxEjUYn9hbKPsByneQmmu4Qrv7qDgaVG59ryEY`

The Devnet faucet request was rejected as rate-limited, but the owner subsequently funded the candidate wallet with 2.5 SOL. After rechecking the balance, cluster genesis, artifact, program keypair and absence of the target account, the program was deployed with explicit Devnet and wallet overrides. Anchor also initialized the on-chain IDL metadata. No mandate was initialized and no payment was made. The CLI default cluster and Anchor provider default remain unchanged. The Devnet program mapping, refreshed build artifact and these reports are the local changes.

## Results

| Check | Result | Evidence |
|---|---|---|
| Git branch, HEAD, upstream and worktree | PASS | `git status --short --branch` → `## main...origin/main`; `git rev-parse HEAD` → `b3d0a9159cb9541141804500309d379c28231266`; upstream → `origin/main`. Both staged and unstaged diff stats were empty before report creation. |
| M1 source program ID | PASS | `programs/tr_mandate/src/lib.rs` declares `7hucMRtxEjUYn9hbKPsByneQmmu4Qrv7qDgaVG59ryEY`. Source is the M1 mandate/vault program with owner-controlled deposit/withdraw/update/revoke/reactivate and agent payment execution. |
| Committed client IDL | PASS | `lib/tr_mandate.json` address matches expected ID. It contains the `execute_payment` discriminator `[86,4,7,7,120,139,232,139]`, five account metas in source order, `amount: u64`, and `expected_nonce: u64`. M2 client reads this IDL; M3 firewall reads its account metas and discriminator. |
| Generated target IDL presence | PASS | `target/idl/tr_mandate.json` exists (12,534 bytes). It is a local build output, not the committed client IDL. |
| SBF artifact presence and format | PASS | Refreshed `target/deploy/tr_mandate.so`: 171,864 bytes, ELF 64-bit LSB PIE, eBPF, statically linked and stripped. SHA-256: `d995d333f31abad9bfaec05e8f26a46257955d1b33271dccd0bdf1060c833b6d`. The previous artifact was preserved at `/tmp/trust-trail-m4-previous-artifact.so`. |
| Artifact source/build provenance | PASS | Fresh isolated `cargo build-sbf` succeeded for source commit `b3d0a9159cb9541141804500309d379c28231266`, tree `2c49e468111323936d2462a7282a88423a3316b4`, Solana build-sbf 4.1.0, platform tools v1.54 and `--arch v3`. Its ELF hash equals the refreshed workspace artifact. Isolated output directory: `/tmp/trust-trail-m4-sbf-v3.1VmpIM`; only its `.so` was copied, not its generated keypair. |
| Program keypair versus source ID | PASS | `solana-keygen pubkey target/deploy/tr_mandate-keypair.json` returns the expected program ID; secret contents were not printed. File mode is `600`. Source `declare_id!` and both IDL addresses match. |
| Anchor/Solana configuration | PASS with explicit override | `Anchor.toml` pins Anchor 1.2.2 and Solana 4.1.2. `[programs.devnet]` now maps `tr_mandate` to the expected ID. The default provider remains `Localnet` with `target/test-wallet.json` to avoid silently redirecting unrelated Anchor commands; deployment must use explicit Devnet and wallet overrides. `rust-toolchain.toml` pins Rust 1.89.0. |
| Current CLI environment | PASS | With installed tool directories added to PATH: Rust 1.89.0, Cargo 1.89.0, Anchor 1.2.2, `cargo-build-sbf` 4.1.0/platform-tools v1.54, Solana CLI 4.1.2. |
| Current cluster and genesis | FAIL | `solana config get` reports `https://api.mainnet-beta.solana.com`, WebSocket for Mainnet, and default keypair path `/home/farmers-boy/.config/solana/id.json`. Querying genesis hashes explicitly returned Devnet `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`, Mainnet `5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d`, and Testnet `4uhcVJyU9pJkvQyS88uRDiswHXSCkY3zQawwpjk2NsNY`. The app’s configured Devnet genesis hash matches the explicit Devnet result. The active CLI cluster is not Devnet. |
| Default wallet | BLOCKED | The configured default keypair path does not exist. `solana address` and default `solana balance` fail with “No default signer found.” No private key material was printed. |
| Explicit Anchor provider wallet availability | PASS | `target/test-wallet.json` exists with mode `600`; its derived public key is `7LxbFdRoBeT6XqBsRdzUga4jnHJ4fHJyRD2mjuDbbqLG`. The file is configured for Localnet in `Anchor.toml`; it is not automatically selected as a Devnet wallet by this audit. |
| Explicit provider wallet Devnet balance | PASS | Immediately before deploy, the funded wallet `7LxbFdRoBeT6XqBsRdzUga4jnHJ4fHJyRD2mjuDbbqLG` had 2.5 SOL. After deployment and metadata publication, its confirmed balance was 1.616079043 SOL. Program rent-exempt balance is 0.87394796 SOL. The attempted 2 SOL faucet request had failed as rate-limited; the owner later funded the wallet. |
| Devnet identity | PASS | Explicit Devnet genesis hash matches `lib/config.ts`’s `DEVNET_GENESIS_HASH`. No active CLI cluster was changed. |
| Program deployed on Devnet | PASS | `solana program show` reports the expected ID, upgradeable loader owner, ProgramData address `3MfumUDj22L6pMs3kk4KRq4YoJKKSFaHkcmm4oq92HUq`, deployed slot `519692138`, and data length `171864` bytes. The account reports `executable: true`. |
| Deployed executable matches artifact | PASS | `solana program dump` wrote `/tmp/tr_mandate_devnet_dump.so`; its size is 171,864 bytes and SHA-256 is `d995d333f31abad9bfaec05e8f26a46257955d1b33271dccd0bdf1060c833b6d`, identical to `target/deploy/tr_mandate.so`. |
| Upgrade authority | PASS | `solana program show` reports `7LxbFdRoBeT6XqBsRdzUga4jnHJ4fHJyRD2mjuDbbqLG`, matching the wallet explicitly used as payer and provider. |
| Deployment signer/authority distinction | PASS | Program-address signer: `target/deploy/tr_mandate-keypair.json`, deriving the program ID. Fee payer and upgrade authority: `target/test-wallet.json`, public key above. These roles were explicit in the deployment invocation. |
| On-chain IDL | PASS | `anchor idl fetch` returned SHA-256 `2a17f77c13d0c05fce0907321abd6b07ec921e159b740cd0edf1e26ce4d53484`, matching both `target/idl/tr_mandate.json` and committed `lib/tr_mandate.json`. Anchor reported successful IDL metadata creation during deployment. |
| M2 transaction builder compatibility | PASS | `lib/chain.ts` constructs `Program` from `lib/tr_mandate.json`; `lib/transactions.ts` prepares a legacy transaction with connected owner as fee payer. M2 report documents local-validator integration against the actual M1 binary. The on-chain IDL matches the committed IDL. |
| M3 firewall compatibility | PASS | `lib/server/firewall.ts` loads the committed IDL, checks the `execute_payment` discriminator, argument length and IDL account signer/writable flags, re-derives mandate/vault PDAs, and compares system program, recipient, intent, and current mandate state. The live on-chain IDL matches the committed IDL. The firewall remains an unsigned-transaction decision path and does not submit transactions. |

## Commands used

Inspection commands and remediation actions included:

```sh
git status --short --branch
git rev-parse HEAD
git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}'
git diff --stat
git diff --cached --stat
sed -n '1,280p' programs/tr_mandate/src/lib.rs
cat Anchor.toml rust-toolchain.toml Cargo.toml programs/tr_mandate/Cargo.toml
sed -n '1,300p' lib/tr_mandate.json
anchor --version
solana --version
rustc --version
cargo build-sbf --version
PATH="/home/farmers-boy/.cargo/bin:/home/farmers-boy/.avm/bin:/home/farmers-boy/.local/share/solana/install/active_release/bin:$PATH" rustc --version
PATH="/home/farmers-boy/.cargo/bin:/home/farmers-boy/.avm/bin:/home/farmers-boy/.local/share/solana/install/active_release/bin:$PATH" cargo --version
PATH="/home/farmers-boy/.cargo/bin:/home/farmers-boy/.avm/bin:/home/farmers-boy/.local/share/solana/install/active_release/bin:$PATH" anchor --version
PATH="/home/farmers-boy/.cargo/bin:/home/farmers-boy/.avm/bin:/home/farmers-boy/.local/share/solana/install/active_release/bin:$PATH" cargo build-sbf --version
PATH="/home/farmers-boy/.cargo/bin:/home/farmers-boy/.avm/bin:/home/farmers-boy/.local/share/solana/install/active_release/bin:$PATH" anchor build
solana config get
solana address
solana balance
file target/deploy/tr_mandate.so
stat -c 'path=%n bytes=%s modified=%y' target/deploy/tr_mandate.so
sha256sum target/deploy/tr_mandate.so
solana-keygen pubkey target/deploy/tr_mandate-keypair.json
solana-keygen pubkey target/test-wallet.json
solana genesis-hash --url https://api.devnet.solana.com
solana genesis-hash --url https://api.mainnet-beta.solana.com
solana genesis-hash --url https://api.testnet.solana.com
solana balance --url https://api.devnet.solana.com --keypair target/test-wallet.json
solana account 7hucMRtxEjUYn9hbKPsByneQmmu4Qrv7qDgaVG59ryEY --url https://api.devnet.solana.com
cargo build-sbf --manifest-path programs/tr_mandate/Cargo.toml --sbf-out-dir /tmp/trust-trail-m4-sbf-v3.1VmpIM --tools-version v1.54 --arch v3
build_dir=$(mktemp -d /tmp/trust-trail-m4-sbf.XXXXXX)
cargo build-sbf --manifest-path programs/tr_mandate/Cargo.toml --sbf-out-dir "$build_dir" --tools-version v1.54 --force-tools-install
solana rent 171864 --url https://api.devnet.solana.com
solana airdrop 2 7LxbFdRoBeT6XqBsRdzUga4jnHJ4fHJyRD2mjuDbbqLG --url https://api.devnet.solana.com --commitment confirmed
anchor deploy --program-name tr_mandate --provider.cluster devnet --provider.wallet target/test-wallet.json --program-keypair target/deploy/tr_mandate-keypair.json
solana program show 7hucMRtxEjUYn9hbKPsByneQmmu4Qrv7qDgaVG59ryEY --url https://api.devnet.solana.com --keypair target/test-wallet.json --commitment confirmed
solana account 7hucMRtxEjUYn9hbKPsByneQmmu4Qrv7qDgaVG59ryEY --url https://api.devnet.solana.com --keypair target/test-wallet.json --output json
solana program dump 7hucMRtxEjUYn9hbKPsByneQmmu4Qrv7qDgaVG59ryEY /tmp/tr_mandate_devnet_dump.so --url https://api.devnet.solana.com --keypair target/test-wallet.json --commitment confirmed
anchor idl fetch 7hucMRtxEjUYn9hbKPsByneQmmu4Qrv7qDgaVG59ryEY --provider.cluster devnet --provider.wallet target/test-wallet.json --commitment confirmed --out /tmp/tr_mandate_devnet_idl.json
```

## Audit conclusion

The program is deployed and executable on Devnet at the expected address. The deployed executable bytes and on-chain IDL both match local artifacts/committed IDL by SHA-256. Upgrade authority is the explicitly selected funded wallet. The CLI default remains Mainnet and Anchor’s default provider remains Localnet, so future Devnet commands should continue using explicit overrides. No mandate or payment was created in this deployment step.
