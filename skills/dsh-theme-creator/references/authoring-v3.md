# Authoring V3

The normalized output matches the website's RC.8 `FullSkinManifestV3` or `SimpleThemeManifestV3` declaration contract. Creator input selects only `dshPackageVersion`; the generator supplies the exact final compatibility evidence from [compatibility-v3.json](compatibility-v3.json). Authors cannot provide or override attestation evidence, `artifact`, or `payload`. RC.2 runtime-baseline certification does not supply an authoring sidecar, so RC.2 authoring remains disabled even though the runtime baseline is production-ready.

Use this full-skin authoring shape:

```json
{
  "schemaVersion": "3.0",
  "kind": "full-skin",
  "slug": "ocean-workbench",
  "name": "Ocean Workbench",
  "description": "A calm blue workbench skin.",
  "category": "illustrated",
  "version": "1.0.0",
  "license": "CC-BY-4.0",
  "licensePolicy": {
    "url": "https://creativecommons.org/licenses/by/4.0/",
    "commercialUse": "allowed",
    "attributionRequired": true,
    "shareAlikeRequired": false
  },
  "author": { "name": "Example Author", "url": "https://example.com" },
  "copyright": { "source": "original", "aiGenerated": false },
  "compatibility": { "dshPackageVersion": "0.1.0-rc.8" },
  "tokens": {
    "--dsw-alias-bg-base": { "light": "#f8fbff", "dark": "#101827" }
  },
  "assets": [
    { "role": "background", "sourcePath": "assets/background.webp", "mimeType": "image/webp", "width": 1920, "height": 1080 },
    { "role": "sidebar", "sourcePath": "assets/sidebar.webp", "mimeType": "image/webp", "width": 900, "height": 1600 },
    { "role": "card", "sourcePath": "assets/card.webp", "mimeType": "image/webp", "width": 1200, "height": 800 },
    { "role": "preview-light", "sourcePath": "assets/preview-light.webp", "mimeType": "image/webp", "width": 1440, "height": 900 },
    { "role": "preview-dark", "sourcePath": "assets/preview-dark.webp", "mimeType": "image/webp", "width": 1440, "height": 900 }
  ],
  "visual": {
    "preset": "glass",
    "focus": { "x": 70, "y": 50 },
    "surfaceOpacity": 0.82,
    "overlayOpacity": 0.7,
    "borderStrength": 0.55,
    "glowStrength": 0.15
  }
}
```

The example abbreviates `tokens`; real input must include all 13 names below, each with 6- or 8-digit hexadecimal `light` and `dark` values:

- `--dsw-alias-bg-base`
- `--dsw-alias-bg-layer-1`
- `--dsw-alias-bg-layer-2`
- `--dsw-alias-bg-overlay`
- `--dsw-alias-border-l1`
- `--dsw-alias-border-l2`
- `--dsw-alias-brand-primary`
- `--dsw-alias-label-primary`
- `--dsw-alias-label-secondary`
- `--dsw-alias-state-error-primary`
- `--dsw-alias-state-success-primary`
- `--dsw-alias-state-warn-primary`
- `--dsw-specific-sidebar-fill`

Full skins require five distinct, local WebP files: `background`, `sidebar`, `card`, `preview-light`, and `preview-dark`. All input paths must remain under the adjacent `assets/` directory. `visual.focus.x/y` are canonical integer CSS-position percentages from 0 through 100. Creator output uses content-addressed paths and provisional `/api/theme-studio/import/*` URLs, and labels previews `simulated`; the website re-decodes imported files, replaces provisional URLs, and captures real `runtime` screenshots before publication.

`license` is the concise SPDX or `LicenseRef` identifier. `licensePolicy` is mandatory and records the fixed HTTPS license text plus `commercialUse` (`allowed`, `prohibited`, or `rights-clearance-required`) and explicit attribution/share-alike booleans. A `-NC-` identifier must say `prohibited`; `-BY-` and `-SA-` identifiers must declare their matching duties.

For licensed third-party art, use a fixed source rather than a mutable repository root:

```json
{
  "copyright": {
    "source": "licensed",
    "sourceUrl": "https://example.com/project/tree/<fixed-revision>",
    "sourceRevision": "40-or-64-lowercase-hex",
    "noticeUrl": "https://example.com/project/blob/<fixed-revision>/NOTICE",
    "attribution": "Original creator; derivative creator",
    "aiGenerated": false
  }
}
```

Attribution-required licensed art entering hosted review needs both `attribution` and a genuine `noticeUrl`; `attribution` is limited to 256 characters. A LICENSE URL cannot stand in for NOTICE. These fields document a moderation claim rather than proving ownership. If an upstream has no NOTICE, the website may record omitted/null `noticeUrl` only in a separate non-installable external-showcase entry. Noncommercial declarations may enter external showcase review but cannot become hosted installable artifacts without separate rights clearance.

For a palette-only `theme`, omit `copyright`, `assets`, and `visual`, and provide `preview: { "light": "...", "dark": "...", "surface": "optional" }`. Preview values may be reviewed same-origin paths or credential-free HTTPS URLs; they are display media, never runtime dependencies.

The generator emits `schemaVersion: "3.0"` with the entire exact RC.8 final compatibility object. That evidence distinguishes the official Git release mapping from registry-digest-only npm provenance and binds the certified runtime attestation. Do not copy a partial candidate object, change a digest, add fields, or rewrite an RC.6 V2 manifest's version string. Historical V2 is preserved only in [authoring-v2.md](authoring-v2.md).

Authoring input and Creator output must contain neither `artifact` nor `payload`. Only the trusted website publisher may build the canonical payload and complete `.tgz`, record their digests in a release sidecar, and mark runtime previews as verified.
