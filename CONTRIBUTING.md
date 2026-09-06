# Contributing

Keep each Skill complete and declare any required companion Skill from the same immutable repository version: `SKILL.md`, `agents/openai.yaml`, and only the scripts or references it actually needs. Do not introduce author-supplied JavaScript, CSS, HTML, dependencies, lifecycle scripts, or credential files into theme manifests. A community runtime or CSS adaptation must use an immutable source revision, retain its license/NOTICE/provenance, and stay non-installable until both item-level runtime evidence and the matching Manager attestation are reviewed in the same release.

Before opening a pull request, use Node.js `22.19+` within Node 22 or `24.15+` within Node 24 and run:

```bash
npm ci --ignore-scripts
npm test
npm run validate
npm run format:check
npm run rc2:runtime:validate
npm run rc2:runtime:verify-provenance
```

Do not substitute a PATH runner. `npm test` uses the exact Corepack
package manager declared by `runtime-rc8`, installs its frozen lockfile with
lifecycle scripts disabled, and verifies the committed attestation before tests
execute. The test runner includes every root `test/*.test.mjs` contract, including the new Alpha contracts. It deliberately does not auto-execute preserved upstream test files; those have their own documented runtime prerequisites and remain source-review evidence. Preserve every file under historical `runtime/` byte-for-byte.

Commits must not contain theme artwork unless its license and source are documented. Current Creator and Submitter default to exact Alpha source V3 drafts. Their independently digest-pinned `compatibility-alpha.json` files must match the reviewed Manager source runtime and hosted compatibility declarations, with `npmArtifacts: null`. RC.8 reproduction requires `--baseline historical-rc8`; the historical Submitter must not produce a current website handoff. RC.6 V2 and RC.5 V1 remain audit-only. The certified RC.2 runtime baseline must remain `installableItems: false`: final baseline receipts, the archive, or Sigstore provenance cannot be used as selector, catalog, hosted-artifact, community-item, authoring, or submission authority. Preserve the historical pending and smoke evidence byte-for-byte and describe it as historical-at-capture rather than current 0/6 status.

The Alpha installation authorities are the 54-entry Manager `alpha-hosted-artifacts.json`, the 38-entry community recipe catalog, and the 100-entry plugin recipe catalog. Eligibility is item-specific: exact source, archive/integrity and runtime evidence must agree. Retired IDs are never reassigned. A successful source build or a new draft cannot promote an item.

Preserved upstream/adapter text may retain CRLF or original whitespace only when its exact file and SHA-256 appear in `scripts/format-preserved-source.json`, with a matching `-text` Git attribute. Do not format those bytes. The checker still verifies UTF-8, NUL, JSON and the digest. After staging, run `npm run format:check -- --check-index` plus `node scripts/sync-alpha-artifact-allowlist.mjs --check --check-tracked` so Git normalization or a missing archive cannot change the release.

## Historical RC.8 authority

Do not add a hosted slug to static authority merely because Finder discovers it. The retained RC.8 executable map contains 45 exact package-version-complete-digest tuples (6 Themes and 39 Full Skins). The promoted v0.7.0 cohort is the exact non-contiguous set `#2030–#2041 + #2043`; `#2042` is issued elsewhere and excluded. Those bytes entered current authority only after real capture-candidate and rebuilt-byte certify-final both passed; any future candidate must remain outside fresh install, Manager handoff, and the runner digest allowlist until its own required gates pass. The rollback-only map contains 24 exact retained predecessors; an entry may be added there only with an authoritative old release record and schema-2 upgrade/reverse tests. Never let pending or rollback-only bytes pass fresh install or normal catalog validation. Keep Finder's community authority byte-identical to the Installer allowlist, and never promote `external-showcase` by changing descriptive metadata alone. Finder's canonical extension kind is `plugin`; accept `ui-extension` only as a compatibility alias and normalize it before output. Report security issues privately as described in [SECURITY.md](SECURITY.md).
