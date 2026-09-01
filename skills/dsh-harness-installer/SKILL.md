---
name: dsh-harness-installer
description: Verify, install, launch, and certify the exact official DeepSeek Harness 0.1.2-alpha.2 npm runtime while independently cross-building its pinned official source. Never changes PATH and never claims unproved source-to-package binary equivalence.
---

# DSH Harness Installer

Use this Skill only for installing or certifying Harness itself. Theme, Full
Skin, community Skin, and Plugin mutation belong to their dedicated installers.

Before acting, read
[references/source-build-contract.md](references/source-build-contract.md) and
[references/runtime-certification.md](references/runtime-certification.md).
For receipt validation also read the relevant closed schemas in `references/`.
The machine authority binds the official
[`SAFETY.md`](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/SAFETY.md)
bytes; preserve and show that upstream experimental-safety boundary.

## Current authority

- Official prerelease tag: `dsh-v0.1.2-alpha.2`
- Commit: `0a53fb55bea101816fa226bb964ae2bed71c343b`
- Tree: `64ccbfa8e0caa4711cd4a75717ef9e022657961b`
- Official npm runtime: `@deepseek-ai/dsh@0.1.2-alpha.2`
- npm tarball SHA-256:
  `5bf062a26a490853ffb9294fe3c9fb2047f029be3545612dea45718a81920a47`
- Installed CLI SHA-256:
  `dc23f6c5dd7df8834e3e38bdb9609d77b459834681ae9b7133b417b0c35f3166`
- Exact package manager: `pnpm@11.7.0`
- Exact certification nodes: `22.19.0` and `24.15.0`
- Exact matrix: Linux x64, macOS arm64, and Windows x64, for six tasks.

The GitHub prerelease has no binary attachment, but the exact official npm
package exists. It has a registry signature and fixed integrity, but no npm
provenance attestation and no `gitHead`. Therefore:

- the official npm package is the operational runtime;
- the exact Git tag/commit/tree is a separate source cross-build;
- never claim source-to-package binary equivalence;
- never describe the local source build as an official distributed binary.

The current authority remains `official-npm-runtime-evidence-pending` until all
six real receipts from the exact CI tasks are reviewed and explicitly promoted. A local success does
not open the publication gate. The alpha.1 source lane, RC.8 item authority,
and RC.2 runtime authority remain immutable history.

## Non-negotiable boundaries

- Never accept `latest`, a range, a branch, a shortened commit, a dirty source
  checkout, a changed lockfile, or a user-supplied registry.
- Never run `npx @deepseek-ai/dsh`, a global install, an unpinned package
  manager, or dependency lifecycle scripts.
- Do not create a global package, shell alias, symlink, shim, desktop login
  item, or PATH modification. Every launch uses the current Node executable and
  the receipt-verified absolute CLI file.
- Do not install or replace Node, Git, a compiler, or another system dependency.
- Do not capture Web startup output. The `?token=` launch credential, session
  cookie, related headers, and any credential-derived digest must never enter a
  receipt, log, screenshot, artifact, or chat.
- Do not mutate an existing `web` Profile before a complete private snapshot.
  The launcher uses the Plugin installer's shared cross-platform snapshot
  primitive only for this backup; it does not install or remove a Plugin.
- Obtain explicit consent immediately before network installation or a source
  clone/build, and explain network, disk, build-script, and experimental-alpha
  boundaries.

## Inspect authority

```bash
node <skill-dir>/scripts/authority.mjs
```

Proceed only on one exact platform/Node tuple. While the bundled publication
authority is pending, ordinary users must not be told that this runtime is
certified or generally installable; installation is limited to the controlled
candidate/certification workflow.

## Install the exact official npm runtime

Choose a new versioned directory below the current user's home and a new private
receipt outside that runtime directory:

```bash
node <skill-dir>/scripts/install-official.mjs \
  --output <user-home-subdir>/dsh-v0.1.2-alpha.2-npm \
  --receipt <new-absolute-private-install-receipt.json>
```

