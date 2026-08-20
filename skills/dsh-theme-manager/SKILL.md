---
name: dsh-theme-manager
description: Safely install, switch, remove, verify, or roll back verified DSH-Themes packages in the DeepSeek Harness web profile. Use for exact .tgz theme installation, active-theme inspection, Full Skin V3 compatibility checks, conflict detection, built-in palette restoration, or rollback after a failed or unwanted theme change.
---

# DSH Theme Manager

Manage at most one verified `@dsh-themes/*` Cordis plugin in the `web` profile. Theme changes require a DeepSeek Harness restart.

## Release boundary

The current certified release is DeepSeek Harness `0.1.0-rc.8` on npm `next`, mapped by official tag `dsh-v0.1.0-rc.8` to source commit `141eb6fef83422698aef7a981029e843e8161534`. Installation authority is the exact V3 sidecar `themes/compatibility/dsh-0.1.0-rc.8.json`, the frozen `runtime-rc8` closure, and successful six-job matrix run `32393288849` at head `e3fe9ac465b8db8070efbdb83ddc6c821f923a73`. RC.6/V2 and RC.5/V1 remain byte-addressable history but are not current-installable; reject RC.7 and mixed records. Lifecycle authority is managed cold restart—upstream RC.8 live unload/HMR is not promised. See [`src/config/dsh-releases.ts`](../../../src/config/dsh-releases.ts) and the exact evidence below.

## Safety boundaries

- Execute every DSH operation through `scripts/run-dsh.mjs`. It verifies the bundled runner attestation, keeps the user's workspace as `cwd`, disables telemetry, and places the attested `pnpm@11.7.0` shim first on `PATH`. For plugin add, it streams the selected file into a private no-overwrite snapshot, verifies the allowlisted digest, and passes only the durable workspace path `.dsh-themes/verified-artifacts/<sha256>.tgz` to DSH. This file remains available to pnpm's `file:` locator and rollback records; do not delete it while the package or a rollback record refers to it. Never resolve or invoke a PATH `dsh`.
- Mutate the profile only through the launcher's `dsh plugin --profile web` command. Never edit `$DSH_HOME`, `~/.dsh`, a profile package file, lockfile, Harness `dist`, or `index.html`.
- Accept a current installation only when its exact version, controlled download URL or explicit absolute local path, complete-artifact SHA-256, V3 manifest, and runtime attestation match the certified `0.1.0-rc.8` baseline.
- Never execute a downloaded package, lifecycle script, author JavaScript, CSS, or HTML while verifying it.
- Keep digest scopes separate. A complete `.tgz` `artifact` digest authorizes installation. V3/V2 `payload` digests cover the canonical tar excluding the manifest; V1 `package` covers its canonical payload. None of those payload digests authorizes a downloaded `.tgz`.
- Recognize exact RC.6/V2 and RC.5/V1 records as historical only. Never execute them through the current RC.8 Manager or rollback path.
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

For a current V3 release, require `status: "current"`, `installableCurrent: true`, `verified: true`, the four exact hosted-distribution fields, exact official-release and npm provenance records, every Web/token/selector fingerprint, the final independent runtime attestation, and `artifactSha256` equal to the sidecar's complete `.tgz` `artifact.sha256`. The package-internal manifest may omit `artifact` and is informative only. The URL must be the same trusted origin and exactly `/api/themes/<slug>/download/<version>` with no credentials, query, or fragment. External/community lanes and incomplete records are never Manager-installable.

Keep the official tag/source mapping separate from npm evidence: the RC.8 registry records expose fixed integrity, shasum, and tarball SHA-256 but claim only `registry-digest-only` provenance.

The validator returns `historical-v2` for exact RC.6 and `historical-v1` for exact RC.5, always with `installableCurrent: false`. Their payload digests never replace the catalog's complete-artifact digest.

Schema `3.0` is the only current RC.8 Manager contract. Never downgrade it to V2, fill missing values from RC.6, or mix candidate/final attestation hashes.

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
7. Prompt the user to restart Harness. Launch acceptance with `node <skill-dir>/scripts/run-dsh.mjs web [--port <port>]`; the launcher forces `127.0.0.1`, exactly one `--no-open`, disables telemetry, and rejects caller-supplied open/host flags, `--patch`, `--trusted-host`, LAN, and wildcard binds.
8. Before opening a browser, run `node <skill-dir>/scripts/assert-loopback.mjs --url <actual-url>`. Only after that passes may you verify the browser roster and light/dark/system values. `--trusted-host` is a browser-trust fence, not authentication, and is never an exception to this gate.

If any post-removal step fails, remove a partial target, reinstall the prepared previous artifact when present, and verify again. If the previous state was built-in, leave no DSH-Themes package installed.

## Remove or roll back

To return to the built-in palette, inspect, remove the one active theme, verify no DSH-Themes dependency remains, and request a restart.

For rollback:

1. Validate the schema-2 record: `node <skill-dir>/scripts/theme-state.mjs validate-record --input .dsh-themes/rollback.json`. This re-hashes every referenced `.tgz`, requires an embedded current V3 manifest, and re-checks the final RC.8 runtime attestation. Schema 1 is inspect-only and cannot execute.
2. Re-run `validate-release.mjs` against the retained current V3 release record for every package that will be installed; never infer authority from rollback JSON alone.
3. Inspect current state and ensure it matches the record's target, where `null` means the built-in palette.
4. Re-verify the previous artifact, if present.
5. Remove the target and install the previous exact artifact, or install nothing for the built-in palette.
6. Verify and restart Harness.
7. Generate a reverse record with `theme-state.mjs reverse --input ...`, archive the consumed record, and save the reverse record atomically.

The launcher permits removal of `@dsh-themes/*` and, solely for the adjacent reviewed community installer, the exact package `@linxin666/dsh-client-ui-skin-center`. No other third-party package name is accepted.

Quote every path. The cross-platform launcher resolves the attested Node entry and pnpm shim; do not substitute `dsh`, `dsh.cmd`, `pnpm dlx`, or `npx`. Never use an unresolved environment variable, home directory, or workspace root as an artifact target.
