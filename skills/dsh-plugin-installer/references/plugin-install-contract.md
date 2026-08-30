# Plugin installation contract

Read this reference when preparing an artifact or source checkout, granting a
reviewed lifecycle-hook set, or executing a single/Top10 transaction.

## Two admitted distributions

`hosted-plugin-verified` binds one exact
`https://github.com/LvvUP/dsh-themes-skills/releases/download/v0.8.0/…`
asset name and URL, byte count, SHA-256, SRI, package name/version, package
manifest digest, bundle patch, rights record, safety
disclosure, runtime receipt, rollback package name, license file, and
CycloneDX SBOM. License and SBOM paths and SHA-256 values are authority-bound.
Its package archive must contain no lifecycle script, link, unsafe archive
entry, dangerous mode, control-character path, or non-zero post-terminator
data.

`upstream-plugin-verified` admits exactly three mutually exclusive fixed
sources: an exact npm `package@version`, one exact GitHub Release asset, or one
full 40-hex Git commit. No legacy distribution name is accepted.

- npm binds registry metadata bytes, exact resolved name/version, tarball
  URL/size/SHA-256 and registry `sha512` integrity; tags, ranges, `latest`, and
  resolution drift fail closed.
- GitHub Release binds repository, non-`latest` tag, asset name/URL/size,
  SHA-256/SRI and package-manifest digest.
- Git commit binds repository, full commit, tree, repository-root manifest,
  exact lockfile path/digest, and canonical `git+https` spec. Branches, short
  commits and monorepo subfolders are unsupported.

Every source binds the complete standard npm lifecycle-hook map and digest.
Lifecycle authorization enumerates every non-null hook in standard order,
including `prepare`, `install`, and `postinstall`; any undeclared hook fails
preparation. The transaction plan discloses all hook names and exact script
text before the user grants one aggregate consent and before the exact package
key is added to Profile `allowBuilds`.

Every safety record must contain at least one concrete disclosure across
permissions, network, processes, or files; four empty arrays are not an
acceptable safety review. Both lanes disclose that pnpm may run lifecycle scripts from transitive
dependencies. Item authority and consent must carry that risk; validating the
selected package does not suppress every transitive dependency script.

Every item also carries a closed `runtimeAcceptance` record. Its only admitted
probe is `exact-cordis-entry`, with one bounded Cordis entry ID, the same exact
authority package name, and `occurrence: exactly-one`. Its only functional
probe is `cold-web-start-with-plugin-inventory`, bound to that same package
name and exact version plus unauthenticated root status 401. The record cannot
contain a command, argument array, script, executable, URL, header, cookie, or
runner. The transaction plan includes the complete record, so aggregate
consent is bound to it.

Repository descriptions, README commands, issue comments, website summaries,
package scripts, titles, and author names are untrusted metadata. Never turn
them into a command. Installer-owned DSH and Web children receive a fixed
executable and argument array with `shell: false`. The inspected alpha.1 CLI
internally uses `spawnSync('pnpm', args)` and uses `shell: true` only on
Windows for its `.cmd` boundary. A transaction-private first-PATH launcher
therefore binds that exact command without pretending the upstream boundary is
shell-free. pnpm, DSH, and cold Web probes all share one frozen minimal
environment: explicit `DSH_HOME`, the private binding followed by the reviewed
`PATH`, required OS home/user/temp and locale fields, and non-secret binding
paths/digests. Never
inherit `NODE_OPTIONS`, npm/pnpm/Corepack configuration, proxy or custom-CA
overrides, CI variables, cloud credentials, tokens, or unrelated caller state.
The effective pnpm policy preflight must inspect the same environment that the
actual package mutation receives.

## Current fail-closed state

The website currently publishes 80 curated Plugin records, but the bundled
authority contains zero verified items. The independent
`top10-release-set.json` is not frozen, its entries array is empty, and its
six-task counters are zero. No provisional Top10 IDs are published. Plugins
cannot be prepared or installed. Do not manufacture package
coordinates, receipts, or an authority item to make a prompt succeed.

