---
name: dsh-theme-manager
description: Safely install, switch, remove, verify, or roll back verified DSH-Themes packages in the DeepSeek Harness web profile. Use for exact .tgz theme installation, active-theme inspection, Full Skin V3 compatibility checks, conflict detection, built-in palette restoration, or rollback after a failed or unwanted theme change.
---

# DSH Theme Manager

Manage at most one verified `@dsh-themes/*` Cordis plugin in the `web` profile. Theme changes require a DeepSeek Harness restart.

Baseline selection is policy-driven. Read `references/baseline-policy.json`; derive exact versions only from the pinned sidecars it names, and reject mutable dist-tags such as `latest` or `next`, ranges, and mixed evidence. DeepSeek Harness `0.1.1-rc.2` now has a separately verified **runtime baseline**: run `32694257969` completed all six Linux/macOS/Windows × Node 22.19/24.15 jobs and its detached Sigstore provenance validates. That baseline deliberately grants no theme, skin, or plugin item authority. The retained RC.8 lane remains the only operational item-install lane. Inspect RC.2 with `scripts/validate-promoted-rc2-runtime-baseline.mjs`; it must report `baseline-certified`, `productionReady: true`, `installableItems: false`, and `itemInstallability: "separate-authority-required"`. Historical pending inputs remain immutable evidence, never alternate authority.

## Harness presence and Node gate

Installing DeepSeek Harness and installing a selected theme are separate tasks. This Skill never installs DSH, Node.js, Homebrew, `apt` packages, or another system dependency.

Before resolving an installation mutation:

1. Require Node `22.19.0` or newer within Node 22, or `24.15.0` or newer within Node 24. If Node is missing or unsupported, stop in plain language. Point to the README setup section; do not run a system-level installer without a separate user request and immediate explicit consent.
2. Confirm that official DSH has already completed its own first start and that the selected profile exists. If not, stop and point to the separate fixed RC.2 command in the README. Do not run that command from Manager and do not combine DSH setup with a card-number installation.
3. Inspect the existing exact DSH version through the attested runner. Never reinstall, downgrade, or replace an existing DSH to make a theme pass. The installed version must match the certified lane selected by `baseline-policy.json`.

Official `0.1.1-rc.2` may be installed and started independently and its runtime baseline is certified. If that version is detected today, explain that RC.2 item installation still lacks separate item authority and stop before profile mutation; never treat baseline certification as package authorization, and never substitute retained RC.8 behind the user's back.

## Beginner-facing input

The normal hosted entry point is one normalized `dsh-theme-finder` result resolved from the exact public `#ID` shown in the top-left of the card and detail page, such as `#2004`. That ID must use the four-digit form `#NNNN`; require `selection.input` to match `^#([1-9]\d{3})$`, `selection.authority: "unique-catalog-id"`, `managerHandoff.status: "validated"`, and one matching `catalogId` through the selected item and handoff. `DSH-2206`, `DSH-FS-009`, package names, and other legacy or internal labels are never public-ID aliases. A slug, displayed name, or DSH-Themes detail URL can help discover the public ID but is never hosted installation authority. Do not ask the user to discover or type the package name, version, artifact URL, `.tgz` path, or SHA-256.

Resolve those fields internally and keep their trust sources separate:

1. Take the minimal technical release record, trusted origin, public catalog ID, slug, kind, and distribution only from Finder's validated handoff, never from descriptive catalog prose. Reject the handoff if the ID selects one item while any slug, package, version, route, or digest identifies another.
2. Re-run `validate-release.mjs` against the fixed sidecar selected by `baseline-policy.json`; never trust Finder's success flag by itself.
3. Derive `@dsh-themes/<slug>`, the exact version, controlled download route, and complete artifact SHA-256 from that validated record. These values are internal validation coordinates, not additional user identifiers.
4. Independently match the package/version/digest tuple against `CURRENT_INSTALLABLE_HOSTED_ARTIFACTS` before downloading, then re-hash the downloaded bytes.
5. Present a short target, permissions, compatibility, restart, and rollback summary. Ask for explicit confirmation only immediately before profile mutation.

If the selection is ambiguous, return to Finder and ask one short choice. If any authority field is absent or disagrees, stop and say the selected item is not currently installable; do not transfer evidence collection to the user. Only when the user explicitly chooses offline advanced/manual mode may you ask for an absolute local release-record and `.tgz` path. Compute the file digest locally and still require the pinned release record and local authority to agree.

## Release boundary

The certified RC.2 runtime baseline is evidence about the fixed Harness closure, lifecycle protocol, six-job matrix, final attestation, archive, and detached provenance only. It is not a selector, hosted-artifact map, community allowlist, authoring sidecar, or submission sidecar. `scripts/verify-promoted-rc2-provenance.mjs` verifies the checked-in archive cryptographically; success must never enable an item mutation.

