# Contributing

Keep each skill self-contained: `SKILL.md`, `agents/openai.yaml`, and only the scripts or references it actually needs. Do not introduce author-supplied JavaScript, CSS, HTML, dependencies, lifecycle scripts, or credential files into theme manifests.

Before opening a pull request, use Node.js 22 and run:

```bash
npm ci --ignore-scripts
npm test
npm run validate
```

Do not install the nested runner manually. `npm test` uses the exact Corepack
package manager declared by the runtime, installs its frozen lockfile with
lifecycle scripts disabled, and verifies the committed attestation before tests
execute.

Commits must not contain theme artwork unless its license and source are documented. Report security issues privately as described in [SECURITY.md](SECURITY.md).
