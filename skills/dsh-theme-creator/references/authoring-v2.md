# Authoring V2

The normalized output matches the website's `FullSkinManifestV2` contract. Local assets receive content-addressed paths and provisional `/theme-studio/import/*` URLs. The website must import the files, replace those URLs, decode the images again, and build the trusted package.

Use this full-skin authoring shape:

```json
{
  "schemaVersion": "2.0",
  "kind": "full-skin",
  "slug": "ocean-workbench",
  "name": "Ocean Workbench",
  "description": "A calm blue workbench skin.",
  "version": "1.0.0",
  "license": "CC-BY-4.0",
  "author": { "name": "Example Author", "url": "https://example.com" },
  "copyright": {
    "source": "original",
    "aiGenerated": false
  },
  "compatibility": { "dshPackageVersion": "0.1.0-rc.6" },
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
    "focus": { "x": 0.7, "y": 0.5 },
    "surfaceOpacity": 0.82,
    "overlayOpacity": 0.7,
    "borderStrength": 0.55,
    "glowStrength": 0.15
  }
}
```

The example abbreviates `tokens`; real input must include all 13 names listed below, each with 6- or 8-digit hexadecimal `light` and `dark` values:

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

Full skins require five distinct raster files: `background`, `sidebar`, `card`, `preview-light`, and `preview-dark`. All input paths must remain under the adjacent `assets/` directory. Creator output marks previews as simulated; the website replaces them with real `runtime` screenshots before publication.

For a palette-only `theme`, omit `copyright`, `assets`, and `visual`, and provide `preview: { "light": "...", "dark": "...", "surface": "optional" }`. Preview values may be reviewed same-origin paths or credential-free HTTPS URLs.

Compatibility is pinned to:

- DSH package version `0.1.0-rc.6`
- DSH npm integrity `sha512-brpZfED7ieRa2PQ5tUxMhHrM1pb2CmKFVM/f6yMULBDMicahk+Z2OsHgTwTDnoiZm23Ftu9rQz0NN4pflaoJcg==`
- Main frontend JS SHA-256 `a40165a9916acf9c5710e440842c9a56bc472ae9991f37f4675a7664ae784d68`
- Token catalog SHA-256 `fe38fdb18dae76f3cc93e3ca3a37bb1916f207180781b1aa8321ee2ddadcb926`
- Selector catalog SHA-256 `e544ff5a3f7edacced0c5c9ed8fd26cb598b3d01d1298b10952a64876beaf7fd`
