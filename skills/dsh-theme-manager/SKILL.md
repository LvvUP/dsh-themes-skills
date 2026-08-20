---
name: dsh-theme-manager
description: Safely install, switch, remove, verify, or roll back verified DSH-Themes packages in the DeepSeek Harness web profile. Use for exact .tgz theme installation, active-theme inspection, Full Skin V2 compatibility checks, conflict detection, built-in palette restoration, or rollback after a failed or unwanted theme change.
---

# DSH Theme Manager

Manage at most one verified `@dsh-themes/*` Cordis plugin in the `web` profile. Theme changes require a DeepSeek Harness restart.

## Release boundary

The current upstream release is DeepSeek Harness `0.1.0-rc.8` on npm `next`, sourced by official tag `dsh-v0.1.0-rc.8` at `141eb6fef83422698aef7a981029e843e8161534`. This repository records exact candidate registry, Web asset-set, ui-theme bundle, and token evidence in [`references/rc8-v3-candidate.json`](references/rc8-v3-candidate.json), while selector and runtime-attestation authority remain `null`. Candidate evidence is not installation authority: the only current certified lane remains `0.1.0-rc.6`, while V1 rc.5 is historical. Stop on rc.7 or every RC.8 V3 record until a future release atomically closes the candidate blockers. See the informational [`release-state.json`](../../release-state.json) and the exact certified evidence below.

## Safety boundaries

- Execute every DSH operation through `scripts/run-dsh.mjs`. It verifies the bundled runner attestation, keeps the user's workspace as `cwd`, disables telemetry, and places the attested `pnpm@11.7.0` shim first on `PATH`. Never resolve or invoke a PATH `dsh`.
- Mutate the profile only through the launcher's `dsh plugin --profile web` command. Never edit `$DSH_HOME`, `~/.dsh`, a profile package file, lockfile, Harness `dist`, or `index.html`.
- Accept a current installation only when its exact version, controlled download URL or explicit absolute local path, complete-artifact SHA-256, and manifest match the certified `0.1.0-rc.6` baseline.
- Never execute a downloaded package, lifecycle script, author JavaScript, CSS, or HTML while verifying it.
- Keep digest scopes separate. A complete `.tgz` `artifact` digest authorizes installation. A V2 `payload` digest covers the canonical tar excluding the manifest. A V1 `package` digest covers the canonical payload excluding `theme.json`. Neither payload digest authorizes a downloaded `.tgz`.
- Recognize an exact rc.5/V1 release as historical, never as a current rc.6 package. Require its separately catalogued complete-artifact digest before any deliberate historical installation.
- Stop when more than one direct `@dsh-themes/*` dependency exists, a version is a range, current compatibility differs, or an exact rollback artifact cannot be prepared.
- Explain that a hash proves agreement with the selected catalog record, not publisher identity.

Read [references/compatibility.md](references/compatibility.md) before changing a profile.

## Inspect

1. Bootstrap and verify the bundled runner exactly as documented in `references/compatibility.md`; stop on any digest, lock, package, or pnpm mismatch.
2. Run `node <skill-dir>/scripts/run-dsh.mjs --version`; the current lane requires `0.1.0-rc.6`.
3. Run `node <skill-dir>/scripts/run-dsh.mjs --profile web --dump-config`; do not echo unrelated configuration.
4. Save `node <skill-dir>/scripts/run-dsh.mjs plugin --profile web list --json` to a permission-restricted temporary file.
5. Detect conflicts:

   ```bash
   node <skill-dir>/scripts/theme-state.mjs inspect --input <plugin-list.json>
   ```

The script accepts the rc.6 root array only when it contains exactly one unambiguous
`dsh-profile-web` record, then inspects that record's direct dependencies. It fails on
duplicate or multiple profile records, multiple theme packages, or non-exact SemVer 2.0
versions. Delete the temporary list after use.

## Validate the release record

