# Plugin installation contract

Read this reference when preparing an artifact or source checkout, rejecting or
isolating lifecycle-build requirements, or executing a single/Top10 transaction.

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
- Git commit binds repository, full commit, tree, repository-root manifest and
  canonical `git+https` spec. Runtime dependencies or any standard lifecycle
  hook require an exact lockfile path/digest. A null lockfile pair is admitted
  only for an already-built package whose exact manifest has no runtime or peer
  dependency graph and no standard lifecycle hook. Branches, short commits and
  monorepo subfolders are unsupported.

Every source binds the complete standard npm lifecycle-hook map and digest.
Lifecycle metadata enumerates every non-null hook in standard order, including
`prepare`, `install`, and `postinstall`; any undeclared hook fails preparation.
The v0.8.0 transaction rejects every package that requires a live lifecycle
build before consent. Supporting such a candidate requires an isolated,
preferably network-denied build review followed by a digest-bound script-free
artifact when redistribution rights allow; otherwise the candidate is replaced.

A selected package receives an explicit negative rule for its peer-normalized
lockfile depPath. A positive rule already
present for that same exact depPath fails closed instead of being overwritten.
Each negative rule newly added by the installer carries the exact
`dsh-plugin-installer-owned-v1` value comment. The comment is provenance for
bounded stale-rule cleanup, not an authorization token.

Every safety record must contain at least one concrete disclosure across
permissions, network, processes, or files; four empty arrays are not an
acceptable safety review. Both lanes disclose transitive lifecycle risk, but
the installer grants no implicit transitive build permission: every depPath
newly introduced by the script-disabled resolution phase is written
`allowBuilds: false`. A plugin that requires such a build cannot pass runtime
acceptance under this authority.

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
executable and argument array with `shell: false`. The pinned Harness CLI
internally invokes `pnpm` by name and uses a Windows shell for its `.cmd`
boundary. A transaction-private first-PATH wrapper therefore binds only that
upstream boundary; installer-owned resolution executes the verified private
`pnpm.cjs` through the certified absolute Node without a shell. pnpm, DSH, and
cold Web probes all share one frozen minimal
environment: explicit `DSH_HOME`, a PATH containing only the private binding,
required OS home/user/temp and locale fields, and non-secret binding
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
[`alpha2-plugin-migration-map.md`](alpha2-plugin-migration-map.md). alpha.2 has
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

The exact alpha.2 official npm runtime has a promoted 6/6 Harness receipt set.
Plugin installation still requires both that promoted baseline and item-level
verified authority; the first gate is satisfied, while the bundled Plugin
authority remains 0/80. RC.8 Theme/Skin authority and the RC.2 runtime baseline
do not transfer to this lane.

The installer carries the official pnpm `11.7.0` registry tarball under a
closed authority that fixes its immutable URL, bytes, SHA-256, registry
SHA-512 integrity, manifest, entry count, unpacked bytes, whole-closure
SHA-512, MIT license, and notice. Network retrieval is a maintenance action,
never part of an install transaction. Each transaction verifies the archive
and extracts exactly its declared regular-file closure into a private root;
extra, missing, renamed, duplicate, case/Unicode-colliding, linked, special,
unsafe or over-limit entries fail closed. The certified absolute Node executes
the private `package/bin/pnpm.cjs` directly. No PATH pnpm or Corepack closure is
an implementation fallback.

Because Harness itself exposes no absolute package-manager option, its fixed
commands receive a protected transaction-private first-PATH wrapper. The
wrapper revalidates the fixed Node and private CLI and must answer a fresh
nonce with a closed structured launch proof before use. The bound child PATH
contains only this private directory; there is no caller-command fallback.
Windows fixes `PATHEXT` to `.CMD;.EXE;.COM;.BAT`, places the private
`pnpm.cmd` first, sets `NoDefaultCurrentDirectoryInExePath`, and uses the
verified absolute system `cmd.exe`; neither a Profile-local command nor a
later-path `pnpm.exe` can win. Each Plugin's promotion remains blocked until its
six runtime receipts bind artifact, closure, Node, wrapper, and wrapper-runner
digests.

