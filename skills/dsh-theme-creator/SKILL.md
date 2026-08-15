---
name: dsh-theme-creator
description: Create and validate deterministic declarative manifests for DSH-Themes token themes and full skins. Use when authoring a new DeepSeek Harness theme from colors and local raster art, checking the 13 semantic tokens, recording copyright provenance, hashing assets, or preparing a safe manifest for website submission.
---

# DSH Theme Creator

Create data-only themes for DeepSeek Harness `0.1.0-rc.6`. Do not accept or generate author-supplied JavaScript, CSS, HTML, dependencies, lifecycle scripts, fonts, SVG, remote runtime assets, or hashed class selectors.

## Create

1. Read [references/authoring-v2.md](references/authoring-v2.md).
2. Make an authoring JSON file beside an `assets/` directory. Use normalized WebP files that the user has the right to publish; send JPEG/PNG originals through the website Theme Studio instead.
3. Provide all 13 tokens with complete `light` and `dark` hexadecimal values and check contrast in the real Harness UI.
4. For a full skin, provide distinct background, sidebar, card, light-preview, and dark-preview rasters plus the shared focus point.
5. Record copyright provenance. Never infer ownership from file possession.
6. Generate a normalized manifest:

   ```bash
   node <skill-dir>/scripts/create-manifest.mjs \
     --input <authoring.json> \
     --output <new-manifest.json>
   ```

The generator rejects unknown fields, unsafe color syntax, missing modes/tokens, incompatible DSH versions, symlinks, path traversal, invalid raster signatures, duplicate content, oversized files, and output overwrites. It removes local filesystem paths, records deterministic SHA-256 values, and marks imported full-skin URLs as provisional until the website replaces them.

## Hash a release package

Hash the exact `.tgz` after a trusted publisher builds it:

```bash
node <skill-dir>/scripts/hash-file.mjs --input <absolute-package.tgz>
```

Record the returned `sha256` and `integrity` only in the published release record. Do not claim that a theme author's submission hash is the trusted package hash.

## Validate visually

- Treat browser mockups as drafts, never as proof of compatibility.
- Install a trusted generated package in an isolated `$DSH_HOME`, exercise light/dark/system, and capture real Harness screenshots before publication.
- Verify readable labels, primary actions, errors, warnings, success states, sidebar, dialogs, code surfaces, keyboard focus, and 200% zoom.
- Keep the original authoring file and licensed source evidence outside the install package when either contains private information.
