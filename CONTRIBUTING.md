# Contributing

Keep each skill self-contained: `SKILL.md`, `agents/openai.yaml`, and only the scripts or references it actually needs. Do not introduce author-supplied JavaScript, CSS, HTML, dependencies, lifecycle scripts, or credential files into theme manifests. A community runtime or CSS adaptation must use an immutable source revision, retain its license/NOTICE/provenance, and stay non-installable until both item-level runtime evidence and the matching Manager attestation are reviewed in the same release.

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
execute. Preserve every file under historical `runtime/` byte-for-byte.

Commits must not contain theme artwork unless its license and source are documented. Current Creator and Submitter output must remain exact RC.8 V3; RC.6 V2 and RC.5 V1 are audit-only under normal validation. The certified RC.2 runtime baseline must remain `installableItems: false`: final baseline receipts, the archive, or Sigstore provenance cannot be used as selector, catalog, hosted-artifact, community-item, authoring, or submission authority. Preserve the historical pending and smoke evidence byte-for-byte and describe it as historical-at-capture rather than current 0/6 status.

Do not add a hosted slug to static authority merely because Finder discovers it. The reviewed current executable map contains 45 exact package-version-complete-digest tuples (6 Themes and 39 Full Skins). The promoted v0.7.0 cohort is the exact non-contiguous set `#2030–#2041 + #2043`; `#2042` is issued elsewhere and excluded. Those bytes entered current authority only after real capture-candidate and rebuilt-byte certify-final both passed; any future candidate must remain outside fresh install, Manager handoff, and the runner digest allowlist until its own required gates pass. The rollback-only map contains 24 exact retained predecessors; an entry may be added there only with an authoritative old release record and schema-2 upgrade/reverse tests. Never let pending or rollback-only bytes pass fresh install or normal catalog validation. Keep Finder's community authority byte-identical to the Installer allowlist, and never promote `external-showcase` by changing descriptive metadata alone. Finder's canonical extension kind is `plugin`; accept `ui-extension` only as a compatibility alias and normalize it before output. Report security issues privately as described in [SECURITY.md](SECURITY.md).
