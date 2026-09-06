---
name: dsh-theme-creator
description: Create and validate deterministic declarative manifests for DSH-Themes token themes and full skins. Use when authoring a new DeepSeek Harness theme from colors and local raster art, checking the 13 semantic tokens, recording copyright provenance, hashing assets, or preparing a safe manifest for website submission.
---

# DSH Theme Creator

Create data-only schema V3 drafts for the current Alpha source baseline in [references/compatibility-alpha.json](references/compatibility-alpha.json). The local sidecar is digest-pinned and must agree with the verified Manager source runtime and 54-package authority. Do not accept or generate author-supplied JavaScript, CSS, HTML, dependencies, lifecycle scripts, fonts, SVG, remote runtime assets, or hashed class selectors.

The default is DeepSeek Harness `0.1.3-alpha.1`, source commit `d347e703908d0406b7a7ef80e3a0e594d86b2215`. Run `scripts/inspect-baseline.mjs` to inspect it. Its `npmArtifacts` value is `null`; do not invent an npm version or integrity. A generated manifest remains a draft and receives no installation authority.

Public catalog identity is assigned by the website only after moderation. Creator and Submitter never mint, accept, or preserve a user-chosen public ID or legacy `DSH-*` label; published selections use the site's exact four-digit `#NNNN` contract, while the manifest slug remains discovery metadata rather than installation authority.

`node <skill-dir>/scripts/inspect-baseline.mjs certifiedRuntimeBaseline` exposes the verified RC.2 runtime baseline. It must report `baseline-certified`, `productionReady: true`, and `enabled: false`: runtime certification does not grant an authoring sidecar. The immutable `candidate` view remains historical-at-capture evidence only. Do not author or publish RC.2 manifests until a separately reviewed authoring authority is added.

The generator accepts only `schemaVersion: "3.0"` authoring input that selects the Alpha sidecar's exact version, then inserts the complete fixed source-build compatibility evidence. It never accepts author-supplied attestation fields and never emits `artifact` or `payload`. RC.6 V2 and RC.5 V1 remain historical, non-output formats.

## Create

1. Read [references/authoring-v3.md](references/authoring-v3.md). Read [references/authoring-v2.md](references/authoring-v2.md) only when auditing historical RC.6 data.
2. Make an authoring JSON file beside an `assets/` directory. Use normalized WebP files that the user has the right to publish; send JPEG/PNG originals through the website Theme Studio instead.
3. Provide all 13 tokens with complete `light` and `dark` hexadecimal values and check contrast in the real Harness UI.
4. For a full skin, provide distinct background, sidebar, card, light-preview, and dark-preview rasters plus the shared focus point.
5. Record the license URL, commercial-use status, attribution/share-alike requirements, and copyright provenance. For licensed art entering hosted review, pin a source revision when available and include the attribution plus genuine fixed NOTICE URL. Never substitute a LICENSE for NOTICE or infer ownership from file possession. A missing upstream NOTICE is represented only by the website's non-installable external-showcase contract, not by relaxing Creator output.
6. Generate a normalized manifest:

   ```bash
   node <skill-dir>/scripts/create-manifest.mjs \
     --input <authoring.json> \
     --output <new-manifest.json>
   ```

The generator rejects unknown fields, contradictory license policies, incomplete third-party provenance, unsafe color syntax, missing modes/tokens, non-V3 or mismatched Alpha input, symlinks, path traversal, invalid raster signatures, duplicate content, oversized files, and output overwrites. It removes local filesystem paths, records deterministic SHA-256 values, binds the exact Alpha runtime attestation and source/build fingerprints, and marks imported full-skin URLs as provisional until the website replaces them.

## Hash a release package

Hash the exact `.tgz` after a trusted publisher builds it:

```bash
node <skill-dir>/scripts/hash-file.mjs --input <absolute-package.tgz>
```

Record the returned `sha256` and `integrity` only in a trusted publisher's release workflow. Never insert them into Creator output or claim that an author's hash is a trusted `artifact` or `payload` digest.

## Validate visually

- Treat browser mockups as drafts, never as proof of compatibility.
- Install a trusted generated package in an isolated `$DSH_HOME`, exercise light/dark/system, and capture real Harness screenshots before publication.
- Verify readable labels, primary actions, errors, warnings, success states, sidebar, dialogs, code surfaces, keyboard focus, and 200% zoom.
- Keep the original authoring file and licensed source evidence outside the install package when either contains private information.

The companion `dsh-theme-manager` Skill must be present from the same reviewed repository revision; it supplies the independent Alpha source and hosted-evidence checks.

## Historical verification

The unchanged [RC.8 sidecar](references/compatibility-v3.json) and `baseline-policy.json` retain the earlier contract. Use `--baseline historical-rc8` explicitly with RC.8 authoring input to reproduce it. This does not upgrade the input or make it eligible for the current Alpha website. `inspect-baseline.mjs certified` inspects that retained lane; RC.2, RC.6 and RC.5 rules remain historical and cannot grant Alpha authority.