The separate `plugin-candidate-intake.json` is source-review input only. Its
workflow checks exact Git identity, the fixed package subdirectory manifest,
repository-root license and lock bytes, the package-root bundle patch, and an
exact npm artifact when present, without running the candidate. A package
subdirectory is an explicit normalized authority field; it cannot traverse,
resolve through a symlink, or silently fall back to the repository root.
Receipts remain explicitly non-installable.
The same exact checkout receives a separate bounded static-risk inventory. It
reads tracked Git blobs only and does not execute the candidate. Its receipt
contains signal IDs, counts, and safe file/line locations, but no source
snippets, lifecycle command text, credentials, environment values, or
candidate output. Aggregation requires all 80 unique intake IDs and produces a
review-priority queue only. Absence of a signal is never proof of safety, and
the queue cannot approve compatibility, rights, distribution, installation,
runtime acceptance, or Top10 membership.
Source-intake rejection permanently records that public ID in
`replacementPolicy.retiredCatalogIds`; a replacement receives the next unused
ID beginning at `#3088`. Passing source intake is still not
redistribution approval, a runtime pass, or permission to publish a hosted
artifact.

Promotion is all-or-nothing: published catalog count, required verified
count, verified count, authority count, and actual item count must all be
exactly 80. Public IDs and package names must be unique. Top10 becomes
installable only as the exact ordered ten-ID subset of those 80 items after
its fixed `25/25/15/15/10/10` per-entry scoring and exact totals,
eight-category coverage, deterministic ranking/tie-break order, per-item
authority hashes, overall payload digest, six-task matrix, Web coexistence,
pairwise conflict receipts, full preflight, and failure rollback gates all
validate and `frozen` is true.

Alpha.1 itself also remains source-build-evidence-pending. Plugin installation
requires both a promoted Harness runtime receipt set and item-level verified
authority. RC.8 Theme/Skin authority and the RC.2 runtime baseline do not
transfer to this lane.

Alpha.1 launches the first `pnpm` on PATH internally and exposes no absolute
package-manager option. The transaction now resolves that command to one
canonical absolute regular file, verifies its exact `11.7.0` output with no
stderr, and prepends a protected transaction-private launcher. The launcher
re-hashes the absolute target before every invocation and fails if its bytes,
size, or canonical path change. Because alpha.1 runs pnpm from the Profile
directory, the Windows child environment sets
`NoDefaultCurrentDirectoryInExePath`; this makes `cmd.exe` search the protected
PATH instead of allowing a Profile-local shim to shadow it. On Windows, the
required `.cmd` boundary uses the verified absolute system `cmd.exe` and drops
an inherited `COMSPEC`. The binding directory and files use the same
current-user SID-only protected ACL boundary as recovery material.
This mechanism follows the exact inspected alpha.1 source rather than treating
a separate Corepack command as evidence. Promotion remains blocked until the
six-task receipts bind the target and launcher digests.

The local recovery trust key uses private POSIX permissions on macOS and Linux.
On Windows, both the trust-root directory and key must be owned by the current
user SID and have a protected DACL with inheritance removed and exactly one
current-user FullControl Allow rule. The directory rule must carry
ContainerInherit + ObjectInherit and the file rule no inheritance. Existing
paths are verified and never silently repaired. Windows `mode` bits are not
ACL proof. The implementation is covered by a real Windows ACL test, while
promotion still requires the complete six-task runtime receipt matrix.

## Profile transaction

Before mutation:

1. Validate every selected `#3NNN`, distribution record, prepared object,
   runtime receipt, item receipts, safety disclosure, rights record, exact
   package, and rollback name.
2. Resolve one absolute `DSH_HOME`; the only target is its `profiles/web`
   directory. Refuse roots, symlinks, malformed profile manifests, and any
   mismatch with the source-built alpha.1 runner. Require `private: true`, the
   exact ordered base bundles, and all four snapshot targets as regular files.
