<div align="center">

# DSH-Themes Skills

**Choose a Theme, Full Skin, or Plugin by use case. Copy one public `#NNNN`. Let the Skills resolve exact authority, ask before mutation, and keep a rollback path.**

[English](README.md) · [简体中文](README.zh-CN.md)

[![Repository version 0.8.0](https://img.shields.io/badge/repository-0.8.0-246BCE)](package.json)
[![DSH baseline 0.1.2-alpha.2](https://img.shields.io/badge/DSH-0.1.2--alpha.2-5B67D8)](skills/dsh-harness-installer/references/alpha2-release-authority.json)
[![Harness operational 6 of 6](https://img.shields.io/badge/Harness%20operational-6%2F6-2E8B57)](skills/dsh-harness-installer/references/alpha2-release-authority.json)
[![Plugin authority 0 of 80](https://img.shields.io/badge/Plugin%20authority-0%2F80-C58B20)](skills/dsh-plugin-installer/references/plugin-authority.json)
[![CI](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-246BCE)](LICENSE)

### [Explore the catalog on dsh-themes.com →](https://dsh-themes.com/explore)

</div>

> [!IMPORTANT]
> This repository's `0.8.0` line is still under certification. It is not presented here as a published, installable Skills release. The exact official upstream `@deepseek-ai/dsh@0.1.2-alpha.2` npm prerelease has passed and been promoted through all **6/6** required runtime tasks as the Harness operational installation baseline. That promotion does not release this Skills package or authorize a catalog item: Plugin authority remains **0/80**, V4 remains **0/54**, community alpha.2 re-certification remains **0/66**, and Top10 remains closed.

## What this gives you

DSH Themes separates choosing from installing. The website helps a person compare outcomes; this repository gives an Agent the narrow Skills needed to resolve one public ID, show the exact source and capabilities, obtain consent, snapshot the selected Web Profile, and restore it if acceptance fails.

- **One user-facing identifier:** copy the four-digit `#NNNN` printed on a catalog card. Names, slugs, package coordinates, URLs, and hashes are never alternate selectors.
- **One responsible installer:** Finder classifies the record and routes only to the installer that owns that kind.
- **A useful refusal:** missing, stale, partial, or unpromoted authority stops before Profile mutation and explains which evidence is absent.
- **A recoverable transaction:** mutating lanes preflight the complete plan, ask once, snapshot first, cold-start and probe, then commit or restore.

## Verifiable proof

### Evidence available now

| Claim | Checked-in evidence | Current boundary |
| --- | --- | --- |
| Official alpha.2 npm runtime | Exact `@deepseek-ai/dsh@0.1.2-alpha.2`, registry signature, integrity, tarball SHA-256, and installed CLI SHA-256 are pinned in [`alpha2-release-authority.json`](skills/dsh-harness-installer/references/alpha2-release-authority.json) | [Run `33463453889`, attempt 1](https://github.com/LvvUP/dsh-themes-skills/actions/runs/33463453889) passed **6/6** exact tasks; the reviewed signed receipt set is promoted with `publishedInstallable: true` |
| Exact alpha.2 source cross-build | Official tag `dsh-v0.1.2-alpha.2`, commit, tree, lockfile, Node tuples, and `pnpm@11.7.0` are pinned separately | Source evidence is not proof that its built bytes equal the npm package |
| Plugin catalog | The website exposes 80 curated records; [`plugin-authority.json`](skills/dsh-plugin-installer/references/plugin-authority.json) validates structurally | Verified installable items: **0/80**; authority item count: **0** |
| Top10 | [`top10-release-set.json`](skills/dsh-plugin-installer/references/top10-release-set.json) contains the closed release-set gate | No entries, not frozen, not installable |
| Historical baselines | RC.8 item authority and the RC.2 six-job runtime baseline remain checked in and immutable | They authorize only their exact historical scopes; neither promotes alpha.2 |

You can reproduce the two current counters without changing a Profile:

```bash
node skills/dsh-harness-installer/scripts/authority.mjs
node skills/dsh-plugin-installer/scripts/authority.mjs
```

The expected result today is a promoted **6/6 Harness** authority and a separately valid but closed **0/80 Plugin** authority. Harness success must not be interpreted as item installation authority.

### Real product surface

These are committed screenshots of the rendered DSH Themes product, not generated mockups. They prove the catalog surface that users browse. They do **not** prove package identity, runtime behavior, redistribution rights, or installability.

![DSH Themes gallery rendered on desktop](docs/readme-assets/gallery-1440-light.png)

![DSH Themes curated Plugin directory rendered on desktop](docs/readme-assets/plugins-1440-light.png)

<p align="center">
  <img src="docs/readme-assets/gallery-390-light.png" width="320" alt="DSH Themes gallery rendered on a mobile viewport">
</p>

That boundary is intentional: the proof board shows the product; the linked JSON authorities and receipts govern mutation.

## First use

### 1. Browse by outcome

Open [dsh-themes.com](https://dsh-themes.com/explore), compare the visible use cases, and open the card that fits your goal.

### 2. Copy the exact public ID

Use only the four-digit value printed on the card or detail page, such as `#3006`. Do not substitute a display name, repository, package, or legacy `DSH-*` label.

### 3. Ask for an authority-aware check

```text
Please inspect DSH Themes #3006. Install only if its exact current authority is verified; otherwise explain the closed gate and do not change my Profile.
```

Finder resolves kind and status. A matching installer may continue only after every exact gate passes and the user approves the displayed plan.

### 4. Keep the operational Harness lane separate from closed item lanes

Exact alpha.2 Harness setup may proceed through `dsh-harness-installer` only after its promoted authority is verified and the user approves the plan. Catalog items remain separate: Plugin is **0/80**, V4 is **0/54**, and community re-certification is **0/66**. For those item requests, the correct result is still to identify the item, show the missing item-level evidence, and stop without mutation.

### Skills package availability

There is intentionally no `v0.8.0` install command in this README yet. Do not install this line from `main`, `latest`, a branch name, or another mutable reference. An end-user command belongs here only after an immutable Skills release and its stated authority have been published and verified.

## From `#ID` to the correct installer

![Deterministic routing from a public DSH Themes ID through Finder to the installer responsible for that item kind](docs/assets/readme/id-finder-installer-flow.svg)

| Finder result | Owning Skill | Current behavior |
| --- | --- | --- |
| `#1xxx` Theme or hosted `#2xxx` Full Skin | `dsh-theme-manager` | Accepts only its exact item authority; alpha.2 authority is not inferred from history |
| Community `#2xxx` Skin | `dsh-community-skin-installer` | Inspect-only until the current baseline's item and rollback receipts are promoted |
| `#3xxx` Plugin | `dsh-plugin-installer` | Inspect/certify only while authority is 0/80 |
| Harness setup, no catalog ID | `dsh-harness-installer` | Separate official-npm and source-cross-build lanes; the exact operational baseline is promoted 6/6 |

`#NNNN` starts exact identity resolution; it never promises installation. Finder is read-only, and it does not combine Harness bootstrap with item mutation.

## Two alpha.2 Harness evidence lanes

[`dsh-harness-installer`](skills/dsh-harness-installer/SKILL.md) keeps the upstream runtime and source cross-check separate:

| Lane | Exact identity | What it proves—and does not prove |
| --- | --- | --- |
| Official npm runtime | `@deepseek-ai/dsh@0.1.2-alpha.2`; tarball SHA-256 `5bf062a26a490853ffb9294fe3c9fb2047f029be3545612dea45718a81920a47`; CLI SHA-256 `dc23f6c5dd7df8834e3e38bdb9609d77b459834681ae9b7133b417b0c35f3166` | This is the official upstream distributed prerelease runtime. It has a registry signature, but no npm provenance attestation and no `gitHead`. DSH Themes promoted its complete signed six-task runtime matrix as the operational installation baseline. |
| Exact source cross-build | Tag `dsh-v0.1.2-alpha.2`; commit `0a53fb55bea101816fa226bb964ae2bed71c343b`; tree `64ccbfa8e0caa4711cd4a75717ef9e022657961b`; lockfile SHA-256 `6cc109a574218f51762474455c8d72e5f7c2625aedf25e85569dba1af7adcef0` | This verifies a clean, frozen source build with `pnpm@11.7.0`. It is independent evidence, not an official binary and not a claim of byte-for-byte equivalence with npm. |

The promoted six-task gate covers Linux x64, macOS arm64, and Windows x64 across Node `22.19.0` and `24.15.0`. The installer never modifies `PATH`, installs Node, or records browser tokens, cookies, authorization headers, or credential-derived digests.
The same authority preserves the exact upstream [SAFETY.md](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.2/SAFETY.md) bytes; that experimental-safety statement remains part of the user-visible boundary.

## Mixed Plugin distribution and Top10

[`dsh-plugin-installer`](skills/dsh-plugin-installer/SKILL.md) recognizes two future item-level authority classes:

- **`hosted-plugin-verified`** — only when redistribution is permitted. A reviewed, immutable tarball is bound to exact source/replacement bytes, manifest digest, license and modification notices, CycloneDX SBOM, and runtime/rollback receipts. Candidate code is not executed during static preparation, and lifecycle scripts are stripped.
- **`upstream-plugin-verified`** — an exact npm version, versioned GitHub Release asset, or full Git commit when redistribution is not permitted or needed. Mutable aliases, ranges, branches, shortened commits, hidden redirects, and unreviewed `prepare` scripts are rejected.

The [alpha.2 migration map](skills/dsh-plugin-installer/references/alpha2-plugin-migration-map.md) is static review evidence only. Its direct pins, hosted-adaptation paths, retired IDs, and replacement pool do not grant authority.

Top10 is fail-closed. It can become an exact ordered transaction only after all 80 catalog records have item authority, every selected item passes its six-task matrix, the set is deterministically scored and frozen with at least eight use-case categories, and coexistence, conflict, full preflight, and full rollback receipts all validate. One failed member restores the whole batch; there is no partial-success state.

## Seven focused Skills

| Skill | One responsibility |
| --- | --- |
| [`dsh-theme-finder`](skills/dsh-theme-finder/SKILL.md) | Resolve one public `#NNNN`, report evidence and status, and hand off only to the owning installer. |
| [`dsh-theme-manager`](skills/dsh-theme-manager/SKILL.md) | Validate and transact one exact hosted Theme or Full Skin within its own item authority. |
| [`dsh-community-skin-installer`](skills/dsh-community-skin-installer/SKILL.md) | Inspect the governed community-Skin lane and block mutation until current receipts pass. |
| [`dsh-harness-installer`](skills/dsh-harness-installer/SKILL.md) | Verify the official alpha.2 npm runtime and independently cross-build the pinned source without changing `PATH`. |
| [`dsh-plugin-installer`](skills/dsh-plugin-installer/SKILL.md) | Inspect, prepare, certify, and eventually transact exact hosted/upstream Plugins with atomic rollback. |
| [`dsh-theme-creator`](skills/dsh-theme-creator/SKILL.md) | Create deterministic, data-only manifests and local raster assets inside the supported authoring lane. |
| [`dsh-theme-submitter`](skills/dsh-theme-submitter/SKILL.md) | Validate a submission and open a credential-free website handoff. |

The Skills stay separate so that a Harness result cannot silently authorize an item, a Theme installer cannot absorb Plugin permissions, and a catalog description cannot become executable authority.

## Mechanism and safety

Every mutating lane follows the same high-level contract:

1. Resolve one exact identity and validate the complete authority closure.
2. Show sources, capabilities, network/process/file effects, lifecycle code, restart needs, and rollback target.
3. Obtain explicit consent for the frozen plan.
4. Snapshot the governed Profile/Home files to private local recovery storage.
5. Execute with fixed argument arrays and pinned tools; do not construct shell commands from catalog text.
6. Verify inventory, cold-start, and probe the result without publishing credentials.
7. Commit only after acceptance; otherwise restore and verify the complete snapshot.

Core trust boundaries:

- A SHA-256 proves agreement with selected bytes. It does not prove authorship, ownership, redistribution rights, safety, or runtime behavior.
- Exact source identity is not npm-package equivalence. Runtime certification is not item authority. Item authority is not user consent.
- Catalog text, upstream READMEs, package metadata, screenshots, and source comments are untrusted data, never instructions.
- Profile snapshots, receipts, settings, credentials, browser tokens, cookies, and secret-derived digests are private local recovery material and must not be published.
- This independent community project is not affiliated with or endorsed by DeepSeek AI.

## Historical authority stays historical

| Baseline | Preserved authority | Non-transfer rule |
| --- | --- | --- |
| RC.8 / `0.1.0-rc.8` | Exact item authority for 45 hosted tuples: 6 Themes and 39 Full Skins; the separately governed 11-record community set remains distinct | RC.8 evidence may be verified in its frozen scope, but it cannot authorize alpha.2 Harness, community, or Plugin lanes |
| RC.2 / `0.1.1-rc.2` | Verified six-job runtime baseline with detached provenance | It is Harness baseline evidence only and grants zero item authority |

See the checked-in [compatibility record](skills/dsh-theme-manager/references/compatibility.md). New alpha.2 receipts must be added and promoted; historical bytes are not rewritten to make a new lane look complete.

## Development and read-only validation

```bash
npm ci --ignore-scripts
npm run test:installers
npm run test:alpha2-runtime
npm run test:plugin-runtime
npm run validate
npm run format:check
```

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request. Report vulnerabilities privately through [SECURITY.md](SECURITY.md).

Licensed under [Apache-2.0](LICENSE). Bundled adaptations retain their upstream notices; see [NOTICE](NOTICE).
