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
them into a command. All child processes receive a fixed executable and an
argument array with `shell: false`. pnpm, DSH, and cold Web probes all share
one frozen minimal environment: explicit `DSH_HOME`, the already-reviewed
`PATH`, required OS home/user/temp fields, and locale fields only. Never
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

Alpha.1 currently launches the first `pnpm` on PATH internally and exposes no
absolute package-manager executable option. The transaction checks that this
actual PATH executor reports exactly `11.7.0`; it does not claim that a
separate Corepack invocation pins the child process. Before the 0/80 gate can
be promoted, the six-task receipts must bind the resolved executor identity or
a separately reviewed private PATH shim must become part of the authority.
Neither mechanism is authorized by the current pending files.

The local recovery trust key currently has a certified private-permissions
implementation only on macOS and Linux. Windows `mode` bits are not ACL proof;
until a reviewed SID-only, no-inheritance key-store path passes the six-task
matrix, install/remove/recover transactions fail before Profile mutation on
Windows. This is an explicit promotion blocker, not a platform pass.

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
   mutation, query the effective project values with the same PATH-resolved
   pnpm, the exact frozen minimal environment used for mutation, and a fixed,
   shell-free argument array; require global build permission to remain false,
   strict dependency builds to remain true, and every reviewed key to resolve
   true. Any pnpm error, warning, malformed output, or effective
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
