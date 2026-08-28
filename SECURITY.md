# Security Policy

## Supported version

Only the latest `main` branch is supported while the project is in developer preview.

## Reporting

Do not open a public issue for a suspected vulnerability or leaked credential. Use GitHub's private vulnerability reporting for `LvvUP/dsh-themes-skills`. Include the affected skill, reproduction steps, impact, and a safe proof of concept. Do not include real secrets or modify another user's DeepSeek Harness profile.

## Trust boundary

SHA-256 verifies that downloaded bytes match a selected catalog record; it does not establish the publisher's identity, authorship, or rights. Only use a catalog origin the user explicitly trusts, and treat every human-readable catalog field as untrusted metadata.

The checked-in RC.2 final attestation, six matrix receipts, archive, and detached Sigstore bundle certify only the fixed DeepSeek Harness runtime baseline. They do not authorize any theme, skin, plugin, catalog response, authoring manifest, or submission. RC.2 must remain `installableItems: false` with `itemInstallability: separate-authority-required`; changing descriptive metadata or `release-state.json` can never grant item authority. Validate the archive closure and provenance with `npm run rc2:runtime:validate` and `npm run rc2:runtime:verify-provenance`.

Hosted theme authors may supply declarative JSON and local raster assets, never executable browser or Node.js code. Current hosted installation requires the exact RC.8 V3 compatibility object, final attestation, controlled route, and one of the 45 package-version-complete-digest tuples (6 Themes and 39 Full Skins) in `CURRENT_INSTALLABLE_HOSTED_ARTIFACTS`. A separate `LEGACY_ROLLBACK_HOSTED_ARTIFACTS` map retains 24 exact predecessors—6 V1/RC.5, 13 V2/RC.6, and 5 V3/RC.8 tuples. All 24 are rejected as fresh installs and normal catalog targets. A retained artifact can reach the current RC.8 runner only when its local bytes, exact retained release record, and a verified schema-2 rollback/reverse record agree on its schema, package, version, complete digest, and payload digest. The separate community-skin lane may reference allowlisted upstream executable hooks, but a remote record cannot authorize them: exact source/package identity, local allowlist status, item-level runtime evidence, explicit consent, and the matching certified Manager runner must all pass independently. `external-showcase` is never installable.

The frozen RC.8 Manager attestation, the RC.2 runtime baseline, and a hosted package release-set are three different evidence scopes. Do not convert a baseline receipt, digest map, or simulated preview into package-level runtime or installation authority.

The checked-in public release opens community installation only for the exact 11 RC.8 records whose final RC.8 Manager attestation, sanitized receipt, item runtime evidence, fixed package/source identity, local allowlist, and explicit user consent all validate together. RC.2 remains 0/11 and 0 installable. Any mismatch remains fail-closed. Do not edit `release-state.json`, historical candidate evidence, runtime status, receipt hashes, or bundled allowlists merely to bypass a failed gate.