The current item release is DeepSeek Harness `0.1.0-rc.8` on npm `next`, mapped by official tag `dsh-v0.1.0-rc.8` to source commit `141eb6fef83422698aef7a981029e843e8161534`. Installation authority is the publisher-side V3 sidecar, frozen `runtime-rc8` closure, successful six-job matrix run `32393288849` at head `e3fe9ac465b8db8070efbdb83ddc6c821f923a73`, and reviewed package-version-complete-digest map. `CURRENT_INSTALLABLE_HOSTED_ARTIFACTS` is generated from index SHA-256 `a894ed95febe69910281f4c603dd7ef392d5a004f8c5fc3f2b25cc67fa08de15` and binds 45 executable V3 artifacts: six Themes and 39 Full Skins; its declared-order tuple set hashes to `6806fb4dfa5e59524fd3e29b9c4c7b20e5ece8108b7efec2f4a42ed8f5e4c954`. Its numeric `catalogId` is the same public `#ID` used by the site and Finder; historical `DSH-FS-*` receipt labels are never installation selectors. A separate map retains 24 exact predecessors only for a verified schema-2 rollback or reverse and never for fresh install. The promoted v0.7.0 cohort is the exact non-contiguous set `#2030–#2041 + #2043`; `#2042` is already issued and excluded. These 13 exact package tuples passed real capture-candidate and exact rebuilt-byte certify-final before atomic promotion. Capture receipt SHA-256 is `907ed35fd089b292f41f3daa47297fd9a9ca591b7b12f469d4ab651f6919111d`; final receipt SHA-256 is `43bdf28f3947f558afe3273478b92502b015ead2be10278516b2624038d0795a`. `PENDING_CANDIDATE_HOSTED_ARTIFACTS` is empty; the historical final candidate index `f2701f3af25d90fb72c8c2a68592b1adb4294e8f3c9652f34db8ca487c6f4c63` remains only to verify the completed promotion chain. Existing 20/20, focused 4/4, and Fire Horse 1/1 receipts remain historical evidence for the exact bytes they name and do not widen runtime proof. Exact boundaries and hashes are in [`references/compatibility.md`](references/compatibility.md); do not infer authority or runtime proof from a private publisher source path.

## Safety boundaries

- Execute every DSH operation through `scripts/run-dsh.mjs`. It verifies the bundled runner attestation, keeps the user's workspace as `cwd`, disables telemetry, and places the attested `pnpm@11.7.0` shim first on `PATH`. A normal plugin add accepts only one of the 45 current hosted artifact digests or the adjacent installer's exact Skin Center digest; no pending candidate digest is executable. A rollback add may expose one of the 24 retired digests only when a verified schema-2 record selects it and an exact retained release record independently matches its package, version, complete digest, and payload digest. Every accepted add is streamed into a private no-overwrite snapshot, and only the durable workspace path `.dsh-themes/verified-artifacts/<sha256>.tgz` reaches DSH. This file remains available to pnpm's `file:` locator and rollback records; do not delete it while the package or a rollback record refers to it. Never resolve or invoke a PATH `dsh`.
- Mutate the profile only through the launcher's `dsh plugin --profile web` command. Never edit `$DSH_HOME`, `~/.dsh`, a profile package file, lockfile, Harness `dist`, or `index.html`.
- Accept a current installation only when its exact package and version, controlled download URL or explicit absolute local path, complete-artifact SHA-256, V3 manifest, and runtime attestation match one entry in `CURRENT_INSTALLABLE_HOSTED_ARTIFACTS` and the certified `0.1.0-rc.8` baseline. Live catalog discovery cannot extend that local authority.
- Never execute a downloaded package, lifecycle script, author JavaScript, CSS, or HTML while verifying it.
- Keep digest scopes separate. A complete `.tgz` `artifact` digest authorizes installation. V3/V2 `payload` digests cover the canonical tar excluding the manifest; V1 `package` covers its canonical payload. None of those payload digests authorizes a downloaded `.tgz`.
- Recognize exact RC.6/V2 and RC.5/V1 records as historical under normal validation. Never execute an arbitrary historical record. The only exception is a tuple already present in the 24-entry rollback-only map, selected as `previous` by an exact executable schema-2 record and independently matched by its retained release record. Six V1, thirteen V2, and five V3 packages meet that narrow byte-level boundary.
- Stop when more than one direct `@dsh-themes/*` dependency exists, a version is a range, current compatibility differs, or an exact rollback artifact cannot be prepared.
- Explain that a hash proves agreement with the selected catalog record, not publisher identity.

Read [references/compatibility.md](references/compatibility.md) before changing a profile.

## Inspect

