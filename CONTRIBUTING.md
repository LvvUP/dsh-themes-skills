# Contributing

Keep each skill self-contained: `SKILL.md`, `agents/openai.yaml`, and only the scripts or references it actually needs. Do not introduce author-supplied JavaScript, CSS, HTML, dependencies, lifecycle scripts, or credential files into theme manifests. A community runtime or CSS adaptation must use an immutable source revision, retain its license/NOTICE/provenance, and stay non-installable until both item-level runtime evidence and the matching Manager attestation are reviewed in the same release.

Before opening a pull request, use Node.js `22.19+` within Node 22 or `24.15+` within Node 24 and run:

```bash
npm ci --ignore-scripts
npm test
npm run validate
```

Do not substitute a PATH runner. `npm test` uses the exact Corepack
package manager declared by `runtime-rc8`, installs its frozen lockfile with
lifecycle scripts disabled, and verifies the committed attestation before tests
execute. Preserve every file under historical `runtime/` byte-for-byte.

Commits must not contain theme artwork unless its license and source are documented. Current Creator and Submitter output must remain exact RC.8 V3; RC.6 V2 and RC.5 V1 are audit-only. Keep Finder's community authority byte-identical to the Installer allowlist, and never promote `external-showcase` by changing descriptive metadata alone. Report security issues privately as described in [SECURITY.md](SECURITY.md).
