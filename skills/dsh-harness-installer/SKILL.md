---
name: dsh-harness-installer
description: Prepare, build, validate, and launch the exact DeepSeek Harness 0.1.2-alpha.1 source checkout without claiming an official binary or modifying PATH. Use for the separate Harness setup task, not theme, skin, or plugin installation.
---

# DSH Harness Installer

Build only the fixed official alpha.1 source identified by
`references/alpha1-source-authority.json`. This Skill is the Harness setup
lane. Finish it before handing a separate `#NNNN` item request to a theme,
skin, or plugin installer.

Read [references/source-build-contract.md](references/source-build-contract.md)
before cloning or building. Read
[references/build-receipt.schema.json](references/build-receipt.schema.json)
only when validating a private local build receipt. For the separate six-task
publication gate, read
[references/runtime-receipt.schema.json](references/runtime-receipt.schema.json)
and
[references/runtime-receipt-set.schema.json](references/runtime-receipt-set.schema.json),
then read
[references/runtime-certification.md](references/runtime-certification.md).
Use `scripts/runtime-authority.mjs` to validate the canonical matrix and
`scripts/runtime-certification.mjs` to verify a downloaded candidate.

## Current authority

- Tag: `dsh-v0.1.2-alpha.1`
- Commit: `cd5ef8148158c3a752a658978873241fdf8e2bbc`
- Tree: `a712eec535b48badc4fefb4df5176a7002e4280b`
- Root lockfile SHA-256:
  `506ad1fc7c40f71ce8c6afe08724fdd55020c1a527d7a7a185c559d39ecfcaf1`
- Toolchain: exact pnpm `11.7.0`; receipt matrix uses exact Node `22.19.0`
  and `24.15.0` on Linux, macOS, and Windows.

The tag currently has no official binary release assets and its alpha package
family is not published to npm. Always describe the result as a **local build
from pinned official source**, never as an official binary or npm install.
The authority remains `source-build-evidence-pending`; one local receipt does
not make it publicly installable. RC.8 item authority and the certified RC.2
runtime baseline remain separate and unchanged.

## Boundaries

- Do not install Node, Git, Corepack, a package manager, a compiler, or another
  system dependency. Inspect prerequisites and stop if one is missing.
- Do not accept a branch, mutable ref, user-supplied repository, shortened
  commit, changed tree, changed lockfile, or dirty checkout.
- Do not run `npx @deepseek-ai/dsh`, `npm install`, `pnpm@latest`, or an
  unpinned package-manager command for this alpha source lane.
- Do not create a global package, shell alias, symlink, shim, desktop login
  item, or PATH modification. Every launch uses the absolute source-built CLI
  through the current Node executable.
- Do not capture Web startup output. Alpha.1 prints a URL with a random
  `?token=` value and later uses an authenticated cookie. Neither value, any
  associated header, nor a derived digest belongs in a receipt or log.
- Obtain explicit consent immediately before the clone and again before the
  dependency install/build. Explain disk use, network access, source scripts,
  and that the result is local and source-built.

## Inspect authority and prerequisites

Run the deterministic authority check:

```bash
node <skill-dir>/scripts/authority.mjs
```

Require exact Node `22.19.0` or `24.15.0`, Git, and the Node-adjacent Corepack
shim. If the user's Node differs, report the mismatch; do not replace it.

If the user already has a checkout, validate it before trusting any file:

```bash
node <skill-dir>/scripts/verify-source.mjs \
  --source <absolute-clean-checkout>
```

## Prepare the pinned checkout

After consent, choose a new absolute directory that is not a filesystem root,
home directory, workspace root, symlink, or existing path:

```bash
node <skill-dir>/scripts/prepare-source.mjs \
  --output <new-absolute-source-directory>
```

The script clones the exact official tag, detaches at the full commit, and
revalidates the Git tree, lockfile bytes and digest, root package-manager
declaration, build script, and four product package manifests. A failure
removes only the newly created destination.

## Build and issue one private local receipt

After a second consent, place the receipt in a new permission-restricted local
file outside any public evidence or log directory:

```bash
node <skill-dir>/scripts/build-source.mjs \
  --source <absolute-clean-checkout> \
  --receipt <new-absolute-private-receipt.json>
```

The script invokes
`corepack pnpm@11.7.0 install --frozen-lockfile --ignore-scripts`, then the
fixed `build:official` source script, and checks the absolute built CLI. This
suppresses dependency lifecycle scripts while leaving the reviewed project
build explicit. The word `official` names the upstream build profile; it does
not make the output an official distributed binary. The receipt contains no
path, process output, environment, token, cookie, credential, launch URL, or
credential-derived digest and is created with mode `0600` where the platform
supports it.
It does contain the SHA-256 of the generated CLI. The receipt-gated launcher
and Plugin installer re-hash that regular file before execution, so replacing
ignored build output after receipt creation fails closed.

## Launch without PATH changes

Use the receipt-gated launcher. It intentionally allows only inspection or a
loopback Web launch and never stores its output:

```bash
node <skill-dir>/scripts/run-source-built.mjs \
  --source <absolute-clean-checkout> \
  --receipt <absolute-private-receipt.json> \
  -- --version

node <skill-dir>/scripts/run-source-built.mjs \
  --source <absolute-clean-checkout> \
  --receipt <absolute-private-receipt.json> \
  -- web --no-open
```

The Web command prints an authenticated local URL to the live terminal. Tell
the user to open it without copying the URL into chat, a receipt, or a file.
Configure the model provider in Harness after first start. Stop after proving
the local UI opens; plugin and theme mutations are separate tasks.

## Publication gate

Never edit the bundled authority or call alpha.1 “published installable” from
a local success. Promotion requires six real receipts covering the exact
platform/Node matrix, privacy validation for every receipt, an independently
bound receipt-set digest and provenance-set digest, one shared immutable CI
workflow/run identity, review, and an explicit authority update. Every task
must prove CLI/Profile/Web, BrowserAuth, module protocol, MIME, compression,
cache, and boot readiness without retaining BrowserAuth material. Missing,
partial, synthetic, copied, or redacted-after-capture evidence keeps the lane
closed.

The manual-only `alpha1-runtime-certification.yml` workflow creates candidate
artifacts and has no authority mutation step. Every tuple builds the exact
source, runs the built CLI, parses the `web` Profile, performs a cold Web
restart, and probes BrowserAuth plus the entries/batches module protocol. The
runner retains startup credentials and session cookies only in bounded memory;
they are drained, never printed, never persisted, and never hashed.

After downloading a candidate from one successful six-task run, verify it
against the workflow bytes in the exact checkout:

```bash
node <skill-dir>/scripts/runtime-certification.mjs verify \
  --candidate <absolute-candidate-directory> \
  --workflow <absolute-repository>/.github/workflows/alpha1-runtime-certification.yml
```

This still does not publish alpha.1. A reviewer must explicitly run the
separate promotion script on a clean POSIX checkout whose HEAD equals the
candidate workflow run. It validates all receipt bytes again, verifies the
detached GitHub OIDC/Sigstore provenance for the exact receipt set, and
atomically replaces only the bundled authority:

```bash
node <skill-dir>/scripts/promote-runtime-authority.mjs \
  --candidate <absolute-candidate-directory> \
  --provenance <absolute-runtime-receipt-set.json.sigstore.json> \
  --authority <skill-dir>/references/alpha1-source-authority.json \
  --gh <absolute-byte-pinned-gh-binary>
```

Promotion on Windows is intentionally refused because this implementation has
not certified an atomic replace with the same durability guarantees. The
current bundled authority remains 0/6 until real candidate evidence is
reviewed and explicitly promoted.
