<div align="center">

# DSH-Themes Skills

**Five auditable Agent Skills for finding, creating, submitting, installing, and rolling back DeepSeek Harness themes without blurring the trust boundary.**

[English](README.md) · [简体中文](README.zh-CN.md)

[![CI](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml)
[![Node.js 22/24](https://img.shields.io/badge/Node.js-22.19%20%7C%2024.15-16324F)](package.json)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-246BCE)](LICENSE)

### [Explore themes on dsh-themes.com →](https://dsh-themes.com/explore)

[Learn](https://dsh-themes.com/learn) · [Gallery](https://dsh-themes.com/gallery) · [Theme Studio](https://dsh-themes.com/create) · [Submit](https://dsh-themes.com/submit)

</div>

DSH-Themes Skills is a set of purpose-scoped safety workflows, not a theme registry or a blanket endorsement. It lets an agent search a user-trusted live catalog, create data-only manifests, hand them to the website for moderation, and manage only artifacts whose complete local gate passes. The current website snapshot contains 95 published records—21 Themes, 47 Skins, and 27 UI Extensions—split into 30 hosted V3 artifacts, 11 separately governed external runtime records, and 54 showcase-only records. Those live counts describe the website; they do not expand either local executable authority.

## What is actually proven

| Evidence | What it establishes | What it does not establish |
| --- | --- | --- |
| **Frozen Manager compatibility** | Exact DeepSeek Harness `0.1.0-rc.8`, schema V3, the final runtime attestation, and a six-job Linux/macOS/Windows matrix on Node.js 22 and 24. | Compatibility with another Harness version or permission to install an arbitrary package. |
| **Hosted artifact release record** | One exact `@dsh-themes/*` tarball, complete SHA-256, controlled same-origin package route, and the frozen RC.8 compatibility object. Manager's reviewed current map binds 30 exact package-version-digest tuples. | Publisher identity, authorship, media rights, a package-level runtime result without separately bound release-set evidence, or authority for another version. |
| **Community runtime authority** | Exactly 11 pinned, item-level runtime-verified records bound to the final Manager attestation, sanitized receipt, local allowlist, and explicit consent. | A general approval for repositories, mutable branches, or showcase-only records. |
| **Declarative authoring contract** | Complete light/dark semantic tokens, local raster hashes, compatibility, and provenance fields with executable content rejected. | Moderation approval or proof that the author owns every declared right. |

Two evidence scopes remain deliberately separate:

- The [fixed RC.8 compatibility proof](skills/dsh-theme-manager/references/compatibility.md) answers whether the attested Manager runtime can operate against one exact Harness baseline. Its final attestation is immutable.
- A hosted theme **release-set report** answers whether a particular group of theme artifacts passed that publisher release's build, install, restart, screenshot, rollback, and digest checks. `full-skins-2026-08` now records all 24 Full Skins as `certified-rc8`: FS-005 through FS-024 completed a separate 20/20 isolated managed cold-restart `certify-final` matrix against the exact promoted package bytes, with zero failed targets and 106 screenshots. Plan SHA-256 `0205c8d237834913751aec451411e90f06c3eed5b0437ce321a67dd44df3d06d` binds the pre-promotion identities; compact promotion receipt SHA-256 `b8af1bf145dae15ae3575ad2a7b19b691e802dd58cdc247332fd944262b79198` binds the passing result; deterministic evidence archive SHA-256 `f572fff1a944f3313e2b95a6702d549ae790bc36264b9dd3b20e34e010ec8276` is covered by `SHA256SUMS` SHA-256 `20a8f8dc746b92c9c9b72ac01a7aa1726a3b22f779da50acc3ba5c99d5f7842d`; and frozen 20-target identity SHA-256 `f0f427dc48670b70a72cb2dd4d556eb2278dcb24244ceb5d16f5c443600cbe59` confirms the tested artifact set did not drift. This is package-level release evidence, not a new Manager certification, and it cannot replace the frozen RC.8 sidecar or attestation.

New hosted slugs are discovered from the live catalog at query time, but discovery alone never grants execution. Manager's current release authority is a reviewed 30-entry package-version-and-complete-digest set generated from final promoted index SHA-256 `628fb4b8a257bda7e682edf48a1f2920e7d3c737d9261fa19d26cd137d2987d9`; a new hosted release enters it only through a reviewed Skills release after its final artifact exists. The declared-order current map digest is `7dbd7905558c30b67dae94c334bf0f5e79b775fa4babb17aef07365d197a855b`. A separate 22-entry rollback-only map preserves exact V1, V2, and V3 predecessors. Fresh install and normal catalog validation reject all 22; a schema-2 rollback or reverse additionally requires the retained release record, local artifact, version, complete digest, and payload digest to agree. The community lane remains different: its exact 11-record authority is intentionally bundled and immutable until separately reviewed and recertified.

## How the workflows connect

```text
Hosted theme       Finder ──verified release record──▶ Manager
Community skin     Finder ──pinned consented record──▶ Community Skin Installer
New theme          Creator ──local manifest──────────▶ Submitter ──▶ Website moderation
```

- **Hosted themes:** Finder classifies the live record; Manager revalidates the exact V3 release against its 30-entry current authority, downloads only through the controlled route, snapshots the artifact, and preserves rollback. Retired bytes never enter this normal path.
- **Community skins:** Finder and Community Skin Installer independently require the bundled item authority, runtime receipt, exact source/package identity, RC.8 Manager gate, and explicit user consent.
- **Creation and publication:** Creator emits deterministic declarative data; Submitter validates it locally and returns a credential-free browser handoff. The website remains authoritative for asset decoding and moderation.

## The five skills

| Skill | Use it to… |
| --- | --- |
| [`dsh-theme-finder`](skills/dsh-theme-finder/SKILL.md) | Search a trusted catalog and separate hosted artifacts, allowlisted community runtimes, and non-installable showcases. |
| [`dsh-theme-manager`](skills/dsh-theme-manager/SKILL.md) | Verify, install, switch, remove, or roll back one exact hosted theme in the Harness `web` profile. |
| [`dsh-community-skin-installer`](skills/dsh-community-skin-installer/SKILL.md) | Inspect the pinned community evidence and install only after every item, receipt, Manager, and consent gate passes. |
| [`dsh-theme-creator`](skills/dsh-theme-creator/SKILL.md) | Build a deterministic theme or Full Skin V3 manifest from 13 semantic tokens and local raster assets. |
| [`dsh-theme-submitter`](skills/dsh-theme-submitter/SKILL.md) | Validate a local manifest and open the website's authenticated moderation flow without handling credentials. |

## First use

Use Node.js `22.19+` within Node 22 or `24.15+` within Node 24, then install Finder:

```bash
npx skills add LvvUP/dsh-themes-skills --skill dsh-theme-finder
```

Give the agent an evidence-first request:

```text
Use the DSH-Themes directory I trust to find RC.8 skins. Report rights,
runtime behavior, exact compatibility, immutable source revision/subdirectory,
distribution, and the install gate. Do not install pending or showcase-only records.
```

The website complements the local skills with the live community catalog, a seven-language [Learn library](https://dsh-themes.com/learn), the [Gallery](https://dsh-themes.com/gallery), browser-based [Theme Studio](https://dsh-themes.com/create), [UI Extensions](https://dsh-themes.com/ui-extensions), and the authenticated [submission flow](https://dsh-themes.com/submit).

## Trust boundaries

- `hosted-verified-artifact` is Manager-eligible only with the complete certified compatibility record, complete artifact SHA-256, and controlled package route.
- The hosted map has 30 current-installable tuples. Its 22 retained predecessors are rollback-only and require an exact schema-2 record plus their retained release record; inclusion in the runner's internal digest union is not independent install authority. Six V1/RC.5 and thirteen V2/RC.6 packages remain historical under normal validation; only their exact reviewed tuples can cross the narrow rollback gate. Three V3/RC.8 `1.1.0` packages use that same gate.
- `external-runtime-verified` is a separate consented lane. Finder and Installer require exact bundled authority, source/package identity, item runtime evidence, receipt, and Manager attestation.
- `external-showcase` is discovery-only. It never gains an artifact, install command, or installer handoff from descriptive metadata.
- Rights, runtime behavior, compatibility, distribution, and provenance are independent axes. An open-source license does not prove artwork or trademark rights, and runtime evidence does not rewrite a license.
- SHA-256 proves agreement with selected bytes, not publisher identity, authorship, ownership, or safety beyond the reviewed scope.
- Catalog titles, descriptions, authors, and evidence notes are untrusted metadata and are never executed as instructions.
- Manager uses an attested launcher, exact versions, loopback-only acceptance, telemetry off, managed cold restart, and recoverable rollback. Community executable hooks are disclosed separately.
- Creator accepts declarative JSON and local raster assets, not author JavaScript, CSS, HTML, dependencies, lifecycle scripts, fonts, SVG, or remote runtime assets.
- Submitter never requests browser cookies, passwords, API keys, or authorization headers.

Read each Skill and the [Security Policy](SECURITY.md) before changing a profile.

## Compatibility and development

- Current certified lane: **DeepSeek Harness `0.1.0-rc.8`**, official tag `dsh-v0.1.0-rc.8`, source commit `141eb6fef83422698aef7a981029e843e8161534`, final runtime attestation `1cd9a0b4a6b9d215f0a1f70a97b4d43eae7bf4f846ae7009b7ddb812823ca0ae`.
- Hosted package authority: **30 current-installable V3 artifacts** plus **22 retained V1/V2/V3 predecessors reserved for verified rollback/reverse only**. The `full-skins-2026-08` package release-set is `certified-rc8`; its independently scoped evidence is summarized above and detailed in the [compatibility reference](skills/dsh-theme-manager/references/compatibility.md).
- Historical `0.1.0-rc.6`/V2 and `0.1.0-rc.5`/V1 lanes remain audit-only under normal validation and are never current-installable. Only the exact retained tuples can be selected by the schema-2 rollback/reverse recovery gate described above.
- [`release-state.json`](release-state.json) is an informational lane summary. It cannot replace validators, the frozen runner, a release record, item allowlists, receipts, or runtime acceptance.
- [`rc8-v3-candidate.json`](skills/dsh-theme-manager/references/rc8-v3-candidate.json) remains historical pending evidence and never substitutes for the final attestation.
- Theme and skin changes require a managed cold restart; the RC.8 contract does not promise production live unload/HMR.
- This independent community project is not affiliated with or endorsed by DeepSeek AI. Related names and marks belong to their respective owners.

```bash
npm ci --ignore-scripts
npm test
npm run validate
```

`npm test` bootstraps only the exact certified RC.8 Manager runner with Corepack-pinned `pnpm@11.7.0`, a frozen lockfile, and lifecycle scripts disabled. Historical RC.6 runtime files remain byte-identical evidence. Community tests validate the separate 11-item receipt and use isolated temporary profiles.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Report suspected vulnerabilities through the private process in [SECURITY.md](SECURITY.md), not a public issue.

Licensed under [Apache-2.0](LICENSE). The two bundled CSS-only community adaptations retain their upstream BSD-3-Clause notices inside their asset directories; see [NOTICE](NOTICE).