The local recovery trust key uses private POSIX permissions on macOS and Linux.
On Windows, both the trust-root directory and key must be owned by the current
user SID and have a protected DACL with inheritance removed and exactly one
current-user FullControl Allow rule. The directory rule must carry
ContainerInherit + ObjectInherit and the file rule no inheritance. Existing
paths are verified and never silently repaired. Windows `mode` bits are not
ACL proof. Strict directory configuration and closed-file verification use
`FileShare.Read` only and exclude Write/Delete. The sole relaxed action is
initial ACL configuration while the installer's own Node file-writer handle is
still open; it admits Write but never Delete, and closing that handle must be
followed by strict verification before movement. PowerShell `Add-Type` runs
only with a fresh local NTFS TEMP/TMP protected to one current-user SID rule.
Its parent is selected from process `LOCALAPPDATA\\Temp` and then the one
agreed caller `TEMP`/`TMP`; neither is a trust root, and both candidates must
pass the identical owner, full ancestor-chain, NTFS, atomic-create, and
file-identity proof. Only the fresh verified child is forwarded to `Add-Type`,
so a shared or redirectable runner temp fails closed rather than being trusted.
The implementation is covered by a real Windows ACL test, while each Plugin's
promotion still requires its complete six-task runtime receipt matrix.

## Profile transaction

Before mutation:

1. Validate every selected `#3NNN`, distribution record, prepared object,
   runtime receipt, item receipts, safety disclosure, rights record, exact
   package, and rollback name.
2. Resolve one absolute `DSH_HOME`; the only target is its `profiles/web`
   directory. Refuse roots, symlinks, malformed profile manifests, and any
   mismatch with the source-built alpha.2 runner. Require `private: true`, the
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
6. Only after explicit consent, run the exact add spec through the certified
   absolute Node plus transaction-private `pnpm.cjs`, with `shell: false`, an
   explicit `--` option terminator, and `--ignore-scripts --lockfile-only`.
   This resolution phase deliberately
   bypasses alpha.2's Windows `dsh plugin` cmd forwarding, which cannot retain
   an artifact path containing spaces as one literal argument. Strictly parse
   the bounded resulting
   `pnpm-lock.yaml`, bind each direct plugin to its exact depPath, and compute
   the complete package-key delta from the pre-transaction lockfile. Do not
   materialize packages or execute lifecycle scripts in this phase.
7. Parse workspace YAML with a strict AST,
   reject aliases, merge keys, duplicate keys, custom tags, non-boolean
   values, explicit denial, `dangerouslyAllowAllBuilds: true`, and
   `strictDepBuilds: false`. Write missing safe booleans explicitly, add
   `false` for the entire newly resolved peer-normalized depPath closure and
   never add a new positive lifecycle rule. Before package materialization,
   query the effective project values with the same privately bound pnpm
   closure, the exact frozen minimal environment used for mutation, and a
   fixed argument array. A Windows `.cmd` wrapper is invoked only through the
   trusted system `cmd.exe` after its structured launch proof. Every argument
   comes from the closed policy-key set or the exact prepared artifact path.
   Require global build permission to remain false, strict dependency builds
   to remain true, and every transaction key to remain denied. Any pnpm error,
   warning, malformed output, or effective
   override restores the prior workspace bytes and fails closed.
   The authorization helper must reject direct CLI mutation and any call that
   does not receive the transaction's explicit frozen environment.

Materialize the resolved batch once with the absolute source-built CLI using
`--frozen-lockfile --ignore-scripts --ignore-pnpmfile`; require the lockfile
bytes to remain identical and every exact package state to match. Before commit,
invoke the fixed
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
the only temporary relaxation admits the installer's already-open writer but
never a delete share. Only then is it written and synced; after the handle is
closed, strict no-write/no-delete verification must succeed before it is moved
on the same volume with the
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
Every helper that compiles its fixed C# boundary resolves PowerShell below the
trusted loaded Windows system root, ignores caller SystemRoot/WINDIR, and gives
`Add-Type` only the SID-only local NTFS bootstrap temp. Native move and
existence checks receive `\\?\` drive/UNC long paths throughout.

## Removal and retained-snapshot recovery

Removal uses the same promoted item authority and a separate digest-bound
plan. Before mutation it requires every selected authority package at its
exact version, captures the complete governed Profile and `DSH_HOME` snapshot,
dependency closure, and Plugin inventory, then removes only provenance-safe
exact historical depPath authorizations while preserving explicit false
denials and unrelated entries. A legacy broad package-name `true` without
installer provenance fails closed for explicit migration. It verifies the
effective safe policy and removes packages in reverse plan order with the fixed
source-built CLI using only `--lockfile-only`, `shell: false`, and an explicit
`--` option terminator before every package name. After every reverse-order
resolution succeeds, it performs one fixed
`install --frozen-lockfile --ignore-scripts --ignore-pnpmfile` materialization,
requires the resolved lockfile bytes to remain identical, and only then checks
physical absence. After that frozen materialization, strict YAML and lockfile
parsers atomically remove only installer-marked `false` rules whose
peer-normalized key is absent from both current packages and snapshots maps.
Unmarked user denials, reachable marked denials, and every `true` value are
preserved. Forging the marker cannot enable a build because cleanup never
creates or changes a positive value and `strictDepBuilds: true` remains
mandatory. Commit only after every
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
