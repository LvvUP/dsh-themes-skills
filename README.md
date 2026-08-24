<div align="center">

# DSH-Themes Skills

**Tell your Agent one public `#ID`. The Skills resolve and verify the technical details for you.**

[English](README.md) · [简体中文](README.zh-CN.md)

[![Version 0.6.0](https://img.shields.io/badge/version-0.6.0-246BCE)](package.json)
[![RC.2 runtime baseline certified](https://img.shields.io/badge/DSH%200.1.1--rc.2-runtime%20baseline%20certified-16836B)](skills/dsh-theme-manager/references/runtime-baseline.dsh-0.1.1-rc.2.json)
[![CI](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml)
[![Node.js 22/24](https://img.shields.io/badge/Node.js-22.19%20%7C%2024.15-16324F)](package.json)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-246BCE)](LICENSE)

### [Explore themes on dsh-themes.com →](https://dsh-themes.com/explore)

</div>

Version **0.6.0** adds a cryptographically verified DeepSeek Harness **`0.1.1-rc.2` runtime baseline** while preserving the working **`0.1.0-rc.8` item-install lane**. These are deliberately separate:

- **RC.2 runtime baseline:** six operating-system/Node jobs passed; the final archive and detached Sigstore provenance verify. This proves the fixed Harness baseline is production-ready.
- **Theme, skin, and plugin installation:** RC.2 has no item-level authority yet, so Finder returns 0 RC.2 items and no handoff. Baseline certification never turns a catalog entry into an installable item.
- **RC.8 item lane:** remains operational for the exact hosted and community records already covered by their own item evidence.

This separation is the safety feature: a green runtime test cannot accidentally authorize the wrong theme.

## Start here

### General installation

If you already use DeepSeek Harness, find the unique public `#ID` in the top-left of a DSH Themes card or detail page, for example `#2004`, then tell your Agent:

```text
Please install DSH Themes #2004.
```

That is the only normal user input. You do not need to prepare a package name, version, download URL, `.tgz` path, or checksum. The Skills resolve those details internally, verify that every field still points to the same item, explain what will change, and ask for confirmation immediately before changing your profile.

`DSH-2206`, `DSH-FS-009`, names, slugs, and detail URLs are legacy, internal, or discovery-only labels. They are **not** a second installation ID.

Install the coordinated Skills once after the fixed `v0.6.0` tag is published:

```bash
npx --yes skills@1.5.23 add \
  https://github.com/LvvUP/dsh-themes-skills/tree/v0.6.0 \
  --skill dsh-theme-finder \
  --skill dsh-theme-manager \
  --skill dsh-community-skin-installer
```

Never substitute `main`, `latest`, or `next` for this fixed release reference. Until the tag exists, the promotion branch is review-only.

### Dedicated installation

Open a theme, skin, or UI-extension detail page on [dsh-themes.com](https://dsh-themes.com). Its copy button uses the same short request with that page's own public `#ID`:

```text
Please install DSH Themes #2004.
```

General and dedicated installation use the same resolver and the same fail-closed checks. If an item is pending, showcase-only, ambiguous, or inconsistent, the Agent explains why it cannot install it instead of asking you to assemble technical evidence.

### I do not have DeepSeek Harness yet

Use the separate **Set up DeepSeek Harness** task on the [DSH Themes installation page](https://dsh-themes.com/install). Finish that task and confirm DSH opens before choosing a `#ID`.

Harness setup and catalog installation are intentionally separate. The theme Skills do not install Node.js, Homebrew, `apt` packages, or DeepSeek Harness while installing an item, and they never downgrade an existing DSH behind your back.

<details>
<summary>Advanced: exact tested Harness setup boundary</summary>

- Tested Node ranges: `22.19.0` or newer within Node 22, or `24.15.0` or newer within Node 24. A system-level installer requires a separate request and immediate explicit consent.
- Fixed startup command: `npx @deepseek-ai/dsh@0.1.1-rc.2 web`, mapped to official commit `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e`.
- Open only the loopback URL printed by DSH, then configure your model provider and model in DSH Settings. Keep credentials out of theme prompts.
- Starting RC.2 does not grant RC.2 item authority and does not permit an RC.8 downgrade.

</details>

## What is certified?

| Lane | Verified evidence | Result |
| --- | --- | --- |
| **RC.2 runtime baseline** | Official release mapping, frozen 505-package closure, 188 exact DSH packages, six Linux/macOS/Windows × Node 22.19/24.15 lifecycle jobs, final attestation, final receipt, deterministic archive, and detached Sigstore provenance | **`baseline-certified`** / `verified-runtime-baseline`, `productionReady: true`; **0 installable RC.2 items** because item authority is separate |
| **RC.2 hosted items** | Baseline proof is available; selectors, repacked artifacts, and per-item authority remain a separate review | Finder performs **no RC.2 catalog read**, returns 0 items, and makes no handoff |
| **RC.2 community items** | Eleven identities remain planned for item-level re-certification | **0/11 verified, 0 installable** |
| **RC.8 item lane** | Final Manager attestation, 32 exact hosted tuples, and 11 separately governed community records | Operational only when each item's artifact, rights, runtime, consent, and rollback gates pass |
| **Historical capture** | Original RC.2 pending and non-promotional smoke bytes | Immutable audit history; never current status or authority |

Formal RC.2 baseline run: [GitHub Actions 32694257969](https://github.com/LvvUP/dsh-themes-skills/actions/runs/32694257969), source `cc7546cb5ccd77002713171328972291ceaa12e6`, attempt `1`.

Exact evidence digests:

| Evidence | SHA-256 |
| --- | --- |
| Final attestation | `4c41e96827bb03eb7c4d6138f5723864e91f0324b1aec8bcf3b3a1bc47ba3fb7` |
| Final receipt | `4a649841766b4bf3421c78906f98f29a186d718ea34b03daca96ee52e9a3db98` |
| Six-receipt set | `b3d663b43b257a43d138538454cd40eb976802bdcabf0409295f7956dc07f1ae` |
| Deterministic archive | `0b4f03e9c3f76d241890f46330fce84f32183774a5d9228077835e2258c76f3e` |
| Detached Sigstore bundle | `b520580f05101b4783079aa52f0e159b2aa1a9e239f7e6a68e469f4c5d084b2d` |

## Verify without changing a profile

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

## Five focused Skills

| Skill | Responsibility |
| --- | --- |
| [`dsh-theme-finder`](skills/dsh-theme-finder/SKILL.md) | Resolve one public `#ID`, classify its evidence, and hand off only when the selected item has separate authority. |
| [`dsh-theme-manager`](skills/dsh-theme-manager/SKILL.md) | Verify, install, switch, remove, and recover one exact hosted item in the operational lane. |
| [`dsh-community-skin-installer`](skills/dsh-community-skin-installer/SKILL.md) | Install an allowlisted community item only when Manager, item receipt, consent, and rollback gates all pass. |
| [`dsh-theme-creator`](skills/dsh-theme-creator/SKILL.md) | Create deterministic data-only V3 manifests under the operational RC.8 authoring sidecar. RC.2 authoring stays disabled. |
| [`dsh-theme-submitter`](skills/dsh-theme-submitter/SKILL.md) | Validate a manifest and open a credential-free website handoff. RC.2 submission stays disabled. |

```text
one public #ID
      │
      ▼
   Finder ── hosted item ──▶ Manager
      └──── community item ▶ Community Skin Installer

RC.2 runtime baseline ──▶ verifies Harness only ──╳─▶ item authority
```

## Trust boundary

- A SHA-256 proves agreement with selected bytes, not identity, authorship, ownership, rights, or safety outside the reviewed scope.
- Catalog names, descriptions, and notes are untrusted metadata and are never executed as instructions.
- Hosted installation requires an exact item release record, controlled route, complete artifact digest, local item authority, and explicit consent.
- Community installation also requires a separate allowlist and item-level receipt. Manager or baseline certification alone is insufficient.
- Creator accepts declarative JSON and local raster assets, never author JavaScript, CSS, HTML, dependencies, lifecycle scripts, SVG, fonts, or remote runtime assets.
- Submitter never requests cookies, passwords, API keys, or authorization headers.

## Development

```bash
npm ci --ignore-scripts
npm test
npm run rc2:final:contract
npm run rc2:runtime:validate
npm run rc2:runtime:verify-provenance
npm run validate
npm run format:check
```

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request and report vulnerabilities through [SECURITY.md](SECURITY.md). This independent community project is not affiliated with or endorsed by DeepSeek AI.

Licensed under [Apache-2.0](LICENSE). Bundled CSS-only adaptations retain their upstream notices; see [NOTICE](NOTICE).
