# M0 Environment Audit

**Project:** tr — Solana Autonomous Agent Trust and Execution Layer  
**Audit date:** 2026-11-06 (Africa/Nairobi)  
**Scope:** Read-only environment inspection. No tools were installed, configuration changed, keys read, or application code written.

## Summary

The suggested project directory, `/home/farmers-boy/Documents/GKM/trust_trail`, exists and was empty at audit time. It is the preferred project location. There is no Git repository in it yet. Solana Devnet JSON-RPC was reachable. The host has sufficient RAM and disk for a small Anchor and Next.js MVP, but no Rust or Solana/Anchor toolchain is installed, so the program cannot currently be built or tested.

## OS and hardware

- OS: Ubuntu 26.04.1 LTS (Resolute), Linux kernel `7.0.0-42-generic`
- Architecture: x86_64
- Logical CPUs: 4
- RAM: 20 GiB total, approximately 10 GiB available at audit time
- Swap: 8 GiB total, approximately 8 GiB free
- Workspace filesystem: 233 GiB total, 83 GiB used, 139 GiB available
- Assessment: enough capacity for the proposed local development workflow. Four CPUs may make SBF and JavaScript dependency builds slower, but do not prevent them.

## Installed tools

| Tool | Observed version/status | Notes |
|---|---|---|
| Node.js | `v24.22.0` | Present; modern Next.js/TypeScript work is feasible. Pin project runtime with `engines`/`.nvmrc` after dependency selection. |
| npm | `12.2.0` | Bundled package manager available. |
| pnpm | `12.11.2` | Available if the project chooses it; use one package manager and commit its lockfile. |
| Bun | `1.4.4` | Available, but not recommended as the MVP's primary package manager because standard Node tooling and Anchor TypeScript tests are the lower-risk path. |
| Git | `2.53.0` | Present. `init.defaultBranch=main`; `user.name` is configured; `user.email` is configured (value intentionally not reproduced); `core.autocrlf` unset. |
| Rust / rustc | Missing | `rustc` not found. |
| Cargo | Missing | `cargo` not found. |
| Solana CLI | Missing | `solana` and `solana-keygen` not found. |
| Anchor CLI | Missing | `anchor` not found. |
| Anchor Version Manager | Missing | `avm` not found. |
| SPL CLI | Missing | `spl-token` not found; not needed for native-SOL-only MVP. |
| Wallet browser extension | Not audited | No browser profile or extension inventory was inspected. A Devnet-compatible wallet such as Phantom or Solflare will be needed for the UI demo. |

No Solana wallet config or default keypair files were present at the standard paths checked (`~/.config/solana/cli/config.yml`, `~/.config/solana/id.json`). File contents were not accessed. This does not rule out wallet keys elsewhere or a browser wallet.

## Existing project/repository state

- The target directory exists, is empty, and is not a Git repository.
- Nearby directories include `ATG_Pocket`, `eleos`, `ORBIS`, and `CKB`; these are separate repositories and were not modified. `ORBIS` has pre-existing uncommitted changes; those are outside this task and were left untouched.
- No existing `tr` project directory was found in the inspected parent directory.
- Git's default initial branch is `main`. Git identity is configured; the email value is intentionally omitted from this report.

## Devnet connectivity

A read-only JSON-RPC `getHealth` request to `https://api.devnet.solana.com` returned HTTP 200 and `{"result":"ok"}`. This confirms endpoint reachability at audit time, not wallet funding, transaction submission, or future endpoint availability.

## Compatibility and build assessment

- Node.js/npm/Git are available and suitable for beginning the web application once a project is approved.
- There is no installed Rust compiler, Cargo, Solana CLI or Anchor CLI, so there is currently no installed Solana/Anchor combination to test for compatibility.
- Devnet RPC is reachable, but deployment and local validator tests are not currently possible from the installed toolchain.
- The machine has adequate resources; the primary blockers are missing developer tools, not hardware or network capacity.
- Use Anchor's AVM-backed version resolution and commit exact project versions after installing; do not mix independently selected Anchor CLI, Anchor Rust crates, Solana CLI/platform-tools versions. Anchor's official AVM documentation describes resolving Solana and platform-tools against the project configuration. See [Anchor AVM](https://www.anchor-lang.com/docs/references/avm) and [Anchor installation](https://www.anchor-lang.com/docs/installation).

## Risks and blockers

1. **Build blocker:** Rust/Cargo and the Solana/Anchor toolchain are absent. M1 program implementation cannot be validated until these are installed.
2. **Version alignment:** Anchor and Solana releases move frequently. Pin versions using AVM and `Anchor.toml`; verify `anchor build`, `anchor test`, local validator behavior, and Devnet deploy compatibility together before relying on any version matrix.
3. **Wallet readiness:** No standard Solana CLI wallet config was found. Browser wallet availability is unknown. Use a dedicated Devnet-only wallet and never import production credentials.
4. **Network dependence:** The public Devnet RPC responded, but it is rate-limited/shared infrastructure and may be unstable during a hackathon.
5. **Disk:** 139 GiB free is ample now; Rust, SBF platform-tools, node_modules, and local ledger caches consume space, so recheck before provisioning a local validator.
6. **Resource contention:** Four logical CPUs mean parallel compilation should be kept modest.

## Exact proposed installation commands (not executed)

These are candidate commands from current official installation documentation, to run only after explicit approval. They are listed for review; this audit did not install anything.

1. Rust via rustup (official Rust bootstrap; review installer before execution):
   `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
2. Load Cargo environment in the current shell:
   `source "$HOME/.cargo/env"`
3. Install AVM from the Anchor-maintained repository:
   `cargo install --git https://github.com/otter-sec/anchor avm --locked`
4. Install and select the stable Anchor release, then resolve its compatible Solana CLI using the project pin:
   `avm install 1.2.1`
   `avm use 1.2.1`
   `avm solana resolve`
   `avm solana install`
5. Confirm actual versions and build support before implementation:
   `rustc --version && cargo --version && avm --version && anchor --version && solana --version`
   `anchor build` (after project creation; not a standalone environment command)

The Anchor `1.2.1` candidate is based on the official Anchor ecosystem's current stable release information observed on the audit date; AVM should be used to resolve the corresponding Solana/platform-tools version, then the actual resulting versions recorded in the project. If that release is unavailable for this host or its resolved Solana version does not build, stop and reassess rather than silently selecting another version. Official install guidance: [Anchor installation](https://www.anchor-lang.com/docs/installation). The Solana one-command installer is another official option, but it installs multiple components and was not used or run: [Solana local installation](https://solana.com/docs/intro/installation).
