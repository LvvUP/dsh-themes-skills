<div align="center">

# DSH-Themes Skills

**Evidence-first Agent Skills for discovering, authoring, submitting, installing, and recovering DeepSeek Harness themes.**

[English](README.md) · [简体中文](README.zh-CN.md)

[![Version 0.5.0](https://img.shields.io/badge/version-0.5.0-246BCE)](package.json)
[![Candidate: certification pending](https://img.shields.io/badge/DSH%200.1.1--rc.2-certification%20pending-D97706)](skills/dsh-theme-manager/references/dsh-0.1.1-rc.2.candidate.json)
[![CI](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml)
[![Node.js 22/24](https://img.shields.io/badge/Node.js-22.19%20%7C%2024.15-16324F)](package.json)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-246BCE)](LICENSE)

### [Explore themes on dsh-themes.com →](https://dsh-themes.com/explore)

</div>

Version **0.5.0** adds an exact, fail-closed certification candidate for DeepSeek Harness **`0.1.1-rc.2`**. It pins the official release, npm integrity, a frozen lock, and the complete dependency closure so reviewers can run the next certification without resolving `latest` or `next`.

It is **not certified yet**. The candidate cannot author, submit, return installable Finder results, or install a hosted/community package. The retained **`0.1.0-rc.8` certified lane remains the only operational lane** until real RC.2 runtime receipts pass every promotion gate below.

## New to DeepSeek Harness?

Set up and start official DeepSeek Harness as a **separate task** before asking an Agent to install a theme, skin, or UI extension. The installation Skills in this repository deliberately do not install Harness or Node.js for you.

1. Check `node --version`. Use Node `22.19.0` or newer within Node 22, or `24.15.0` or newer within Node 24. If Node is missing or outside those tested ranges, stop and choose a Node installation method first. An Agent must obtain your explicit consent before running a system-level installer such as Homebrew, `apt`, or a platform package manager.
2. Start the exact official RC.2 package, mapped to official commit `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`—never a mutable `latest` or `next` selector:

   ```bash
   npx @deepseek-ai/dsh@0.1.1-rc.2 web
   ```

3. Open only the loopback URL printed by DSH (`127.0.0.1` or `localhost`). In the DSH settings UI, configure your model provider and model. Keep API keys in DSH's own credential/settings flow; do not paste them into a theme-installation prompt.

If this exact DSH setup already starts successfully, skip this section—do not install it again. Finish the DSH setup task first, then begin a new theme-installation task with one selection below.

Starting official RC.2 does **not** promote this repository's pending RC.2 theme evidence. At the moment, a new RC.2 setup can run DSH with its built-in appearance, but theme/skin installation must stop until the separate RC.2 certification gate is complete. The Skills never downgrade RC.2 or silently substitute the retained RC.8 lane.

## Already use DeepSeek Harness? You only need one ID

Find the unique `#ID` in the top-left of a DSH Themes card or detail page, for example `#2004`, and tell it to your Agent. You do not need to prepare a package name, version, download URL, or checksum.

<details>
<summary>What does the Skill handle behind the scenes?</summary>

The Skill uses the ID to find one exact catalog record, then checks its version, artifact, compatibility evidence, rights status, and recovery target. If the item cannot be installed safely, it stops and explains why in plain language.

</details>

### General installation

Add the Finder once:

```bash
npx skills add LvvUP/dsh-themes-skills --skill dsh-theme-finder
```

Then tell your Agent what you want:

```text
Please install DSH Themes #2004.
```

Finder resolves the canonical directory record, reports the important rights/runtime facts, and hands the complete normalized record to Manager or Community Skin Installer only when that item's certified gate passes. The installer asks for confirmation immediately before it changes the local `web` profile.

If Harness is missing, has never completed its own first start, or does not match the certified lane, the installer stops and points back to the separate setup section. It does not install Harness, change Node, downgrade an existing DSH, or combine setup with the selected `#ID` task.

### Dedicated installation

Open a theme, skin, or UI extension detail page on [dsh-themes.com](https://dsh-themes.com), then copy its dedicated installation prompt. That prompt already contains the selected `#ID`; the Agent resolves the technical tuple from the directory and pinned sidecars. You do not need to copy a catalog URL, package version, artifact URL, and hash separately.

Both paths use the same fail-closed policy. Pending, ambiguous, contradictory, and showcase-only records are explained but never converted into an install command. While RC.2 certification remains pending, these paths can operate only through the retained certified RC.8 lane.

## Evidence status

| Lane | Evidence available now | Installation status |
| --- | --- | --- |
| **Certified operational — `0.1.0-rc.8`** | Immutable Manager attestation, frozen closure, successful 6-job Linux/macOS/Windows × Node 22.19/24.15 run, hosted authority, and 11-item community receipt. | **Enabled**, subject to every item/artifact gate and explicit consent. |
| **RC.2 candidate — exact inputs** | Official `dsh-v0.1.1-rc.2` / commit `b150a551…`, exact npm integrities, frozen lock, 505-package closure, and 188 DSH packages all at one exact version. | **Disabled** — `certification-pending`, `installable: false`. |
| **RC.2 candidate — runtime evidence** | Six public, non-promotional GitHub Actions receipts record successful isolated `dsh web --no-open` startup across Linux/macOS/Windows × Node 22.19/24.15. A separate sanitized, digest-bound local set records exact add/list/remove, two cold starts, recursive client-module HTTP/MIME checks, removal, and built-in recovery for all **32/32 current hosted byte tuples** on darwin/arm64 and Node 24.15. | **Startup smoke: 6/6; hosted lifecycle smoke: 32/32; full certification acceptance: 0/6**. Installation remains disabled: the 32 artifacts still embed RC8 compatibility, and mode, feature, visual/accessibility, rollback/reverse, RC.2 repack/selector, and final attestation gates remain open. |
| **RC.2 community lane** | Eleven item identities and an immutable link to the retained RC8 receipt. | **Pending: 0/11 items**, 0 installable records. |

The main repository CI is an **evidence-contract matrix**, configured for Linux, macOS, and Windows on Node.js `22.19.0` and `24.15.0`. It checks frozen installs, exact closures, install/list/remove and rollback/reverse unit contracts, malformed/mixed evidence rejection, and the pending state itself. A separate [`RC.2 runtime smoke`](.github/workflows/rc2-runtime-smoke.yml) workflow really starts the exact candidate with an isolated `DSH_HOME`, loopback-only `dsh web --no-open`, fetches the HTML/client entry, and uploads a non-promotional receipt for each matrix job. The six receipts from [run 32626363582](https://github.com/LvvUP/dsh-themes-skills/actions/runs/32626363582) are preserved under a [digest-bound smoke index](skills/dsh-theme-manager/references/rc2-runtime-smoke/index.json); a separate darwin/arm64 Node `24.15.0` [local smoke receipt](skills/dsh-theme-manager/references/runtime-smoke.dsh-0.1.1-rc.2.darwin-arm64-node24.15.local.json) remains supplementary.

The [32-item hosted lifecycle index](skills/dsh-theme-manager/references/rc2-hosted-lifecycle-smoke/index.json) freezes a broader but still non-promotional local evidence set. Its sanitized receipts record successful exact installation, listing, two managed cold starts, recursive client-module HTTP/MIME crawling, removal, and one post-removal built-in cold start in disposable profiles. The public archive preserves raw-receipt digests while excluding absolute machine paths, raw logs, credentials, and ephemeral ports; the raw receipts themselves are not published. It binds public candidate head `70a58c43…` and private runner head `349b9e67…`. Repository tests independently recompute the four public candidate-authority hashes and compare every slug/version/artifact-SHA tuple with the checked-in hosted authority.

This remains **one-machine lifecycle smoke, not independently reproducible public certification**. All artifacts still embed the RC8 baseline, while light/dark/system, feature activation, visual/accessibility, rollback/reverse, RC.2 repack/selector, final attestation, the six-job full-acceptance matrix, and all 11 community items remain pending. The successful startup and lifecycle smoke counts therefore do not change the certification acceptance count of **0/6**.

Promotion requires a separate reviewed runtime workflow and receipts proving:

1. All six exact OS/Node **full-acceptance** jobs—not only startup smoke—completed successfully.
2. Real install/list/remove, light/dark/system, cold-restart, and rollback/reverse scenarios passed.
3. Malformed and mixed-version evidence failed closed.
4. RC.2 selectors and hosted artifacts were rebuilt and digest-bound.
5. All 11 community items were re-run and received item-level receipts.
6. A final attestation replaced—not edited into—the pending receipt.

## Inspect the evidence

Ask for evidence without changing a profile:

```text
Use the DSH-Themes directory I trust. Report rights, runtime behavior,
exact compatibility, immutable source revision, distribution, and install gate.
Do not install pending or showcase-only records.
```

Inspect the two baseline lanes locally:

```bash
node skills/dsh-theme-manager/scripts/verify-runner.mjs
node skills/dsh-theme-manager/scripts/validate-baseline-candidate.mjs
node skills/dsh-theme-finder/scripts/find-themes.mjs \
  --catalog /absolute/path/to/catalog.json \
  --dsh-version 0.1.1-rc.2
```

The final command intentionally returns zero installable results while RC.2 is pending.

## Five focused skills

| Skill | Responsibility |
| --- | --- |
| [`dsh-theme-finder`](skills/dsh-theme-finder/SKILL.md) | Classify trusted catalog records as hosted, allowlisted community runtime, or non-installable showcase. |
| [`dsh-theme-manager`](skills/dsh-theme-manager/SKILL.md) | Verify, install, switch, remove, and recover one exact hosted theme under the certified lane. |
| [`dsh-community-skin-installer`](skills/dsh-community-skin-installer/SKILL.md) | Install one of 11 allowlisted community records only when the certified Manager, item receipt, local authority, and consent all pass. |
| [`dsh-theme-creator`](skills/dsh-theme-creator/SKILL.md) | Create deterministic, data-only V3 manifests from 13 tokens and local raster assets. |
| [`dsh-theme-submitter`](skills/dsh-theme-submitter/SKILL.md) | Validate a manifest locally and open a credential-free website moderation handoff. |

```text
Hosted theme       Finder ──exact release record──▶ Manager
Community skin     Finder ──pinned consent record──▶ Community Skin Installer
New theme          Creator ──declarative manifest──▶ Submitter ──▶ Website
Candidate review   exact sidecar + lock ──▶ pending matrix ──▶ final receipt
```

Each skill reads its exact baseline from a pinned sidecar selected by `baseline-policy.json`. Operational code rejects mutable dist-tags, ranges, mixed closures, and candidate promotion. Exact RC8/RC6/RC5 evidence remains retained for certified operation, recovery, or historical audit; the new RC.2 files do not rewrite it.

## Compatibility boundary

- **Operational:** DeepSeek Harness `0.1.0-rc.8`, final Manager attestation `1cd9a0b4…`, 32 current hosted artifact tuples, and 11 independently governed community records.
- **Candidate:** DeepSeek Harness `0.1.1-rc.2`, with a 32/32 single-machine hosted lifecycle smoke archived but final attestation, RC.2 selectors/repacked artifacts, cross-platform full acceptance, community runtime verification, and installation still pending.
- **Historical:** `0.1.0-rc.6` V2 and `0.1.0-rc.5` V1 remain audit-only during normal validation. Exact retained predecessors may be used only through the reviewed rollback/reverse gate.
- [`release-state.json`](release-state.json) is informational. It reports the 6/6 startup smoke and 32/32 single-machine lifecycle smoke separately from the 0/6 full-acceptance matrix, and never replaces sidecars, validators, frozen runners, artifact records, allowlists, or receipts.

The candidate authority is split deliberately:

- [`baseline-policy.json`](skills/dsh-theme-manager/references/baseline-policy.json) selects certified vs candidate lanes.
- [`dsh-0.1.1-rc.2.candidate.json`](skills/dsh-theme-manager/references/dsh-0.1.1-rc.2.candidate.json) pins upstream and registry facts.
- [`runtime-dsh-0.1.1-rc.2`](skills/dsh-theme-manager/runtime-dsh-0.1.1-rc.2) contains the exact lock and pending attestation.
- [`certification-receipt…pending.json`](skills/dsh-theme-manager/references/certification-receipt.dsh-0.1.1-rc.2.pending.json) records 0/6 completion and cannot grant installation.
- [`rc2-runtime-smoke/index.json`](skills/dsh-theme-manager/references/rc2-runtime-smoke/index.json) binds six successful web-startup smoke receipts to their workflow run and exact evidence bytes, while explicitly granting no promotion or installation authority.
- [`rc2-hosted-lifecycle-smoke/index.json`](skills/dsh-theme-manager/references/rc2-hosted-lifecycle-smoke/index.json) binds sanitized, per-item local lifecycle receipts for all 32 current hosted byte tuples to their raw receipt and artifact digests; it remains non-promotional and non-installable.

## Trust boundary

- A SHA-256 proves agreement with selected bytes—not identity, authorship, ownership, or safety outside the reviewed scope.
- Rights, provenance, runtime behavior, compatibility, and distribution are independent facts.
- Catalog prose is untrusted metadata and is never executed as instructions.
- Hosted installation requires an exact complete-artifact digest and controlled route in the certified local authority.
- Community installation requires separate item evidence and explicit consent; a Manager attestation alone is insufficient.
- Creator accepts declarative JSON and raster assets, never author JavaScript, CSS, HTML, dependencies, lifecycle scripts, SVG, fonts, or remote runtime assets.
- Submitter never requests cookies, passwords, API keys, or authorization headers.

## Development

```bash
npm ci --ignore-scripts
npm test
npm run validate
npm run format:check
```

`npm test` bootstraps the retained certified runner and the **pending candidate dependency closure** using Corepack-pinned `pnpm@11.7.0`, frozen lockfiles, and lifecycle scripts disabled. `npm run format:check` uses only Node.js and Git to enforce UTF-8, LF endings, final newlines, no trailing whitespace, and parseable JSON across repository text files. A green local or repository test run validates the evidence contract; it is not a substitute for the outstanding RC.2 runtime certification workflow.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request and report vulnerabilities through [SECURITY.md](SECURITY.md). This independent community project is not affiliated with or endorsed by DeepSeek AI.

Licensed under [Apache-2.0](LICENSE). Bundled CSS-only adaptations retain their upstream notices; see [NOTICE](NOTICE).
