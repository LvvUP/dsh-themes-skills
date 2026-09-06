# Alpha community palette sources

This source folder reproduces the four adapted packages used by catalog IDs #1101–#1112 and #1201–#1203. The 12 numbered Theme Pack choices share one package; all 32 original palette choices remain available across the four packages.

The pinned upstream text sources, original MIT licenses, and per-file source digests are in `upstream/` and each package's `PROVENANCE.json`. Binary previews and wallpapers are excluded. The adaptation preserves palette colors, updates the Alpha store import, persists selection separately from the built-in theme preference, and releases styles on disposal.

For a developer rebuild, install the exact development dependencies declared in this folder's package.json, then run `npm run build`. The build also reads the official clean Alpha source at `DSH_ALPHA_SOURCE` or `~/.dsh-themes/runtimes/0.1.3-alpha.1`; install that runtime with the companion Theme Manager first. `npm test` checks selection persistence and user switching.

The build writes local `packages/`, `artifacts/`, and `catalog.json`. The shipped installer consumes the separately hashed archives in `../artifacts/`; rebuilding source does not automatically replace those verified archives or change the runtime receipts. Historical paths inside the receipt identify the original verification workspace layout.

## Palette HTTP security update

The `1.0.0-alpha.2` source revision keeps all four client modules, including their bundled palette CSS, byte-for-byte equal to `1.0.0-alpha.1`. Palette colors, selection controls, and layout are unchanged. Exact palette and Premium custom-palette routes now call the official `ctx.connection.requestRejection(req)` before reading or changing settings. The host requires the connection service and rejects requests if that service is unavailable.

Premium writes accept JSON objects with `Content-Type: application/json` and a 64 KiB request-body limit. The installer continues to use the official authenticated local browser request adapter; this update adds no alternate token or cookie mechanism.

Old source files and original receipts are preserved by SHA under `../../../references/history/palette-api-security/`; old content-addressed archives remain at their original paths. Source/build metadata describes the new revision, while `references/community-recipes.json` and its exact runtime receipts determine which archive is currently verified. A reproducible build alone does not promote an archive or reuse an older package's runtime result.

The Alpha security verification recorded 75 request cases, all 32 palette choices, 15 numbered cold restarts, custom palette import/deletion, font-size persistence and built-in theme recovery. The current [palette receipt](../../../references/alpha-palettes-runtime.json) binds the actual executed snapshots and portable evidence. Its console check covers the final healthy navigation only.

The [public three-ID receipt](../../../references/alpha-community-public-installation.json) verifies #1101, #2206 and #2207 together, including the companion edit-conflict protection and successful restore retry. This run used a new isolated store; the raw `reusedStore` field means that a custom store directory was supplied. Initial adds allowed network, and later lifecycle commands explicitly observed offline configuration. The earlier four-run repeatability report remains a historical alpha.1 result.

The separate [upgrade receipt](../../../references/alpha-community-palette-upgrade.json) installs the four old packages without starting their Web host, then upgrades all 15 IDs through the public installer. It records four new adds and eleven within-call skips, the new installed bytes, 15 authenticated selections, one cold restart of the final four-route state, four removals and a repeated removal with no additional remove calls. It does not claim migration of an existing user's alpha.1 selection or a new visual test. [Executed source snapshots and their manifest](../../../references/alpha-palette-public-runs-20260906/manifest.json) preserve both runs; server and CLI configuration logs remain private.