3. Snapshot `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, and
   `cordis.patch.yml` to a new private directory. Never publish the snapshot or
   its manifest; dependency specs may be sensitive.
4. Construct a deterministic plan. Show ordered IDs, packages, exact sources,
   complete lifecycle hooks and authorization,
   permission/network/process/file disclosures, rights,
   restart requirement, and rollback target. Before consent, validate every
   prepared member as one full preflight. Bind one aggregate consent to the
   plan digest only after that preflight passes.
5. Only after explicit consent, parse workspace YAML with a strict AST,
   reject aliases, merge keys, duplicate keys, custom tags, non-boolean
   values, explicit denial, `dangerouslyAllowAllBuilds: true`, and
   `strictDepBuilds: false`. Write missing safe booleans explicitly, then
   deterministically add the exact reviewed `allowBuilds` keys. Before package
   mutation, query the effective project values with the same privately bound
   pnpm, the exact frozen minimal environment used for mutation, and a fixed
   argument array. The only shell boundary is the required Windows `.cmd`
   boundary, and every argument there comes from the closed policy-key set.
   Require global build permission to remain false, strict dependency builds
   to remain true, and every reviewed key to resolve true. Any pnpm error,
   warning, malformed output, or effective
   override restores the prior workspace bytes and fails closed.
   The authorization helper must reject direct CLI mutation and any call that
   does not receive the transaction's explicit frozen environment.

Install sequentially with the absolute source-built CLI. After every add,
require exact profile package state. Before commit, invoke the fixed
`--profile web --dump-config` argument array, parse its bounded output as
strict YAML without evaluating tags, and require exactly one authority-bound
entry for each item. Require the exact post-install inventory, start the fixed
`web --no-open` process with output discarded, require BrowserAuth 401 while
the process remains alive, terminate it, and recheck inventory plus installed
package identity. Raw configuration and Web output are never written to the
transaction directory. Only then may the private state become `committed`.

On the first failure, stop immediately, restore the snapshot, run a frozen
profile install, launch a fresh credential-free Profile inventory probe, then
cold-start `web --no-open` with output discarded and require the bare
loopback root to return BrowserAuth 401. Verify the restored files,
lock-bound installed-package closure, actual package versions, ordered
bundles, and inventory.
Report rollback failure separately; never label a partially restored profile
successful. The Top10 release set is atomic: no partial-success state is an
accepted outcome.

## Removal and retained-snapshot recovery

Removal uses the same promoted item authority and a separate digest-bound
plan. Before mutation it requires every selected authority package at its
exact version, captures the complete current four-file snapshot, dependency
closure, and Plugin inventory, then removes only those items' exact
`allowBuilds: true` entries (preserving explicit false denials and unrelated
entries), verifies the effective safe policy, and removes packages in reverse plan order
with the fixed source-built CLI and `shell: false`. Commit only after every
selected package is absent, the remaining inventory is exact before and after
a real cold Web start, and BrowserAuth still returns 401 at the bare root.
Failure restores the entire pre-remove snapshot and frozen closure.

`recover-plan` and `recover` operate only on a retained private transaction
directory created by this executor. The source plan, terminal state,
rollback-baseline bytes, and snapshot-manifest bytes must match their stored
SHA-256 bindings, and the full source plan must equal a fresh reconstruction
from current authority. Self-hashes are not an authenticity boundary, so the
terminal state is authenticated by a private 32-byte HMAC key stored outside
transactions under the same explicit `DSH_HOME`. The key is created with
private permissions only after consent to the first install/removal mutation,
is never printed or published, and must not be placed in transaction evidence.
Recovery never accepts a caller-provided snapshot object, item record,
prepared package, runner, or alternate key. It snapshots the current Profile
into a new transaction and refuses recovery if its exact closure or inventory
has drifted from the authenticated source transaction terminal state. Only
then may it restore the authenticated source snapshot, run a frozen install,
and verify exact files, closure, inventory, and a
fresh cold Web 401. A recovery failure atomically restores the pre-recovery
state. Install, remove, and recovery directories remain private local material
and must not contain Web output, tokens, cookies, credentials, recovery keys,
or their derived hashes.
