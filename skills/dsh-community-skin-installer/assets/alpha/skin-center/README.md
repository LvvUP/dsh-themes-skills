# Skin Center Alpha source adaptation

The source provenance, archive-preservation report, fixed build script, and companion CSS sources reproduce the final package. The original archive SHA-256 is recorded in source-provenance.json; the separately verified runtime receipt is references/alpha-skin-center-runtime.json from the Skill root.

Run `node build.mjs --archive=/absolute/path/to/the/original-0.2.5.tgz --pack` from this directory. The script writes an isolated .cache beneath the Skill and preserves the original archive assets and per-skin notices. It does not execute the plugin. The original archive remains available at the fixed npm URL in source-provenance.json.

Companion directories qq98 and ths preserve the original RC.8 files in their provenance and mechanically adapt the sidebar selector to Alpha. Installation verifies every listed file, backs up same-name user directories, and restores them on package removal.