Build a permission-restricted JSON file containing the raw manifest and catalog fields:

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
    "schemaVersion": 1,
    "attestationSha256": "certified value from compatibility.md",
    "runnerLockfileSha256": "certified value from compatibility.md",
    "criticalPackagesCount": 197,
    "criticalPackagesSha256": "certified value from compatibility.md",
    "packageManagerName": "pnpm",
    "packageManagerVersion": "11.7.0",
    "packageManagerIntegrity": "certified value from compatibility.md",
    "uiThemePackageVersion": "0.1.0-rc.6",
    "uiThemePackageIntegrity": "certified value from compatibility.md",
    "webFrontendPackageVersion": "0.1.0-rc.6",
    "webFrontendPackageIntegrity": "certified value from compatibility.md",
    "frontendBundleSha256": "certified value from compatibility.md",
    "frontendStylesheetSha256": "certified value from compatibility.md"
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

For a current V2 release, require `status: "current"`, `installableCurrent: true`, `verified: true`, the four exact hosted-distribution fields, the exact independent runtime attestation, and `artifactSha256` equal to the manifest's complete `.tgz` `artifact.sha256`. The release sidecar must contain both `artifact` and `payload`; the package-internal manifest may omit `artifact` and is informative only. The URL must be the same trusted origin and exactly `/api/themes/<slug>/download/<version>` with no credentials, query, or fragment. External showcases and incomplete records are never Manager-installable.

The `sourceCommit` key must be absent from rc.6 package compatibility. Reject the key even when its value is `null`: npm did not expose a trustworthy source commit. Do not reuse the historical rc.5 source commit.

The validator returns `status: "historical-v1"` and `installableCurrent: false` for the exact rc.5/V1 contract. This preserves historical recognition without treating it as rc.6. Its `package.sha256` is a payload digest; the catalog `artifactSha256` remains the only complete `.tgz` digest.

Schema `3.0` is reserved for RC.8. `validate-release.mjs` rejects every V3 release record with a pending-evidence error. To audit the checked-in non-installable candidate only, run:

```bash
node <skill-dir>/scripts/validate-rc8-candidate.mjs \
  --input <absolute-copy-of-rc8-v3-candidate.json>
```

It must return `candidate-evidence-validated-not-installable`. Never downgrade V3 to V2, fill a missing selector with RC.6 data, or run it through the RC.6 runner.

Delete the temporary release record after use.

## Verify artifacts

Prepare both the target artifact and, when changing an installed theme, the exact previous artifact:

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
7. Prompt the user to restart Harness. Launch acceptance with `node <skill-dir>/scripts/run-dsh.mjs web [--port <port>]`; the launcher forces `127.0.0.1`, disables telemetry, and rejects `--patch`, `--trusted-host`, LAN, and wildcard binds.
8. Before opening a browser, run `node <skill-dir>/scripts/assert-loopback.mjs --url <actual-url>`. Only after that passes may you verify the browser roster and light/dark/system values. `--trusted-host` is a browser-trust fence, not authentication, and is never an exception to this gate.

If any post-removal step fails, remove a partial target, reinstall the prepared previous artifact when present, and verify again. If the previous state was built-in, leave no DSH-Themes package installed.

## Remove or roll back

To return to the built-in palette, inspect, remove the one active theme, verify no DSH-Themes dependency remains, and request a restart.

For rollback:

1. Validate the record: `node <skill-dir>/scripts/theme-state.mjs validate-record --input .dsh-themes/rollback.json`.
2. Inspect current state and ensure it matches the record's target, where `null` means the built-in palette.
3. Re-verify the previous artifact, if present.
4. Remove the target and install the previous exact artifact, or install nothing for the built-in palette.
5. Verify and restart Harness.
6. Generate a reverse record with `theme-state.mjs reverse --input ...`, archive the consumed record, and save the reverse record atomically.

Quote every path. The cross-platform launcher resolves the attested Node entry and pnpm shim; do not substitute `dsh`, `dsh.cmd`, `pnpm dlx`, or `npx`. Never use an unresolved environment variable, home directory, or workspace root as an artifact target.
