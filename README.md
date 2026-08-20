<div align="center">

# DSH-Themes Skills

**Open, auditable agent skills for discovering, creating, submitting, and safely managing DeepSeek Harness themes and community skins.**

[English](README.md) · [简体中文](README.zh-CN.md)

[![CI](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml)
[![Node.js 22+](https://img.shields.io/badge/Node.js-22%2B-16324F)](package.json)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-246BCE)](LICENSE)

### [Browse the Gallery on dsh-themes.com →](https://dsh-themes.com/gallery)

</div>

DSH-Themes Skills contains five self-contained skills. The hosted Manager lane remains certified for exact DeepSeek Harness `0.1.0-rc.6`. Exact `0.1.0-rc.8` is the upstream V3 certification target: Finder can inspect its directory evidence, but the public Manager and all community-skin records remain fail-closed until the missing runtime gates are released together.

The repository supports three workflows:

- **Hosted themes:** `Finder → Manager` for an exact verified `@dsh-themes/*` artifact.
- **Community skins:** `Finder → Community Skin Installer` for pinned rights/runtime evidence. The current release is inspection-only; installation requires both item-level runtime verification and an RC.8 Manager attestation.
- **Create and publish:** `Creator → Submitter → Website` for deterministic declarative manifests and the normal authenticated moderation flow.

## Quick start

Node.js 22 or newer is required.

```bash
npx skills add LvvUP/dsh-themes-skills --skill dsh-theme-finder
```

Give the agent a concrete evidence request:

```text
Use the DSH-Themes directory to find RC.8 skins. Show the separate rights,
runtime, compatibility, immutable source revision/subdirectory, and install
gate status. Do not install pending or showcase-only records.
```

Continue on the website:

- [Gallery](https://dsh-themes.com/gallery)
- [UI Extensions](https://dsh-themes.com/ui-extensions)
- [Contributors](https://dsh-themes.com/contributors)
- [Theme Studio](https://dsh-themes.com/submit)

## The five skills

| Skill | Use it when you need to… |
| --- | --- |
| [`dsh-theme-finder`](skills/dsh-theme-finder/SKILL.md) | Search a trusted catalog and classify hosted artifacts, allowlisted community runtimes, and non-installable showcases. |
| [`dsh-theme-manager`](skills/dsh-theme-manager/SKILL.md) | Verify, install, switch, remove, or roll back one exact hosted theme in the Harness `web` profile. |
| [`dsh-community-skin-installer`](skills/dsh-community-skin-installer/SKILL.md) | Inspect pinned Skin Center/community-adaptation evidence and enforce the RC.8 item plus Manager gates. |
| [`dsh-theme-creator`](skills/dsh-theme-creator/SKILL.md) | Create a deterministic declarative theme or Full Skin manifest from semantic tokens and local raster assets. |
| [`dsh-theme-submitter`](skills/dsh-theme-submitter/SKILL.md) | Validate a local manifest and hand the author to the website's sign-in and moderation flow. |

## Trust model

- `hosted-verified-artifact` is Manager-eligible only with the full certified compatibility record, complete artifact SHA-256, and controlled package route.
- `external-runtime-verified` is a separate consented lane. Finder and Installer both require the bundled allowlist, exact source/package identity, item-level runtime evidence, and an exact RC.8 Manager attestation.
- `external-showcase` is always discovery-only. It has no artifact, install command, or installer handoff.
- Rights, runtime behavior, compatibility, distribution, and source provenance are independent axes. An open-source license does not prove media or trademark rights, and a runtime receipt does not upgrade a license.
- SHA-256 proves agreement with selected bytes, not publisher identity, authorship, or ownership.
- Human-readable catalog text is untrusted metadata and is never executed as an instruction.
- The Manager uses an attested launcher, exact versions, loopback-only acceptance, telemetry off, and rollback evidence. Community executable hooks remain separately disclosed.
- Creator accepts declarative JSON and local raster assets—not author JavaScript, CSS, HTML, dependencies, lifecycle scripts, fonts, SVG, or remote runtime assets.
- Submitter never requests browser cookies, passwords, API keys, or authorization headers.

Read each Skill and the [Security Policy](SECURITY.md) for the complete boundaries.

## Compatibility status

- Upstream/V3 target: **DeepSeek Harness `0.1.0-rc.8`**, official tag `dsh-v0.1.0-rc.8`, commit `141eb6fef83422698aef7a981029e843e8161534`.
- Current certified Manager lane: **`0.1.0-rc.6`**.
- Historical V1 lane: **`0.1.0-rc.5`**; never treated as current.
- [`release-state.json`](release-state.json) is the canonical informational lane summary. It does not replace validators, frozen runner evidence, item allowlists, or runtime acceptance.
- [`rc8-v3-candidate.json`](skills/dsh-theme-manager/references/rc8-v3-candidate.json) records exact candidate digests while selector/runtime authority remains explicitly `null`; its validator returns a non-installable result.
- Theme and skin changes require a Harness restart.
- This independent community project is not affiliated with or endorsed by DeepSeek AI. Related names and marks belong to their respective owners.

## Development

```bash
npm ci --ignore-scripts
npm test
npm run validate
```

`npm test` bootstraps only the exact certified RC.6 Manager runner with Corepack-pinned `pnpm@11.7.0`, a frozen lockfile, and lifecycle scripts disabled. RC.8 candidate and community tests validate fail-closed evidence without mutating a Harness profile.

Contributions are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Report suspected vulnerabilities through the private process in [SECURITY.md](SECURITY.md), not a public issue.

Licensed under [Apache-2.0](LICENSE). The two bundled CSS-only community adaptations retain their upstream BSD-3-Clause notices inside their asset directories; see [NOTICE](NOTICE).
