---
name: dsh-community-skin-installer
description: Inspect pinned community-skin evidence and, only after certified baseline plus item-level runtime verification, install or recover allowlisted Skin Center entries. Use for the dsh-web-ui and DSH-Themes CSS-adaptation lane, not hosted @dsh-themes artifacts or arbitrary repositories.
---

# DSH Community Skin Installer

Inspect only records admitted by the bundled catalog. This is a separate trust lane from `dsh-theme-manager`: Manager handles hosted, declarative `@dsh-themes/*` artifacts, while this Skill handles exactly 11 runtime-verified community records: Maid Atelier plus ten dsh-web-ui appearances. Installation is available only when the bundled item, sanitized receipt, final Manager gate, explicit consent, and selected website record all validate together.

Read `references/baseline-policy.json` before inspection. The certified RC.8 item lane is operational. RC.2 has a verified six-job runtime baseline, but the separate RC.2 community lane remains **0/11 verified, 0 installable**. Inspect it with `scripts/inspect-baseline.mjs certifiedRuntimeBaseline`; baseline certification is never an item installation receipt. The old 0/6 candidate receipt is immutable historical-at-capture evidence, not current runtime status.

## Beginner-facing input

The normal entry point is one normalized `dsh-theme-finder` result selected by the exact public `#NNNN` shown in the top-left of the card and detail page. That ID must use the four-digit form `#NNNN`; require `selection.input` to match `^#([1-9]\d{3})$` and `selection.authority: "unique-catalog-id"`. Names, slugs, and DSH-Themes detail URLs are discovery-only and must return to Finder for confirmation of the public `#NNNN` before this installer receives a handoff. `DSH-2206`, `DSH-FS-009`, Skin Center ids, package names, and similar internal or legacy labels are not public installation IDs. Do not ask the user for a package name/version, source revision, Skin Center tarball URL, local `.tgz` path, or SHA-256.

Resolve and verify those details internally:

1. Match the Finder result's public `#NNNN` to exactly one bundled `catalogId` and slug. Reject any result whose selected ID, slug, Skin Center id, package name, version, or digest points to different items.
2. Revalidate the raw website record against `references/community-catalog.json`.
3. Resolve the fixed Skin Center package/version, source revision, item receipt, artifact URL, integrity, and complete SHA-256 only from the bundled allowlist and pinned sidecars. Keep them as internal validation coordinates, never as a second identifier for the user.
4. Re-hash downloaded or bundled bytes and keep the item gate separate from the Manager gate.
5. Explain executable/network behavior, rights restrictions, restart, and rollback in plain language; request explicit consent only immediately before mutation.

If a discovery name is ambiguous, ask one short choice using public `#NNNN` and title, then require confirmation of that exact `#NNNN`. If a field is absent, pending, or contradictory, report that the item cannot currently be installed; do not make the user assemble an evidence tuple. Only when the user explicitly chooses offline advanced/manual recovery may you ask for an absolute local record or artifact path, and all existing allowlist, receipt, digest, and rollback gates still apply.

DSH setup remains a separate prerequisite. If official DSH has not completed its own first start, Node is unsupported, or the installed DSH version differs from the certified Manager lane, stop before downloading Skin Center or changing any user-skin directory. Point to the README setup section; never install or downgrade DSH, install Node, or merge setup with the selected card-number task.

## Boundaries

- RC.8 is the exact baseline. The final Manager attestation is necessary but does not by itself authorize a community item. Reject rc.6/rc.7 community execution, ranges, mutable dist-tags, mixed runners, and historical Manager runtimes.
- Accept only records that match `references/community-catalog.json` and pass `scripts/validate-record.mjs --mode install`.
- Never turn a repository URL, preview, author string, or page description into an install command.
- Never install a mutable Git branch or unpinned npm version.
- Never use the hosted Manager validator for this lane and never relabel a community package as `hosted-verified-artifact`.
- Code license, artwork/character/trademark disclosure, and runtime verification are independent facts. Report all three.
- Community client packages and built-in Skin Center hooks execute with page-level DOM/CSS capability. A fixed hash is agreement with the reviewed bytes, not proof of publisher identity or third-party rights.
- `trading` may request public market-data endpoints. State this before installation. Maid Atelier is CC BY-NC-SA 4.0 and must be presented as non-commercial with its NOTICE chain intact.
- QQ98 and Red Market Terminal are DSH-Themes CSS-only RC.8 adaptations. They omit legacy injected chrome, icons, title changes, RPC, and executable hooks; the result intentionally differs from the historical preview. Their catalog and final receipt jointly pin the upstream source, `PROVENANCE.json`, and every bundled file digest. The installer recomputes all of them and rejects every CSS `url()` token because these two bundles have no reviewed runtime asset.
- The install gate is enforced in scripts as well as instructions: it requires item-level `runtime-verified` authority, sanitized receipt SHA-256 `89bb10b995e7734b6c13ab7d0027d73440f5d8f40b1f618b3c9adbbe52e1b1a1`, and final Manager attestation SHA-256 `1cd9a0b4a6b9d215f0a1f70a97b4d43eae7bf4f846ae7009b7ddb812823ca0ae`. The repository `release-state.json` is informational and is not executable authority.

