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
ID fixed by `replacementPolicy.nextReplacementCatalogId` (currently `#3089`).
Passing source intake is still not
redistribution approval, a runtime pass, or permission to publish a hosted
artifact.

An RC-era candidate also follows
[`alpha1-plugin-migration-map.md`](alpha1-plugin-migration-map.md). alpha.1 has
no aggregate runtime or APIProxy facade, so a package-name substitution is not
compatibility evidence. The owning service, disposer, BrowserAuth boundary,
capability disclosure, and matching dynamic probe must all be explicit.

A license-permitted hosted derivative additionally uses a closed
`plugin-hosted-adaptation.schema.json` recipe and a closed
`plugin-runtime-probe.schema.json` contract. The fixed builder verifies the
exact clean source commit/tree and every original/replacement digest, preserves
the exact upstream license, constructs a minimal script-free manifest with an
exact own-property peer closure, parses each JavaScript output into an Acorn AST,
and rejects all computed members/properties plus the closed high-risk capability
set, Node built-ins, indirect dependency loading, and React/DOM shapes outside
the checked-in reviewed allowlist. It also rejects
direct or statically foldable external CSS reference syntax; this is a bounded
static signal, not a proof about every runtime string composition. Every recipe
must bind an empty `computedMembers` array. The AST check is
defense in depth for digest-bound, manually reviewed replacements, not a
JavaScript sandbox or runtime certificate. The builder emits a normalized
tarball, CycloneDX SBOM, and modification notice, and executes no candidate
code. A successful build receipt remains
`candidateExecuted: false`, `installable: false`, and
`runtimeCertified: false`; deterministic staging bytes are not Release or
runtime authority. At present #3006, #3017, #3040, #3041, #3042, and #3050 are
the first six review-bound staging candidates; all remain non-installable,
while the promoted authority still contains zero installable items.

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
   exact ordered base bundles, and all four Profile snapshot targets as regular
   files.
3. Atomically acquire the one private cross-platform transaction lock below
   the explicit `DSH_HOME` trust root. Hold it from before snapshot creation
   through commit or the last successful rollback verification. A normal
   install/removal never treats age or a dead PID as permission to steal a
   lock. Only explicit recovery for the same retained source may replace a
   recorded dead holder; active, malformed, and mismatched locks fail closed.
   All acquisition paths serialize through one fixed private takeover guard.
   A leftover guard blocks automatically. Under the guard, stale takeover
   validates and re-reads the owner before atomically renaming that exact lock
   to an ID-bound quarantine; at most one concurrent recovery can own the new
   lock.
4. Snapshot Profile `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`,
   and `cordis.patch.yml`, plus the governed root `DSH_HOME` files
   `settings.yaml`, `cordis.patch.yml`, `.credentials.yaml`, and
   `.anonymous-user-id`, to a new private directory. Root files are optional;
   their prior absence is authoritative and rollback removes a file created by
   the transaction. Snapshot schema v3 also preserves and verifies every
   present file's POSIX permission bits on macOS and Linux. On Windows,
   restored files are re-secured to the current-user SID-only boundary instead
   of treating portable `mode` bits as ACL evidence. Never publish, print, or
   return the snapshot, manifest,
   private per-file digests, settings, or credential bytes. After this snapshot
   succeeds, a failure while capturing closure, probing initial inventory,
   writing private evidence, or loading/creating the recovery key must still
   restore and verify all eight governed file states. After closure and
   inventory both exist, the full closure/inventory/cold-start rollback is
   mandatory.
5. Construct a deterministic plan. Show ordered IDs, packages, exact sources,
   complete lifecycle hooks and authorization,
   permission/network/process/file disclosures, rights,
   restart requirement, and rollback target. Before consent, validate every
   prepared member as one full preflight. Bind one aggregate consent to the
   plan digest only after that preflight passes.
6. Only after explicit consent, parse workspace YAML with a strict AST,
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

