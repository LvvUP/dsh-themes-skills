---
name: dsh-theme-finder
description: Search and filter a trusted DSH-Themes catalog for published, verified DeepSeek Harness themes and full skins. Use when a user wants recommendations by name, mode, or kind; needs an exact rc.6-compatible release; or wants catalog metadata before invoking the installer.
---

# DSH Theme Finder

Return catalog evidence, not invented recommendations. Search only a website/catalog origin the user explicitly trusts.

## Search

Use the bundled read-only client:

```bash
node <skill-dir>/scripts/find-themes.mjs \
  --catalog <https-url-or-absolute-json-path> \
  [--query <words>] [--kind theme|full-skin] [--mode light|dark] \
  [--dsh-version 0.1.0-rc.6] [--limit 10]
```

The client sends no cookies, credentials, or authorization headers. It refuses HTTP, cross-origin redirects, oversized responses, unpublished entries, unverified entries, non-exact versions, unsupported package names, and missing/malformed hashes.

## Present results

For each result, report:

- Name, slug, kind, author, and concise description.
- Exact theme version and exact compatible Harness version.
- Available modes and verification status.
- Artifact SHA-256 and trusted catalog origin before installation.
- Any license or provenance note returned by the catalog.

Do not describe a browser mockup as a real Harness screenshot. Do not say that SHA-256 proves publisher identity. If no exact `0.1.0-rc.6` release exists, state that none passed verification rather than recommending an incompatible theme.

## Hand off to installation

When the user selects a result, invoke `dsh-theme-manager` with the exact catalog record. Never install directly from a search result's free-form description, author URL, preview URL, or mutable `latest` tag.

Read [references/catalog-contract.md](references/catalog-contract.md) only when adapting the client to another DSH-Themes-compatible catalog.
