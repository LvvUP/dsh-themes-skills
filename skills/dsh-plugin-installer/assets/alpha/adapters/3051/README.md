# TDAI Memory Alpha adaptation

`python3 build.py` verifies every original and adapted source byte before producing the deterministic archive. The manifest retains the complete upstream runtime dependency set. The archive is not rebuilt by installation.

The adaptation uses the official Harness home helper for its default data directory and removes API-key fragments from debug diagnostics. An explicitly configured data directory remains honored; existing memory data is never moved automatically. The public catalog documents installation and local SQLite initialization separately from model-based extraction and recall.

The fixed upstream npm archive and git revision, retained licenses, changed files, and source hashes are recorded in `PROVENANCE.json` and `alpha.patch`. The current catalog's runtime receipt is the authority for actual installation results; the source inventory alone does not certify runtime behavior.