1. Bootstrap and verify the bundled runner exactly as documented in `references/compatibility.md`; stop on any digest, lock, package, or pnpm mismatch.
2. Run `node <skill-dir>/scripts/run-dsh.mjs --version`; the current lane requires `0.1.0-rc.8`.
3. Run `node <skill-dir>/scripts/run-dsh.mjs --profile web --dump-config`; do not echo unrelated configuration.
4. Save `node <skill-dir>/scripts/run-dsh.mjs plugin --profile web list --json` to a permission-restricted temporary file.
5. Detect conflicts:

   ```bash
   node <skill-dir>/scripts/theme-state.mjs inspect --input <plugin-list.json>
   ```

The script accepts the RC.8 root array only when it contains exactly one unambiguous
`dsh-profile-web` record, then inspects that record's direct dependencies. It fails on
duplicate or multiple profile records, multiple theme packages, or non-exact SemVer 2.0
versions. Delete the temporary list after use.

## Validate the release record

The Skill—not the user—builds a permission-restricted temporary JSON file from the resolved, validated release record. It contains the raw manifest and catalog authority fields:

```json
{
  "artifactUrl": "https://trusted.example/api/themes/example/download/1.1.0",
  "artifactSha256": "64 lowercase hex characters",
  "verified": true,
  "distribution": {
    "kind": "hosted-verified-artifact",
    "installability": "manager",
    "redistribution": "allowed",
    "previewPolicy": "hosted"
  },
  "runtimeAttestation": {
    "schemaVersion": 2,
    "attestationSha256": "certified value from compatibility.md",
    "runnerLockfileSha256": "certified value from compatibility.md",
    "productionPackagesCount": 504,
    "productionPackagesSha256": "certified value from compatibility.md",
    "dshPackagesCount": 187,
    "dshPackagesSha256": "certified value from compatibility.md",
    "packageManagerName": "pnpm",
    "packageManagerVersion": "11.7.0",
    "dshPackageVersion": "0.1.0-rc.8",
    "certificationRunId": 32393288849,
    "certificationHeadSha": "e3fe9ac465b8db8070efbdb83ddc6c821f923a73",
    "lifecycle": "managed-cold-restart"
  },
  "manifest": {}
}
```

Validate before downloading:

```bash
node <skill-dir>/scripts/validate-release.mjs \
  --input <release-record.json> \
  --origin <trusted-https-origin>
```

For a current V3 release, require `status: "current"`, `installableCurrent: true`, `artifactAuthority: "current-installable"`, `verified: true`, the four exact hosted-distribution fields, exact official-release and npm provenance records, every Web/token/selector fingerprint, the final independent runtime attestation, and `artifactSha256` equal to the sidecar's complete `.tgz` `artifact.sha256`. The exact package, version, and complete digest must also appear in the 45-entry current authority. The package-internal manifest may omit `artifact` and is informative only. The URL must be the same trusted origin and exactly `/api/themes/<slug>/download/<version>` with no credentials, query, or fragment. Future pending candidates, external/community lanes, incomplete records, and all 24 rollback-only artifacts are never normal Manager-installable targets.

Keep the official tag/source mapping separate from npm evidence: the RC.8 registry records expose fixed integrity, shasum, and tarball SHA-256 but claim only `registry-digest-only` provenance.

The validator returns `historical-v2` for exact RC.6 and `historical-v1` for exact RC.5, always with `installableCurrent: false`. Their payload digests never replace the catalog's complete-artifact digest.

Do not pass `--authority legacy-rollback` during discovery, fresh installation, normal switching, or catalog validation. It is valid only after `theme-state.mjs validate-record` accepts a schema-2 record whose `previous` entry is one exact retained artifact. In that path, validate the retained V1, V2, or V3 release record with both authorities:

```bash
node <skill-dir>/scripts/validate-release.mjs \
  --input <retained-old-release-record.json> \
  --origin <trusted-https-origin> \
  --authority legacy-rollback \
  --rollback-record <absolute-schema-2-record.json>
```

Require `status: "legacy-rollback"`, `installableCurrent: false`, `rollbackEligible: true`, and `artifactAuthority: "legacy-rollback"`. `historicalStatus` preserves `historical-v1`, `historical-v2`, or `current` for the retained record's original schema. The release record, rollback entry, local bytes, package, version, complete digest, and payload digest must all agree. A wrong digest or a record that selects another package fails closed.

Schema `3.0` is the only current RC.8 Manager contract. Never downgrade it to V2, fill missing values from RC.6, or mix candidate/final attestation hashes.

Delete the temporary release record after use.

## Verify artifacts

Prepare both the current-installable target artifact and, when changing an installed theme, the exact previous artifact. A retained predecessor must already have its exact old release record and must be preserved solely for rollback:

