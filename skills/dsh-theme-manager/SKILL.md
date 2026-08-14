---
name: dsh-theme-manager
description: Safely install, switch, remove, verify, or roll back verified DSH-Themes packages in the DeepSeek Harness web profile. Use for exact .tgz theme installation, active-theme inspection, conflict detection, built-in palette restoration, or rollback after a failed or unwanted theme change.
---

# DSH Theme Manager

Manage at most one verified `@dsh-themes/*` Cordis plugin in the `web` profile. Theme changes require a DeepSeek Harness restart.

## Safety boundaries

- Mutate the profile only with `dsh plugin --profile web`. Never edit `$DSH_HOME`, `~/.dsh`, a profile package file, lockfile, Harness `dist`, or `index.html`.
- Accept only an exact package version with a trusted catalog record, HTTPS URL or explicit absolute local path, SHA-256, and `0.1.0-rc.6` compatibility record.
- Never execute a downloaded package, lifecycle script, author JavaScript, CSS, or HTML while verifying it.
- Stop when more than one direct `@dsh-themes/*` dependency exists, a version is a range, compatibility differs, or an exact rollback artifact cannot be prepared.
- Explain that a hash proves agreement with the selected catalog record, not publisher identity.

Read [references/compatibility.md](references/compatibility.md) before changing a profile.

## Inspect

1. Resolve `dsh`; stop if unavailable.
2. Compare `dsh --version` with the release's exact compatibility version.
3. Run `dsh --profile web --dump-config`; do not echo unrelated configuration.
4. Save the output of `dsh plugin --profile web list --json` to a permission-restricted temporary file.
5. Detect conflicts:

   ```bash
   node <skill-dir>/scripts/theme-state.mjs inspect --input <plugin-list.json>
   ```

The script fails on multiple theme packages or non-exact versions. Delete the temporary list after use.

## Verify artifacts

Prepare both the target artifact and, when changing an installed theme, the exact previous artifact:

```bash
node <skill-dir>/scripts/fetch-and-verify.mjs \
  --source <https-url-or-absolute-local-path> \
  --sha256 <64-lowercase-hex> \
  --output <new-absolute-path.tgz> \
  [--origin <trusted-https-origin>]
```

`--origin` is required for a remote source and must match the artifact origin explicitly recorded by the trusted catalog; redirects cannot cross that origin. The verifier refuses HTTP, oversized responses, hash mismatches, relative local paths, and overwrites. Keep verified files in a workspace-local `.dsh-themes/artifacts/` directory. Do not delete an artifact referenced by the current rollback record.

## Install or switch

1. Summarize current, target, compatibility, and prepared rollback package. Obtain confirmation before mutation.
2. Generate a rollback record without profile contents or credentials:

   ```bash
   node <skill-dir>/scripts/theme-state.mjs record \
     --target-name @dsh-themes/<slug> --target-version <exact> \
     --target-artifact <absolute-target.tgz> --target-sha256 <sha256> \
     [--previous-name ... --previous-version ... --previous-artifact ... --previous-sha256 ...]
   ```

3. Save the JSON output atomically as `.dsh-themes/rollback.json`; archive an existing record without overwriting it.
4. Remove the current theme, if any: `dsh plugin --profile web remove "<current-package>"`.
5. Add the verified target: `dsh plugin --profile web add "<absolute-target.tgz>" --save-exact`.
6. Re-run dump-config and list. Confirm one exact target and no prior theme.
7. Prompt the user to restart Harness; only then verify the browser roster and light/dark/system values.

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

Quote every path. On Windows use the resolved `dsh.cmd` shim when necessary. Never use an unresolved environment variable, home directory, or workspace root as an artifact target.
