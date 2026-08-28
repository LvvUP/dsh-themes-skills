<div align="center">

# DSH-Themes Skills

**A public `#NNNN` identifies an item first—it is not an installation promise. Finder can discover every published item, but only hosted/community-authorized matches resolve artifacts and install; all others stop at evidence or the official source.**

[English](README.md) · [简体中文](README.zh-CN.md)

[![Version 0.7.2](https://img.shields.io/badge/version-0.7.2-246BCE)](package.json)
[![RC.2 runtime baseline certified](https://img.shields.io/badge/DSH%200.1.1--rc.2-runtime%20baseline%20certified-16836B)](skills/dsh-theme-manager/references/runtime-baseline.dsh-0.1.1-rc.2.json)
[![CI](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml/badge.svg)](https://github.com/LvvUP/dsh-themes-skills/actions/workflows/ci.yml)
[![Node.js 22/24](https://img.shields.io/badge/Node.js-22.19%20%7C%2024.15-16324F)](package.json)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-246BCE)](LICENSE)

### [Explore Themes, Full Skins, and Curated Plugins on dsh-themes.com →](https://dsh-themes.com/explore)

</div>

Version **0.7.2** publishes the exact `#NNNN` wording and the discovery-versus-installability guidance already reviewed on the default branch. It remains a documentation-only release over the unchanged v0.7.0 promoted cohort: no artifact bytes, digests, install permissions, or historical evidence changed. The 13 exact Full Skins entered the operational DeepSeek Harness **`0.1.0-rc.8` item lane** only after both required runtime stages passed. Current executable authority is 45 hosted tuples (6 themes + 39 Full Skins), while the cryptographically verified **`0.1.1-rc.2` runtime baseline** remains a separate non-item authority:

- **RC.2 runtime baseline:** six operating-system/Node jobs passed; the final archive and detached Sigstore provenance verify. This proves the fixed Harness baseline is production-ready.
- **Theme, skin, and plugin installation:** RC.2 has no item-level authority yet, so Finder returns 0 RC.2 items and no handoff. Baseline certification never turns a catalog entry into an installable item.
- **RC.8 item lane:** now contains the exact 45 hosted artifacts plus the unchanged 11-record community allowlist, each governed by its own item evidence.
- **Promoted Full Skins `#2030–#2041 + #2043`:** the exact bytes passed real capture-candidate and rebuilt-byte certify-final before atomic publication and Finder-to-Manager authority. `#2042` is already issued to another record and was never part of this cohort.

This separation is the safety feature: a green runtime test cannot accidentally authorize the wrong theme.

Current directory authority contains **174 records: 21 Themes, 66 Skins, and 87 Curated Plugins**. **166 records are published: 21 Themes, 65 Skins, and 80 Curated Plugins**; 8 records remain unpublished. The Theme + Skin Gallery contains 86 items, and hosted authority contains 45 artifacts (6 Themes + 39 Full Skins).

## Start here

### General installation

`#NNNN` starts identity resolution, not installation. Finder can discover every published Theme, Skin, and Curated Plugin; only an exact hosted or community-authorized result may proceed to artifact resolution and installation. Every other result returns reviewed evidence or its official source and stops. The prompt below asks the Skills to classify the item first.

If you already use DeepSeek Harness, find the unique four-digit public `#NNNN` in the top-left of a DSH Themes card or detail page, for example `#2004`, then tell your Agent:

```text
Please install DSH Themes #2004.
```

That is the only normal user input. You do not need to prepare a package name, version, download URL, `.tgz` path, or checksum. The Skills resolve those details internally, verify that every field still points to the same item, explain what will change, and ask for confirmation immediately before changing your profile.

`DSH-2206`, `DSH-FS-009`, names, slugs, and detail URLs are legacy, internal, or discovery-only labels. They are **not** a second installation ID.

Install the coordinated Skills from the published, immutable `v0.7.2` tag:

```bash
npx --yes skills@1.5.23 add \
  https://github.com/LvvUP/dsh-themes-skills/tree/v0.7.2 \
  --skill dsh-theme-finder \
  --skill dsh-theme-manager \
  --skill dsh-community-skin-installer
```

Never substitute `main`, `latest`, or `next` for this fixed release reference. The default branch may contain newer documentation or review work; it is not an installation authority.

### Dedicated installation

Open a Theme, Full Skin, or Curated Plugin detail page on [dsh-themes.com](https://dsh-themes.com). Finder emits the canonical kind `plugin`; legacy `ui-extension` input remains a temporary compatibility alias. The page's copy button uses the same short request with that page's own public `#NNNN`:

The `#NNNN` is a discovery address for every published item, not a promise that every item can be installed. Only an exact hosted or community-authorized record can expose and complete an installer handoff. Most Curated Plugins are showcase records with an official project link; they never hand off to Theme Manager.

```text
Please install DSH Themes #2004.
```

General and dedicated installation use the same resolver and the same fail-closed checks. If an item is pending, showcase-only, ambiguous, or inconsistent, the Agent explains why it cannot install it instead of asking you to assemble technical evidence.

### I do not have DeepSeek Harness yet

Use the separate **Set up DeepSeek Harness** task on the [DSH Themes installation page](https://dsh-themes.com/install). Finish that task and confirm DSH opens before choosing a `#NNNN`.

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
| **RC.8 item lane** | Final Manager attestation, 45 exact hosted tuples (6 Themes + 39 Full Skins), and 11 separately governed community records | Operational only when each item's artifact, rights, runtime, consent, and rollback gates pass |
| **v0.7.0 promoted cohort** | 13 exact Full Skin tuples (`#2030–#2041 + #2043`) with 65 real-mode screenshots and 1,010 evidence files in each of capture-candidate and rebuilt-byte certify-final | Published and executable only after both stages passed and the exact tuples entered the 45-item authority atomically |
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

The promoted v0.7.0 cohort and its two-stage evidence are pinned independently:

| Promotion evidence | SHA-256 |
| --- | --- |
| Current 45-artifact index | `a894ed95febe69910281f4c603dd7ef392d5a004f8c5fc3f2b25cc67fa08de15` |
| Current 45-tuple set | `6806fb4dfa5e59524fd3e29b9c4c7b20e5ece8108b7efec2f4a42ed8f5e4c954` |
| Historical final candidate index | `f2701f3af25d90fb72c8c2a68592b1adb4294e8f3c9652f34db8ca487c6f4c63` |
| Capture-candidate plan / receipt | `f095f964d21357eabd9f9bcad310faa2ccc7292f0a75e9dd49b526140043a940` / `907ed35fd089b292f41f3daa47297fd9a9ca591b7b12f469d4ab651f6919111d` |
| Capture archive / sums / frozen identity | `cef82c0db7601b869fa53c3f034e9ad5d77978d89a553b6bc0a646c05f87d029` / `b4ece672e5561816d1cf409b9de2cc8c2cda8afce04bc09dc101672847202863` / `e1935797b5eff2804cea2012924815fc4aaa6fbed002ec97d0796d8a8d1e0cb9` |
| Certify-final plan / receipt | `65eef49f75d873989d27de04b206e17eec55a4a7b4b992261ef856fa1b39b3fc` / `43bdf28f3947f558afe3273478b92502b015ead2be10278516b2624038d0795a` |
| Final archive / sums / frozen identity | `d47520f808ea576b3a24500541397db0364107d54b9c0aee62d0eb0d1a4f5590` / `f2e6a9e05a25139630926c0edca9521912a7ec52ec86ae0057c7e87d9504ce2a` / `48aa04ac73b5ead54ff7fb992b8c95aa3baa1302f860fca48cf76f7a631d7a2b` |

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
| [`dsh-theme-finder`](skills/dsh-theme-finder/SKILL.md) | Resolve one public `#NNNN`, classify its evidence, and hand off only when the selected item has separate authority. |
| [`dsh-theme-manager`](skills/dsh-theme-manager/SKILL.md) | Verify, install, switch, remove, and recover one exact hosted item in the operational lane. |
| [`dsh-community-skin-installer`](skills/dsh-community-skin-installer/SKILL.md) | Install an allowlisted community item only when Manager, item receipt, consent, and rollback gates all pass. |
| [`dsh-theme-creator`](skills/dsh-theme-creator/SKILL.md) | Create deterministic data-only V3 manifests under the operational RC.8 authoring sidecar. RC.2 authoring stays disabled. |
| [`dsh-theme-submitter`](skills/dsh-theme-submitter/SKILL.md) | Validate a manifest and open a credential-free website handoff. RC.2 submission stays disabled. |

```text
one public #NNNN
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