The installer verifies the bundled frozen resolution, fetches only the exact
official tarball, checks SHA-256 and npm integrity, materializes the bundled
`pnpm@11.7.0` toolchain, performs the integrity-checked network fetch, and then
runs the frozen install offline with lifecycle scripts disabled. It removes the
private package-manager store and verifies the installed CLI after final
placement. POSIX uses an atomic rename; Windows uses an incomplete marker at
the final path so pnpm junctions are never broken by relocation and no partial
runtime is launchable. It never edits PATH. The receipt
contains no process output, environment, install path, BrowserAuth material,
or credential-derived digest.

## Launch without PATH changes

Version inspection:

```bash
node <skill-dir>/scripts/run-official.mjs \
  --install <absolute-versioned-runtime-directory> \
  --receipt <absolute-private-install-receipt.json> \
  -- --version
```

For a first launch, create a new empty canonical `DSH_HOME`. For an existing
valid `web` Profile, also supply a new private snapshot directory; the launcher
creates and verifies the full eight-file Profile/Home snapshot before starting:

```bash
node <skill-dir>/scripts/run-official.mjs \
  --install <absolute-versioned-runtime-directory> \
  --receipt <absolute-private-install-receipt.json> \
  --dsh-home <absolute-canonical-DSH_HOME> \
  --snapshot <new-absolute-private-snapshot-directory> \
  -- web --no-open
```

Omit `--snapshot` only when the supplied `DSH_HOME` is completely empty. A
non-empty Home without a valid `web` Profile fails closed. The authenticated
local URL is displayed only by the live Harness process; tell the user to open
it without copying it into chat or a file.

## Exact source cross-build

The source lane is independent evidence, not the runtime install path:

```bash
node <skill-dir>/scripts/prepare-source.mjs \
  --output <new-absolute-source-directory>

node <skill-dir>/scripts/build-source.mjs \
  --source <absolute-clean-source-directory> \
  --receipt <new-absolute-private-build-receipt.json>
```

The builder verifies the exact origin, tag, commit, tree, lockfile, package
manifests, Node tuple, and `pnpm@11.7.0`; it runs the frozen install with
lifecycle scripts disabled, then the reviewed upstream `build:official` script.
The private build receipt records the built CLI digest but never upgrades the
source artifact into an official binary.

## Six-task publication gate

The manual-only `.github/workflows/alpha2-runtime-certification.yml` does the
following independently in every exact tuple:

1. installs and verifies the official npm runtime;
2. cross-builds the exact official source;
3. runs CLI version, `web` Profile `dump-config`, BrowserAuth, restart, and Web
   module-protocol probes against the official npm runtime;
4. records both artifact chains and the missing upstream equivalence boundary;
5. emits a credential-free candidate receipt only.

BrowserAuth must prove root `401`, launch exchange `303`, valid cookie `200`,
Host/Origin/cross-site rejection `403`, and the observed cold-restart contract.
Web protocol proof includes `entries+batches`, combo URLs, stale revision `404`,
JavaScript/source-map MIME, gzip/identity, cache, and `__DSH_BOOT_READY__`.

Verify a downloaded six-task candidate against the exact workflow bytes:

```bash
node <skill-dir>/scripts/runtime-certification.mjs verify \
  --candidate <absolute-candidate-directory> \
  --workflow <absolute-repository>/.github/workflows/alpha2-runtime-certification.yml
```

This still has no authority effect. Promotion requires a clean POSIX checkout,
the exact GitHub OIDC/Sigstore bundle, a byte-pinned `gh` executable, and an
explicit reviewer action:

```bash
node <skill-dir>/scripts/promote-runtime-authority.mjs \
  --candidate <absolute-candidate-directory> \
  --provenance <absolute-runtime-receipt-set.json.sigstore.json> \
  --authority <skill-dir>/references/alpha2-release-authority.json \
  --gh <absolute-byte-pinned-gh-binary>
```

Missing, partial, synthetic, copied, or post-redacted evidence keeps the lane
closed. Promotion on Windows is intentionally refused because authority-file
replacement is certified only with the reviewed POSIX durability path.
