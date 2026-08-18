<div align="center">

# DSH-Themes Skills

**Open, auditable agent skills for discovering, creating, submitting, and safely managing DeepSeek Harness themes.**

[English](README.md) · [简体中文](README.zh-CN.md)

[![CI](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-16324F)](package.json)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-246BCE)](LICENSE)

### [Explore themes on dsh-themes.com →](https://dsh-themes.com)

</div>

DSH-Themes Skills is a set of four self-contained skills for DeepSeek Harness `0.1.0-rc.6`. It supports two clear workflows:

- **Discover and use:** find catalog evidence with `dsh-theme-finder`, then install or switch an eligible verified artifact with `dsh-theme-manager`.
- **Create and publish:** build a deterministic, data-only manifest with `dsh-theme-creator`, then validate it locally and continue in the website's authenticated submission flow with `dsh-theme-submitter`.

The repository does not directly edit a Harness installation, execute author-supplied theme code, or hand browser credentials to automation.

## Quick start

### 1. Install a skill

Node.js 22 or newer is required.

```bash
npx skills add LvvUP/dsh-themes-skills --skill dsh-theme-finder
```

### 2. Give your agent a concrete task

```text
Find installable full skins for DeepSeek Harness 0.1.0-rc.6 from the
DSH-Themes catalog. Show compatibility, distribution, and license evidence
before handing anything to the theme manager.
```

### 3. Continue on the website

- [Explore themes](https://dsh-themes.com/explore)
- [Read the guides](https://dsh-themes.com/learn)
- [Submit a theme](https://dsh-themes.com/submit)

## The four skills

| Skill | Use it when you need to… |
| --- | --- |
| [`dsh-theme-finder`](skills/dsh-theme-finder/SKILL.md) | Search a trusted catalog and distinguish installable verified artifacts from external showcases. |
| [`dsh-theme-manager`](skills/dsh-theme-manager/SKILL.md) | Verify, install, switch, remove, or roll back one exact theme in the Harness `web` profile. |
| [`dsh-theme-creator`](skills/dsh-theme-creator/SKILL.md) | Create a deterministic declarative theme or full-skin manifest from semantic tokens and local raster assets. |
| [`dsh-theme-submitter`](skills/dsh-theme-submitter/SKILL.md) | Validate a local manifest and hand the author to the website's normal sign-in and moderation flow. |

## How the workflows fit together

| Goal | Flow | Result |
| --- | --- | --- |
| Find and install | `Finder → Manager` | Catalog evidence is classified first; only an eligible hosted artifact can enter the installation workflow. |
| Create and submit | `Creator → Submitter → Website` | The manifest is generated and checked locally; the author signs in and submits it for moderation in their own browser. |

## Trust model

The skills make their trust boundaries explicit:

- Only a `hosted-verified-artifact` record that satisfies the Manager contract can be installed.
- An `external-showcase` is for discovery only. It has no package, install command, or certified compatibility claim.
- SHA-256 proves that downloaded bytes match the selected catalog record; it does **not** prove a publisher's identity.
- The Manager routes Harness operations through its attested launcher, uses exact versions, disables lifecycle scripts during bootstrap, restricts acceptance to loopback, and preserves rollback evidence.
- The Creator accepts declarative JSON and local raster assets—not author JavaScript, CSS, HTML, dependencies, lifecycle scripts, fonts, SVG, or remote runtime assets.
- The Submitter never asks for or transmits a browser cookie, password, API key, or authorization header. Authentication stays in the user's browser.

For the complete boundaries, read each skill's `SKILL.md` and the [Security Policy](SECURITY.md).

## Compatibility and project status

- Verified target: **DeepSeek Harness `0.1.0-rc.6`**.
- Theme changes require a Harness restart.
- The project is in developer preview; only the latest `main` branch is supported.
- This is an independent community project and is not affiliated with or endorsed by DeepSeek AI. DeepSeek and related names are trademarks of their respective owners.

## Development

```bash
npm ci --ignore-scripts
npm test
npm run validate
```

`npm test` bootstraps the nested verified runner with the Corepack-pinned `pnpm@11.7.0`, a frozen lockfile, and lifecycle scripts disabled. It verifies the committed attestation and critical dependency closure before running the test suite.

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Report suspected vulnerabilities through the private process in [SECURITY.md](SECURITY.md), not a public issue.

## Website and license

Browse the live catalog, guides, and submission flow at **[dsh-themes.com](https://dsh-themes.com)**.

Licensed under [Apache-2.0](LICENSE). See [NOTICE](NOTICE) for attribution and trademark information.