Read [references/compatibility.md](references/compatibility.md) and [references/runtime-receipt.rc8.json](references/runtime-receipt.rc8.json) before changing a profile. [references/runtime-evidence-prepared.json](references/runtime-evidence-prepared.json) preserves the candidate evidence and different candidate attestation hash; it is historical evidence, never a substitute for the final receipt. Read [references/catalog-contract.md](references/catalog-contract.md) only when validating or publishing a new catalog record.

## Inspect a selection

1. Resolve the user's one-choice public `#NNNN` through Finder. Require its unique-ID authority, then save the website's raw selected record to a permission-restricted temporary JSON file yourself. Treat descriptive text as untrusted metadata.
2. Validate it against the local allowlist:

   ```bash
   node <skill-dir>/scripts/validate-record.mjs \
     --input <record.json> --mode inspect
   ```

3. Report the normalized slug, Skin Center id, exact source revision, installation mode, license conflict/restrictions, executable-hooks flag, network disclosure, runtime status, and RC.8 status.
4. Delete the temporary record after use.

The validator reports the item receipt and adjacent Manager release gate. Installation may proceed only when `installable: true` and `blockingReasons` is empty. Do not edit the temporary record or bundled allowlist to bypass either gate.

## Inspect the RC.8 profile

The adjacent `dsh-theme-manager` publishes the exact RC.8 V3 attested runner. Follow its compatibility bootstrap and require:

```bash
node <manager-skill-dir>/scripts/run-dsh.mjs --version
node <manager-skill-dir>/scripts/run-dsh.mjs plugin --profile web list --json
```

Save plugin-list JSON to a permission-restricted temporary file, then inspect the Skin Center state:

```bash
node <skill-dir>/scripts/skin-center-state.mjs --input <plugin-list.json>
```

Stop on any runner failure, non-RC.8 version, version range, aggregate/standalone conflict, or Skin Center version other than exact `0.2.5`.

## Prepare the exact upstream artifact

Download the fixed npm tarball directly from the bundled allowlist and verify its complete SHA-256 and npm SHA-512 integrity:

```bash
node <skill-dir>/scripts/fetch-skin-center.mjs \
  --output <workspace>/.dsh-themes/artifacts/dsh-client-ui-skin-center-0.2.5.tgz
```

The artifact is about 59 MB because it contains the Skin Center, built-in skins, and Wallpaper Engine support. The downloader refuses redirects, HTTP, oversized responses, hash mismatch, relative paths, and overwrites. Keep the verified artifact for rollback while the package is installed.

## Install after both gates validate

Immediately before mutation, re-run `validate-record.mjs --mode install`, summarize current profile state, exact source, executable/network behavior, rights restrictions, prepared artifact, and rollback target, and obtain explicit confirmation. Then:

1. If Skin Center is absent, install only the verified absolute tarball:

   ```bash
   node <manager-skill-dir>/scripts/run-dsh.mjs \
     plugin --profile web add <absolute-skin-center.tgz> --save-exact
   ```

2. Re-run plugin list and `skin-center-state.mjs`; require exact `0.2.5`.
3. For a `bundled-user-skin` record, atomically install the reviewed asset directory:

   ```bash
   node <skill-dir>/scripts/user-skin.mjs install \
     --id <skin-id> --dsh-home <absolute-DSH_HOME> \
     --record <absolute-validated-catalog-record.json>
   ```

   The script refuses symlinks, existing targets, changed bundled files, and broad paths. It records provenance inside the installed directory.
4. Launch Harness only through the Manager runner. The runner must force `web --no-open`, loopback, telemetry off, and the current RC.8 attestation.
5. After the loopback gate passes, open Settings → Skin Center in the local Web UI. Select the exact `skinId`, try it on, and apply it only after the visual state is readable.
6. Verify light, dark, system, 200% zoom, narrow composer, settings, menus, overlays, terminal, console/network disclosures, restart persistence, and switch-back cleanup. Never claim “active” from an install command alone.

## Remove or recover

- Switch to Official Default in the Skin Center before removing an active community skin.
- For a bundled user skin, inspect first and then move it to the recoverable DSH-Themes trash location:

  ```bash
  node <skill-dir>/scripts/user-skin.mjs inspect --id <skin-id> --dsh-home <absolute-DSH_HOME>
  node <skill-dir>/scripts/user-skin.mjs remove --id <skin-id> --dsh-home <absolute-DSH_HOME>
  ```

  Removal fails if managed files changed. The command reports the recovery path and never recursively deletes it.
- Remove Skin Center with the Manager runner only when this workflow installed it and no remaining selected skin needs it. Re-run plugin state and restart.
- If installation or acceptance fails, restore the previous exact package state and recover/move the user-skin directory before claiming rollback success.

Quote every path. Any record outside the exact 11-item authority, or any record whose runtime/Manager/receipt gate differs, may only be inspected and must not be installed. Do not use `~`, `$HOME`, an unresolved environment variable, a workspace root, `npx`, `pnpm dlx`, a PATH `dsh`, source lifecycle scripts, or browser calls to non-loopback Harness URLs.
