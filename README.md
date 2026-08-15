# DSH-Themes Skills

Open, auditable agent skills for DeepSeek Harness theme workflows.

| Skill | Purpose |
| --- | --- |
| `dsh-theme-manager` | Verify, install, switch, remove, and roll back an exact theme in the `web` profile |
| `dsh-theme-creator` | Create deterministic declarative theme/full-skin manifests without executable author code |
| `dsh-theme-finder` | Search a catalog and return only published, verified, compatible releases |
| `dsh-theme-submitter` | Validate a local manifest and hand the user to the website's authenticated submission flow |

Install one skill with a compatible skill installer:

```bash
npx skills add LvvUP/dsh-themes-skills --skill dsh-theme-finder
```

The repository targets DeepSeek Harness `0.1.0-rc.6`. Exact npm integrity and catalog fingerprints are recorded in each skill's compatibility reference. Theme management never edits a Harness installation or `$DSH_HOME` directly; profile mutations go through `dsh plugin --profile web`.

The submitter never asks for, stores, or transmits a browser cookie, API key, or password. It validates locally and opens an ordinary website URL for the user to sign in.

## Development

Requires Node.js 22 or newer.

```bash
npm test
npm run validate
```

This is an independent community project and is not affiliated with or endorsed by DeepSeek AI. DeepSeek and related names are trademarks of their respective owners.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