```bash
node <skill-dir>/scripts/fetch-and-verify.mjs \
  --source <controlled-https-url-or-absolute-local-path> \
  --sha256 <catalog-artifact-sha256> \
  --output <new-absolute-path.tgz> \
  [--origin <trusted-https-origin>]
```

`--origin` is required for a remote source. The URL must use the controlled download route. The verifier accepts at most one same-origin, same-path HTTP 307 that carries the cookie bootstrap, then refuses every further 3xx; it refuses HTTP, oversized responses, hash mismatches, relative local paths, and overwrites. Keep verified files in a workspace-local `.dsh-themes/artifacts/` directory. Do not delete an artifact referenced by the current rollback record.

## Install or switch

1. Summarize current, target, compatibility, and prepared rollback package. Obtain confirmation before mutation.
2. Generate a rollback record without profile contents or credentials:

   ```bash
   node <skill-dir>/scripts/theme-state.mjs record \
     --target-name @dsh-themes/<slug> --target-version <exact> \
     --target-artifact <absolute-target.tgz> --target-sha256 <artifact-sha256> \
     [--previous-name ... --previous-version ... --previous-artifact ... --previous-sha256 ...]
   ```

3. Save the JSON output atomically as `.dsh-themes/rollback.json`; archive an existing record without overwriting it.
4. Remove the current theme, if any: `node <skill-dir>/scripts/run-dsh.mjs plugin --profile web remove "<current-package>"`.
5. Add the verified target: `node <skill-dir>/scripts/run-dsh.mjs plugin --profile web add "<absolute-target.tgz>" --save-exact`.
6. Re-run dump-config and list. Confirm one exact target and no prior theme.
7. Prompt the user to restart Harness. Launch acceptance with `node <skill-dir>/scripts/run-dsh.mjs web [--port <port>]`; the launcher forces `127.0.0.1`, exactly one `--no-open`, disables telemetry, and rejects caller-supplied open/host flags, `--patch`, `--trusted-host`, LAN, and wildcard binds.
8. Before opening a browser, run `node <skill-dir>/scripts/assert-loopback.mjs --url <actual-url>`. Only after that passes may you verify the browser roster and light/dark/system values. `--trusted-host` is a browser-trust fence, not authentication, and is never an exception to this gate.

If any post-removal step fails, remove a partial target, reinstall the prepared previous artifact when present, and verify again. If the previous state was built-in, leave no DSH-Themes package installed.

## Remove or roll back

To return to the built-in palette, inspect, remove the one active theme, verify no DSH-Themes dependency remains, and request a restart.

For rollback:

1. Validate the schema-2 record: `node <skill-dir>/scripts/theme-state.mjs validate-record --input .dsh-themes/rollback.json`. This re-hashes every referenced `.tgz`, requires an exact supported embedded manifest (current RC.8/V3 for a normal target; retained RC.5/V1, RC.6/V2, or RC.8/V3 for a rollback-only entry), re-checks the final Manager attestation, and derives `direction` from the exact current/retired authority of both entries. Rollback-record schema 1 is inspect-only and cannot execute.
2. Re-run `validate-release.mjs` against the retained release record for every package that will be installed; never infer authority from rollback JSON alone. Use normal current validation for a current artifact. Use the `--authority legacy-rollback --rollback-record <absolute-record>` form above only when the record's `previous` entry is an exact retired artifact.
3. Inspect current state and ensure it matches the record's target, where `null` means the built-in palette.
4. Re-verify the previous artifact, if present.
5. Remove the target and install the selected previous artifact through the record-bound launcher form, or install nothing for the built-in palette:

   ```bash
   node <skill-dir>/scripts/run-dsh.mjs \
     plugin --profile web add "<absolute-previous.tgz>" --save-exact \
     --rollback-record "<absolute-schema-2-record.json>" \
     --release-record "<absolute-release-record.json>" \
     --origin "<trusted-https-origin>"
   ```

   The option order is part of the narrow command grammar. A retained digest presented to the normal six-argument add path is rejected, even if the bytes appear in `LEGACY_ROLLBACK_HOSTED_ARTIFACTS`.
6. Verify and restart Harness.
7. Generate a reverse record with `theme-state.mjs reverse --input ...`, archive the consumed record, and save the reverse record atomically. Reversing the rollback uses the same record-bound launcher form and the exact release record for the reverse record's `previous` (normally the current `1.2.0` artifact).

The launcher permits removal of `@dsh-themes/*` and, solely for the adjacent reviewed community installer, the exact package `@linxin666/dsh-client-ui-skin-center`. No other third-party package name is accepted.

Quote every path. The cross-platform launcher resolves the attested Node entry and pnpm shim; do not substitute `dsh`, `dsh.cmd`, `pnpm dlx`, or `npx`. Never use an unresolved environment variable, home directory, or workspace root as an artifact target.
