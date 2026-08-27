---
name: dsh-theme-creator
description: Create and validate deterministic declarative manifests for DSH-Themes token themes and full skins. Use when authoring a new DeepSeek Harness theme from colors and local raster art, checking the 13 semantic tokens, recording copyright provenance, hashing assets, or preparing a safe manifest for website submission.
---

# DSH Theme Creator

Create data-only schema V3 themes for the exact certified baseline named by `references/baseline-policy.json`. Derive its version only from the pinned compatibility sidecar. Do not accept or generate author-supplied JavaScript, CSS, HTML, dependencies, lifecycle scripts, fonts, SVG, remote runtime assets, or hashed class selectors.

The currently selected certified authoring sidecar is DeepSeek Harness `0.1.0-rc.8`; this sentence is descriptive, while the sidecar remains executable authority.

Public catalog identity is assigned by the website only after moderation. Creator and Submitter never mint, accept, or preserve a user-chosen public ID or legacy `DSH-*` label; published selections use the site's exact four-digit `#NNNN` contract, while the manifest slug remains discovery metadata rather than installation authority.

`node <skill-dir>/scripts/inspect-baseline.mjs certifiedRuntimeBaseline` exposes the verified RC.2 runtime baseline. It must report `baseline-certified`, `productionReady: true`, and `enabled: false`: runtime certification does not grant an authoring sidecar. The immutable `candidate` view remains historical-at-capture evidence only. Do not author or publish RC.2 manifests until a separately reviewed authoring authority is added.

The generator accepts only `schemaVersion: "3.0"` authoring input that selects the certified sidecar's exact version, then inserts the complete fixed compatibility evidence from [references/compatibility-v3.json](references/compatibility-v3.json). It never accepts author-supplied attestation fields and never emits `artifact` or `payload`. RC.6 V2 and RC.5 V1 remain historical, non-output formats.

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

The generator rejects unknown fields, contradictory license policies, incomplete third-party provenance, unsafe color syntax, missing modes/tokens, non-V3 or non-RC.8 input, symlinks, path traversal, invalid raster signatures, duplicate content, oversized files, and output overwrites. It removes local filesystem paths, records deterministic SHA-256 values, binds the exact final RC.8 attestation and compatibility fingerprints, and marks imported full-skin URLs as provisional until the website replaces them.

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
