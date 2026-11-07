# M4.0 Deployment Readiness Decision

Date: 2026-11-07 (Africa/Nairobi)  
Program: `tr_mandate`  
Expected program ID: `7hucMRtxEjUYn9hbKPsByneQmmu4Qrv7qDgaVG59ryEY`

## Decision

**DEPLOYED — Devnet deployment and verification succeeded.** The expected program is executable on Devnet, its live bytes match the staged artifact, its on-chain IDL matches both local IDLs, and the intended candidate wallet is confirmed as upgrade authority.

The program ID is consistent among Rust `declare_id!`, the program keypair’s derived public address, and both local IDLs. The Devnet genesis hash was confirmed before deployment. A fresh SBF v3 artifact was built from the reviewed commit. After the owner funded the candidate wallet, deployment and Anchor IDL metadata publication succeeded.

The active Solana CLI still points at Mainnet and has no default wallet; Anchor’s default provider remains Localnet. The deployment used explicit Devnet and wallet overrides. `Anchor.toml` also contains a Devnet program-ID mapping. The deployed program’s upgrade authority is `7LxbFdRoBeT6XqBsRdzUga4jnHJ4fHJyRD2mjuDbbqLG`, the wallet used to pay for deployment.

## Readiness checks

| Requirement | Result | Finding |
|---|---|---|
| Target is genuinely Devnet | PASS | Explicit Devnet genesis hash is `EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG`, matching `lib/config.ts`. The active CLI target remains Mainnet. |
| Deployment wallet exists | PASS | `target/test-wallet.json` derives to `7LxbFdRoBeT6XqBsRdzUga4jnHJ4fHJyRD2mjuDbbqLG`; its mode is `600`. It was explicitly selected for this Devnet deployment. |
| Deployment wallet has enough Devnet SOL | PASS | Owner funded the wallet with 2.5 SOL. Post-deployment confirmed balance is 1.616079043 SOL. The program account holds 0.87394796 SOL. |
| Correct program keypair available | PASS | `target/deploy/tr_mandate-keypair.json` derives the expected program ID. Its secret contents were not displayed. |
| Current artifact format | PASS | ELF eBPF executable, 171,864 bytes, SHA-256 `d995d333f31abad9bfaec05e8f26a46257955d1b33271dccd0bdf1060c833b6d`. The previous artifact is preserved at `/tmp/trust-trail-m4-previous-artifact.so`. |
| Artifact matches audited source | PASS | Fresh isolated build succeeded from commit `b3d0a9159cb9541141804500309d379c28231266` / source tree `2c49e468111323936d2462a7282a88423a3316b4`, using Anchor 1.2.2 dependencies, Solana build-sbf 4.1.0, platform tools v1.54 and SBPF `v3`. The artifact hash matches the staged `target/deploy/tr_mandate.so`. |
| Program absent or present on Devnet | PASS (deployed) | Program account is executable at the expected ID. ProgramData address `3MfumUDj22L6pMs3kk4KRq4YoJKKSFaHkcmm4oq92HUq`; deployed slot `519692138`; data length 171,864 bytes. |
| Deployed executable matches artifact | PASS | `solana program dump` produced a 171,864-byte file whose SHA-256 matches the staged artifact: `d995d333f31abad9bfaec05e8f26a46257955d1b33271dccd0bdf1060c833b6d`. |
| Upgrade authority understood | PASS | The on-chain authority is `7LxbFdRoBeT6XqBsRdzUga4jnHJ4fHJyRD2mjuDbbqLG`, the explicitly selected provider wallet. The program keypair remains the program address signer and is not the upgrade authority. |
| On-chain IDL | PASS | Fetched on-chain IDL SHA-256 `2a17f77c13d0c05fce0907321abd6b07ec921e159b740cd0edf1e26ce4d53484` matches `target/idl/tr_mandate.json` and committed `lib/tr_mandate.json`. |
| Cluster/wallet selection safe | PASS with explicit overrides | CLI config remains Mainnet and has no default keypair; Anchor provider remains Localnet with `target/test-wallet.json`. `Anchor.toml` now includes `[programs.devnet]`. Use the explicit deploy command below to select Devnet and the candidate wallet. |
| Toolchain can be verified in this environment | PASS | PATH-resolved versions: Rust 1.89.0, Cargo 1.89.0, Anchor 1.2.2, `cargo-build-sbf` 4.1.0 with platform-tools v1.54, Solana CLI 4.1.2. |
| M2/M3 compatible with committed IDL | PASS (IDL compatibility) | M2 creates the Anchor Program from the committed IDL; M3 decodes and validates the `execute_payment` instruction against that IDL and current mandate state. The on-chain IDL matches. No Devnet mandate lifecycle or payment transaction was run. |

## Deployment invocation used

The deployment was executed with:

```sh
PATH="$HOME/.cargo/bin:$HOME/.avm/bin:$HOME/.local/share/solana/install/active_release/bin:$PATH" anchor deploy --program-name tr_mandate --provider.cluster devnet --provider.wallet target/test-wallet.json --program-keypair target/deploy/tr_mandate-keypair.json
```

This selected Devnet explicitly, used the existing program keypair for the expected program ID, and used the funded wallet as payer and upgrade authority. Anchor uploaded the IDL metadata. The CLI warned that `anchor deploy` is deprecated in favor of `anchor program deploy`; this command nevertheless completed successfully.

## Post-deployment state

No mandate was initialized and no payment was made. The active CLI default remains Mainnet and Anchor’s default provider remains Localnet. For later Devnet upgrades, continue to pass the Devnet cluster and intended upgrade authority explicitly, and monitor its balance. The full deployment evidence is in [M4.0 Devnet Preflight Audit](M4_0_DEVNET_PREFLIGHT_AUDIT.md).
