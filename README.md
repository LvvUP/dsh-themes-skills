# DSH-Themes Skills

Open, auditable agent skills for DeepSeek Harness theme workflows.

| Skill | Purpose |
| --- | --- |
| `dsh-theme-manager` | Verify, install, switch, remove, and roll back an exact theme in the `web` profile |
| `dsh-theme-creator` | Create deterministic declarative theme/full-skin manifests without executable author code |
| `dsh-theme-finder` | Classify published hosted releases and curated external showcases without confusing display with installability |
| `dsh-theme-submitter` | Validate a local manifest and hand the user to the website's authenticated submission flow |

Install one skill with a compatible skill installer:

```bash
npx skills add LvvUP/dsh-themes-skills --skill dsh-theme-finder
```

The repository targets DeepSeek Harness `0.1.0-rc.6`. Exact npm integrity and catalog fingerprints are recorded in each skill's compatibility reference. Theme management never edits a Harness installation or `$DSH_HOME` directly; profile mutations go through `dsh plugin --profile web`.

The submitter never asks for, stores, or transmits a browser cookie, API key, or password. It validates locally and opens an ordinary website URL for the user to sign in.

## Distribution safety

Catalog entries have an explicit distribution class. Only `hosted-verified-artifact` entries with Manager installability, allowed redistribution, hosted previews, exact rc.6 fingerprints, a controlled same-origin download route, and a complete `.tgz` SHA-256 can enter the installation workflow.

`external-showcase` entries are fixed, attributed source records for discovery only. They carry no package or install command, expose no certified compatibility fingerprints, use link-only previews, and remain non-installable when a license prohibits commercial use or redistribution still needs rights clearance. An upstream NOTICE may be omitted or represented as `null` only for this external class; a LICENSE URL must never be substituted for a missing NOTICE. The repository never converts or executes third-party theme code automatically.

## Development

Requires Node.js 22 or newer.

```bash
npm test
npm run validate
```

This is an independent community project and is not affiliated with or endorsed by DeepSeek AI. DeepSeek and related names are trademarks of their respective owners.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