On Windows, every restored present file is written through a same-directory
temporary file that is created empty. Before any private byte is written, the
temporary file receives and verifies the current-user SID-only protected ACL;
only then is it written, synced, closed, and moved on the same volume with the
fixed Win32 `MoveFileExW(..., MOVEFILE_WRITE_THROUGH)` boundary. The same
write-through move creates every trust, transaction, snapshot, guard, lock,
and journal directory entry before Profile mutation. macOS and Linux instead
sync the exact parent directory after each critical create or rename. If an original target
exists, its backup is retained until the renamed target passes a second ACL
verification. Any later failure removes the replacement and restores that
backup; when the original target was absent, failure removes the newly created
target. CI exercises the fixed helper on both supported Node lines and performs
a real file-plus-directory move on Windows; mocked tests also reject weak
proofs, cross-volume targets, inherited environment, and target replacement.

## Removal and retained-snapshot recovery

Removal uses the same promoted item authority and a separate digest-bound
plan. Before mutation it requires every selected authority package at its
exact version, captures the complete governed Profile and `DSH_HOME` snapshot,
dependency closure, and Plugin inventory, then removes only those items' exact
`allowBuilds: true` entries (preserving explicit false denials and unrelated
entries), verifies the effective safe policy, and removes packages in reverse plan order
with the fixed source-built CLI and `shell: false`. Commit only after every
selected package is absent, the remaining inventory is exact before and after
a real cold Web start, and BrowserAuth still returns 401 at the bare root.
Failure restores the entire pre-remove snapshot and frozen closure.

`recover-plan` and `recover` operate only on a retained private transaction
directory created by this executor. The source plan and terminal state must
equal a fresh reconstruction from current authority. Self-hashes are not an
authenticity boundary: a fresh private 32-byte per-transaction nonce plus the
private 32-byte HMAC key stored outside transactions under the same explicit
`DSH_HOME` create domain-separated opaque bindings for the rollback-baseline
and snapshot-manifest bytes and for the terminal closure/inventory drift
checks. The nonce exists only in the protected local authentication record.
Neither ordinary snapshot-manifest or potentially private dependency-closure
SHA-256 nor the nonce is copied into state, a recovery plan, or CLI output;
opaque bindings in private state are also suppressed from CLI output. Recovery
plans instead bind one random public transaction ID that is independent of all
Profile bytes, so consent identifies one retained transaction without
disclosing a secret-derived fingerprint. The key is created with
private permissions only after consent to the first install/removal mutation,
is never printed or published, and must not be placed in transaction evidence.
Recovery never accepts a caller-provided snapshot object, item record,
prepared package, runner, or alternate key. It snapshots the current Profile
into a new transaction and refuses recovery if its exact closure or inventory
has drifted from the authenticated source transaction terminal state. While
the exclusive lock is held and before that snapshot, it also authenticates
the existence, POSIX mode, and exact bytes of all eight governed files against
the terminal managed-file HMAC. Every private JSON artifact is opened without
following symlinks and is permission-, identity-, link-count-, and size-checked
and read through that same file handle. Only
then may it restore the authenticated source snapshot, run a frozen install,
and verify exact files, closure, inventory, and a fresh cold Web 401. When the
current closure and inventory were captured, a recovery failure atomically
restores that pre-recovery state. An interrupted source may already have an
invalid closure that cannot be captured: after frozen dependency restoration
starts, any later failure restores the governed files but deliberately retains
the takeover lock for manual closure inspection rather than claiming a complete
rollback. If the recovery process itself is terminated between those durable
steps, its exclusive lock likewise remains fail-closed; the executor does not
guess at, delete, or automatically steal that recovery lock. Install, remove,
and recovery directories remain private local material.
The snapshot may contain exact settings and credential bytes required for
recovery; no plan, state receipt, log, screenshot, Web output, or public
evidence may contain those bytes, browser tokens, cookies, authorization
headers, recovery keys, or secret-derived fingerprints.

Install and removal write an authenticated `in-progress.json` immediately
before the first Profile mutation. Its state and HMAC bind the transaction ID,
exact plan digest and catalog IDs, rollback-baseline binding,
snapshot-manifest binding, action, atomicity, and original lock holder. An
interrupted recovery plan is a separate consent object and is available only
while `state.json` is absent and the authenticated holder exactly equals a
stale `transaction.lock`; execution repeats that comparison under the takeover
guard. If `state.json` exists, it is the terminal marker and the loader does
not open `in-progress.json`, so a committed or removed transaction cannot
replay its rollback journal. Successful terminal finalization removes the
journal after the authenticated state is durable.
