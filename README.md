<div align="center">

# DSH Themes Skills

**Find a theme by its catalog number. Install it in the right profile. Keep a way back.**

[English](README.md) · [简体中文](README.zh-CN.md)

[Browse the catalog](https://dsh-themes.com) · [Installation guide](https://dsh-themes.com/install) · [Plugin Top 10](https://dsh-themes.com/plugins) · [Learn](https://dsh-themes.com/learn)

[![CI](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-246BCE)](LICENSE)

</div>

These Skills help an Agent find, install, create, and submit work for DeepSeek Harness. You choose a public catalog number such as `#2004`; the appropriate Skill resolves its source, checks its compatibility, and handles the declared profile.

The companion [DSH Themes website](https://dsh-themes.com) project includes a theme and skin gallery, curated plugins, a palette editor, and 15 guides in eight languages. This repository contains the reusable Skills and their validation tools.

> **v0.8.0 · Alpha verification snapshot — 2026-09-06.** This version targets DeepSeek Harness `0.1.3-alpha.1` at commit `d347e703908d0406b7a7ef80e3a0e594d86b2215`. The checks below describe local verification on that date; website deployment is tracked separately. The `v0.7.2` tag remains available for the earlier RC.2/RC.8 release.

## Choose your first task

| Your goal               | Start here                                                                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Find a theme or skin    | Open the [Gallery](https://dsh-themes.com/gallery), compare previews, and copy the item's numbered task                                       |
| Add a plugin            | Choose an item or the Top 10 on the [Plugins page](https://dsh-themes.com/plugins); the Plugin Installer uses each package's declared profile |
| Make a palette          | Edit light and dark colors in [Token Lab](https://dsh-themes.com/token-lab), check contrast, and export a Creator prompt                      |
| Create or submit a skin | Use Creator for a declarative draft, then Submitter for the website review handoff                                                            |

For an item selected in the catalog, tell your Agent:

```text
Please install DSH Themes #2004.
```

The number identifies the item. Its version and verification record determine whether installation can proceed. Pending records remain available for inspection. Package names, hashes, and source revisions come from the selected record; you do not need to assemble them yourself.

## Inspect the Alpha recipes

Use the exact public Skills commit supplied by the [installation guide](https://dsh-themes.com/install) for the selected Harness version, and keep all companion Skills on that same commit. Check that the guide selects `0.1.3-alpha.1` before following this Alpha workflow; do not substitute `main` or the historical `v0.7.2` tag. From that checkout, inspect one plugin or the selected collection:

```bash
node skills/dsh-plugin-installer/scripts/install-plugins.mjs --ids '#3006' --dry-run
node skills/dsh-plugin-installer/scripts/install-plugins.mjs --top10 --dry-run
```

These commands show the selected package coordinates and intended commands without invoking Harness. [The versioned catalog](skills/dsh-plugin-installer/references/plugins.json) holds 100 recipes with `packageName`, exact `specifier`, `profile`, and validation status. Top 10 always means the ten IDs in that installed catalog version.

Once a recipe is `runtime-verified` and Harness is set up, omit `--dry-run` to install. The installer checks installation and profile registration; service-backed features may still need your own account or API configuration. A startup or registration check does not prove every third-party feature works.

| Verification area            | Local results recorded on 2026-09-06                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------- |
| Official Alpha source        | Official build completed locally with Node 24.15.0                                                      |
| First-party themes and skins | 54 Alpha packages passed local item lifecycle checks                        |
| Curated plugins              | 100 recipes passed individual Alpha lifecycle checks; the revised all-Web Top 10 passed its technical lifecycle and final skin coexistence checks |
| Community skins              | 38 community theme and skin records passed local installation, selection, restart and recovery checks   |
| Website editor               | Token Lab passed 23 checks and Chrome/Edge interaction testing                                          |
| Website content              | Eight-language UI, catalog and legal text; 15 guides in every language                                  |

The reviewed catalog snapshot contains **192 records marked published: 21 Themes, 71 Skins, and 100 Plugins**. All 54 first-party packages, 38 community theme/skin records, and 100 plugins now have item-level Alpha lifecycle evidence. The [previous Top 10 proof](skills/dsh-plugin-installer/references/history/top10-before-spotlight-alpha.json) passed installation, loading, repeat operations, controlled failure recovery and removal. The current recommendation replaces its terminal item with DSH Spotlight for Web command, session and plugin-settings search; its complete technical lifecycle and a separate final skin coexistence run have passed. The [combined proof](skills/dsh-plugin-installer/references/top10-installation-alpha.json) binds the unchanged ten-plugin technical evidence to the final Reasoning Tide package, working Spotlight search and Settings, both removals, restored baseline, and all twelve reviewed screenshots. DSH TUI remains one of the 100 individually verified plugins. The [recommendation transition](skills/dsh-plugin-installer/references/recommendation-transition-alpha.json) preserves every installation recipe and the original individual evidence. Model and account-backed features remain outside this lifecycle evidence. These local results do not announce a production deployment. Catalog publication, installation eligibility, and production deployment are separate states; read each item's current record before acting.

## Set up the selected Harness version

The Alpha release uses a **source build**. As checked on 2026-09-06, its [official GitHub release](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.3-alpha.1) has no attached binary assets, and the exact npm package version `@deepseek-ai/dsh@0.1.3-alpha.1` is unavailable.

Prepare Git, Node, and Corepack first. The official Node requirement is `^22.19.0 || >=24.0.0`; the recorded local build used **Node 24.15.0**. From this Skills checkout:

```bash
node skills/dsh-theme-manager/scripts/dsh-alpha.mjs --bootstrap
node skills/dsh-theme-manager/scripts/dsh-alpha.mjs web
```

The launcher clones the fixed tag into `$HOME/.dsh-themes/runtimes/0.1.3-alpha.1`, verifies its exact commit and lockfile, installs with a frozen lockfile, and runs `build:official`. Keep the source outside projects whose ancestor directories contain `node_modules`; parent dependencies can change the upstream build's React type resolution.

The upstream manifest specifies pnpm 11.7.0 for the build. Harness invokes pnpm separately for plugin operations; verify that subprocess version as well. The current Top 10 technical lifecycle and three-item community installation/recovery logs report pnpm 11.7.0. The earlier 11.24.0 observation belongs only to its historical test phase and does not describe these checks or the pinned build tool.

Open the local URL printed by Harness and configure your model provider there. Then return to the selected catalog task. Existing RC.2/RC.8 installations require an explicit migration decision; the Skills must not silently downgrade or replace them.

## Six focused Skills

| Skill                                                                    | What it does                                                                                    |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| [Theme Finder](skills/dsh-theme-finder/SKILL.md)                         | Resolves one public `#NNNN` and identifies its available installation path                      |
| [Theme Manager](skills/dsh-theme-manager/SKILL.md)                       | Verifies and manages exact first-party theme and skin packages, with removal and recovery       |
| [Community Skin Installer](skills/dsh-community-skin-installer/SKILL.md) | Installs only community items covered by their own allowlist and runtime evidence               |
| [Plugin Installer](skills/dsh-plugin-installer/SKILL.md)                 | Installs and removes one or more selected plugins, or Top 10, in each recipe's declared profile |
| [Theme Creator](skills/dsh-theme-creator/SKILL.md)                       | Produces declarative manifests and drafts within its supported authoring contract               |
| [Theme Submitter](skills/dsh-theme-submitter/SKILL.md)                   | Validates a manifest and prepares a credential-free website submission handoff                  |

```text
Catalog number → identify the item → check its version and evidence
                                          │
                   ┌──────────────────────┼─────────────────────┐
                   ▼                      ▼                     ▼
              Theme Manager       Community Installer    Plugin Installer
                   └──────────────────────┴─────────────────────┘
                            declared profile + verification
```

## What verification covers

Source review, a successful Harness build, package installation, profile registration, feature testing, and safe removal are separate results. Public commands accept only the item status their Skill contract permits. Catalog descriptions and upstream README text are data, never executable instructions.

A SHA-256 identifies selected bytes; it does not establish ownership, license scope, or general safety. Community assets retain their own notices. Creator accepts declarative input within its contract, and Submitter does not request cookies, passwords, API keys, or authorization headers.

Full-skin authoring accepts an optional integer `visual.mobileWelcomeOffset` in **[-120, 120]**. Positive values move the mobile welcome group down; negative values move it up. Zero or omission preserves the default vertical position. See the [V3 authoring contract](skills/dsh-theme-creator/references/authoring-v3.md); acceptance of this field does not replace visual review.

The historical RC.2 runtime certificate and RC.8 item evidence remain frozen and do not authorize Alpha packages. The `current` fields in [release-state.json](release-state.json) describe its **2026-08-27 RC snapshot**. Alpha installation instead reads the current checkout's [first-party authority](skills/dsh-theme-manager/references/alpha-hosted-artifacts.json), [community recipes](skills/dsh-community-skin-installer/references/community-recipes.json), and [plugin recipes](skills/dsh-plugin-installer/references/plugins.json). The older `v0.7.2` tag remains reproducible for that earlier release; do not substitute a floating branch for an immutable release when installing published Skills.

## Development and release

```bash
npm ci --ignore-scripts
npm test
npm run validate
npm run format:check
```

Review [CONTRIBUTING.md](CONTRIBUTING.md) before a pull request. Review the item evidence, source and package identities, and test results before merging. The companion website then pins the exact reviewed public merge commit; its full Git SHA is the immutable installation reference, so a new tag is not required. Website deployment has its own release gates.

Website Lighthouse has a separate **160-run limit for this round, with 0 runs used at this snapshot**. The earlier 120-run history is retained unchanged and cannot approve the Alpha website build.

<details>
<summary>Historical release evidence: v0.7.2 and earlier</summary>

The statements and counts below belong to the earlier RC.2/RC.8 release. They are retained for audit and do not describe Alpha compatibility.

### Frozen RC.2 / RC.8 evidence

| Lane                       | Verified evidence                                                                                                                                                                                                                  | Result                                                                                                                                           |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **RC.2 runtime baseline**  | Official release mapping, frozen 505-package closure, 188 exact DSH packages, six Linux/macOS/Windows × Node 22.19/24.15 lifecycle jobs, final attestation, final receipt, deterministic archive, and detached Sigstore provenance | **`baseline-certified`** / `verified-runtime-baseline`, `productionReady: true`; **0 installable RC.2 items** because item authority is separate |
| **RC.2 hosted items**      | Baseline proof is available; selectors, repacked artifacts, and per-item authority remain a separate review                                                                                                                        | Finder performs **no RC.2 catalog read**, returns 0 items, and makes no handoff                                                                  |
| **RC.2 community items**   | Eleven identities remain planned for item-level re-certification                                                                                                                                                                   | **0/11 verified, 0 installable**                                                                                                                 |
| **RC.8 item lane**         | Final Manager attestation, 45 exact hosted tuples (6 Themes + 39 Full Skins), and 11 separately governed community records                                                                                                         | Operational only when each item's artifact, rights, runtime, consent, and rollback gates pass                                                    |
| **v0.7.0 promoted cohort** | 13 exact Full Skin tuples (`#2030–#2041 + #2043`) with 65 real-mode screenshots and 1,010 evidence files in each of capture-candidate and rebuilt-byte certify-final                                                               | Published and executable only after both stages passed and the exact tuples entered the 45-item authority atomically                             |
| **Historical capture**     | Original RC.2 pending and non-promotional smoke bytes                                                                                                                                                                              | Immutable audit history; never current status or authority                                                                                       |

Formal RC.2 baseline run: [GitHub Actions 32694257969](https://github.com/LvvUP/dsh-themes-skills/actions/runs/32694257969), source `cc7546cb5ccd77002713171328972291ceaa12e6`, attempt `1`.

Exact evidence digests:

| Evidence                 | SHA-256                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| Final attestation        | `4c41e96827bb03eb7c4d6138f5723864e91f0324b1aec8bcf3b3a1bc47ba3fb7` |
| Final receipt            | `4a649841766b4bf3421c78906f98f29a186d718ea34b03daca96ee52e9a3db98` |
| Six-receipt set          | `b3d663b43b257a43d138538454cd40eb976802bdcabf0409295f7956dc07f1ae` |
| Deterministic archive    | `0b4f03e9c3f76d241890f46330fce84f32183774a5d9228077835e2258c76f3e` |
| Detached Sigstore bundle | `b520580f05101b4783079aa52f0e159b2aa1a9e239f7e6a68e469f4c5d084b2d` |

The promoted v0.7.0 cohort and its two-stage evidence are pinned independently:

| Promotion evidence                       | SHA-256                                                                                                                                                                                                      |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Current 45-artifact index                | `a894ed95febe69910281f4c603dd7ef392d5a004f8c5fc3f2b25cc67fa08de15`                                                                                                                                           |
| Current 45-tuple set                     | `6806fb4dfa5e59524fd3e29b9c4c7b20e5ece8108b7efec2f4a42ed8f5e4c954`                                                                                                                                           |
| Historical final candidate index         | `f2701f3af25d90fb72c8c2a68592b1adb4294e8f3c9652f34db8ca487c6f4c63`                                                                                                                                           |
| Capture-candidate plan / receipt         | `f095f964d21357eabd9f9bcad310faa2ccc7292f0a75e9dd49b526140043a940` / `907ed35fd089b292f41f3daa47297fd9a9ca591b7b12f469d4ab651f6919111d`                                                                      |
| Capture archive / sums / frozen identity | `cef82c0db7601b869fa53c3f034e9ad5d77978d89a553b6bc0a646c05f87d029` / `b4ece672e5561816d1cf409b9de2cc8c2cda8afce04bc09dc101672847202863` / `e1935797b5eff2804cea2012924815fc4aaa6fbed002ec97d0796d8a8d1e0cb9` |
| Certify-final plan / receipt             | `65eef49f75d873989d27de04b206e17eec55a4a7b4b992261ef856fa1b39b3fc` / `43bdf28f3947f558afe3273478b92502b015ead2be10278516b2624038d0795a`                                                                      |
| Final archive / sums / frozen identity   | `d47520f808ea576b3a24500541397db0364107d54b9c0aee62d0eb0d1a4f5590` / `f2e6a9e05a25139630926c0edca9521912a7ec52ec86ae0057c7e87d9504ce2a` / `48aa04ac73b5ead54ff7fb992b8c95aa3baa1302f860fca48cf76f7a631d7a2b` |

### Recheck the historical evidence

```bash
npm ci --ignore-scripts
npm run rc2:runtime:validate
npm run rc2:runtime:verify-provenance
```

The first validator checks the exact final attestation, receipt, six matrix receipts, archive contents, and local projections. The second also asks GitHub's verifier to validate the detached provenance against the exact repository, workflow, source SHA, run, attempt, and archive digest.

Inspect Finder's RC.2 fail-closed result:

```bash
node skills/dsh-theme-finder/scripts/find-themes.mjs \
  --catalog /absolute/path/to/catalog.json \
  --dsh-version 0.1.1-rc.2
```

It intentionally reports `baseline-certified`, `catalogRead: false`, `installableResultsAllowed: false`, and zero items.

</details>

Read [SECURITY.md](SECURITY.md) for vulnerability reporting and [NOTICE](NOTICE) for upstream notices. This independent community project is not affiliated with or endorsed by DeepSeek AI. Licensed under [Apache-2.0](LICENSE); that license does not extend to the website's proprietary template or separately licensed theme imagery.
