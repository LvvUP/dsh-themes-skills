# Alpha community palette sources

This source folder reproduces the four adapted packages used by catalog IDs #1101–#1112 and #1201–#1203. The 12 numbered Theme Pack choices share one package; all 32 original palette choices remain available across the four packages.

The pinned upstream text sources, original MIT licenses, and per-file source digests are in `upstream/` and each package's `PROVENANCE.json`. Binary previews and wallpapers are excluded. The adaptation preserves palette colors, updates the Alpha store import, persists selection separately from the built-in theme preference, and releases styles on disposal.

For a developer rebuild, install the exact development dependencies declared in this folder's package.json, then run `npm run build`. The build also reads the official clean Alpha source at `DSH_ALPHA_SOURCE` or `~/.dsh-themes/runtimes/0.1.3-alpha.1`; install that runtime with the companion Theme Manager first. `npm test` checks selection persistence and user switching.

The build writes local `packages/`, `artifacts/`, and `catalog.json`. The shipped installer consumes the separately hashed archives in `../artifacts/`; rebuilding source does not automatically replace those verified archives or change the runtime receipts. Historical paths inside the receipt identify the original verification workspace layout.
