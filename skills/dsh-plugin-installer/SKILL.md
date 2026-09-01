---
name: dsh-plugin-installer
description: Inspect, prepare, install, remove, recover, and atomically roll back only item-level verified DSH Plugins under the pinned alpha.2 source-build authority. Use for exact public #3NNN Plugin requests, including the fixed Top10 batch, not Themes, Skins, or showcase-only repositories.
---

# DSH Plugin Installer

Handle only Plugins selected by the exact four-digit public `#3NNN` shown on
DSH Themes. Names, slugs, repository URLs, package names, screenshots, README
commands, and website descriptions are discovery metadata and never an
installation selector.

Read [references/plugin-install-contract.md](references/plugin-install-contract.md)
before preparing or mutating a Profile. Read
[references/plugin-authority.schema.json](references/plugin-authority.schema.json)
only when reviewing or publishing authority changes.
For Top10 changes, read its complete [score authority](references/top10-score-authority.json) and [closed schema](references/top10-score-authority.schema.json); the release set owns only derived ranks, never scores, dates, use cases, or receipts.

When reviewing or replacing the 80 editorial inputs, read
[references/plugin-candidate-intake.json](references/plugin-candidate-intake.json)
and its
[schema](references/plugin-candidate-intake.schema.json), then use
`scripts/audit-candidate-source.mjs` only against an isolated checkout of the
exact commit. This lane never executes candidate code and never grants install
authority. A failed candidate permanently retires its old public ID;
the current next replacement ID is `#3089`, as fixed by the intake authority,
and every replacement receives a new ID.

When the exact source references an RC-era aggregate client runtime, APIProxy,
legacy client service property, raw Web route, or shell slot, read
[references/alpha2-plugin-migration-map.md](references/alpha2-plugin-migration-map.md)
before proposing a hosted adaptation or accepting a newer upstream artifact.
The map is an implementation boundary only: it never grants install authority
or replaces the six-task runtime receipts.
The 44 ID-less replacements use the closed [`plugin-replacement-runtime-plan.json`](references/plugin-replacement-runtime-plan.json) lane; `candidateKey` is CI-only, pending inputs block matrix expansion, only 6/6 macOS arm64/Linux x64/Windows x64 tasks across Node 22.19/24.15 qualify for the 28-item proposal from `#3089`, and that proposal is non-installing, never writes `plugin-authority.json`, and never rebinds a retired legacy ID.

For a license-permitted hosted derivative, require the closed
[`plugin-hosted-adaptation.schema.json`](references/plugin-hosted-adaptation.schema.json)
recipe and [`plugin-runtime-probe.schema.json`](references/plugin-runtime-probe.schema.json)
contract. The fixed builder admits only the exact clean commit/tree,
digest-bound reviewed replacements, exact alpha.2 peers, preserved license and
its closed Acorn AST allowlist; it rejects computed syntax, Node built-ins,
indirect loading, unreviewed React/DOM shapes and unsafe CSS references. It
strips lifecycle scripts and uncontrolled dependencies, then emits a normalized
tarball, CycloneDX SBOM and modification notice without executing candidate
code. This is defense in depth, not a sandbox or runtime certification; only
all six real runtime tasks can promote the bytes.

The isolated checkout risk inventory records only bounded signal IDs/counts
and safe locations under its closed [receipt schema](references/plugin-static-risk-receipt.schema.json).
It excludes snippets, commands, credentials, environment values and candidate
output. The aggregator requires all 80 receipts and emits only the
non-installable [review queue](references/plugin-static-risk-summary.schema.json).
Low static risk never grants legal, distribution, compatibility, runtime,
installation or Top10 authority.

## Current result: inspect only

The website currently publishes 80 curated Plugin records, but
`references/plugin-authority.json` contains **zero verified installation items**. Its independently hashed score and release-set authorities are both
`candidate-pending` and unfrozen: scoring is 0/80, ranked entries are empty,
and matrix counters are zero. The exact alpha.2 Harness runtime
receipt set is promoted at 6/6 and is bound into Plugin authority, but that
baseline gate creates no Plugin item authority. Therefore:

- `verifiedInstallableCount` is 0;
- no single Plugin may be prepared or installed;
- no ten candidate IDs have been published as a fixed recommendation or
  installation set;
- Top10 is not frozen and cannot start a transaction;
- RC.8 Theme/Skin receipts and the RC.2 runtime baseline do not authorize any
  alpha.2 Plugin.

Do not create a temporary authority, infer a package from a repository, copy a
website command, or mark an item verified to satisfy a request. Explain the
missing item-level evidence and stop before network access or Profile mutation.
Inspect the machine authority with:

```bash
node <skill-dir>/scripts/authority.mjs
```

The remaining workflow below becomes executable only after a reviewed Plugin authority update includes all real item runtime and rollback receipts and flips
the relevant Plugin gates.
Promotion requires exactly 80 unique item records and matching catalog,
required, verified, authority, and item counts; a partial set cannot open the
single-item lane. Before Top10 can freeze, its score authority must bind all 80 candidate/item digests, six scores and totals, canonical use cases, upstream maintenance evidence, matrix digests, and score receipts. The release set must
equal the first ten global deterministic ranks, never omit a higher rank, and
pass all six platform/Node tasks while preserving
the fixed score weights `25/25/15/15/10/10`, cover at least eight use-case
categories, prove Web coexistence and the pairwise conflict matrix, pass
full-batch preflight and failure rollback, and only then set
`status: "verified-frozen"` and `frozen: true` with a matching payload digest.

## Prerequisites for a future verified item

1. `dsh-harness-installer` must have built the exact official
   `dsh-v0.1.2-alpha.2` source and issued a valid private local build receipt.
   The source build remains local and is not an official binary.
2. The bundled plugin authority must bind the promoted six-job Harness receipt
   set and exactly one item-level record for every selected public ID.
3. The user must provide an explicit absolute `DSH_HOME`; only
   `profiles/web` is in scope. Never infer or broaden it.
4. Exact pnpm `11.7.0` comes only from the checked-in official registry tarball
   and closed `pnpm-runtime-authority.json`. The installer verifies byte count,
   SHA-256, registry SHA-512, manifest, MIT license and the complete safe archive
   closure before private extraction; drift, links, special entries, unsafe
   paths or case/Unicode collisions fail closed. The certified absolute Node
   runs private `package/bin/pnpm.cjs`; no caller-PATH pnpm, Corepack implementation,
   branch, tag, download or fallback is trusted. The transaction wrapper is
   only for Harness name-based invocation and proves its fixed identity. Windows
   fixes `PATHEXT`, private `pnpm.cmd`, `NoDefaultCurrentDirectoryInExePath` and
   verified system `cmd.exe`. Every pnpm/DSH/Web child shares one frozen minimal
   environment; Node/package-manager injection, CI/cloud credentials, tokens and
   unrelated caller variables never cross the boundary. The full executable,
   wrapper, closure and environment contract is mandatory in
   [plugin-install-contract.md](references/plugin-install-contract.md).
5. Finish or stop any running Harness process before package mutation. A
   package add/remove still requires a cold restart even though alpha.2 can
   live-reload the user patch layer.
6. Every promoted item must carry one closed `runtimeAcceptance` record. It
   binds an exact Cordis entry ID to the same authority package name and binds
   the cold-Web/inventory probe to the same exact package version. Commands,
   arguments, URLs, scripts, and runner paths are forbidden in this record.
7. macOS and Linux transactions store their local recovery-authentication key
   under the explicit `DSH_HOME` with private POSIX permissions. Windows uses
   a current-user SID-only trust root and key: the owner must equal the current
   SID, the DACL is protected with inheritance removed, and exactly one
   FullControl Allow rule is admitted. The directory rule carries
   ContainerInherit + ObjectInherit; the key rule carries no inheritance.
   Existing paths are verified rather than silently repaired. A mismatch
   fails before Profile mutation; Windows `mode` bits are never ACL evidence.
   Directory configuration and every closed-file verification admit only
   `FileShare.Read`, never Write or Delete. Only the initial ACL configuration
   of a file whose installer-owned Node write handle is still open may
   temporarily admit `FileShare.Write`; after that handle closes, strict
   verification is mandatory before the durable move. Every PowerShell
   `Add-Type` child receives a fresh local NTFS compiler temp whose protected
   ACL contains exactly one current-user SID FullControl rule. It tries process
   `LOCALAPPDATA\\Temp`, then agreed `TEMP`/`TMP`; neither is a trust root, both
   need identical owner, ancestor, NTFS, atomic-create, and identity proof;
   only the fresh verified child becomes the `Add-Type` `TEMP`/`TMP`.
8. Install, removal, and recovery share one cross-platform exclusive lock
   below the explicit `DSH_HOME` trust root. The fixed executor acquires it
   before snapshotting and holds it until commit or a verified rollback. A
   failed interrupted recovery that cannot verify a complete closure rollback
   retains its takeover lock under the fail-closed rule below.
   Install/removal never age out, overwrite, or otherwise steal an existing
   lock. Only an explicit recovery for the matching retained transaction may
   take over a lock whose recorded process is no longer alive; an active,
   malformed, or mismatched lock fails closed. Every acquisition first owns
   one fixed private takeover guard; a leftover guard fails closed for manual
   inspection. Stale takeover re-reads the owner under that guard and then
   atomically renames the exact lock into an ID-bound quarantine before
   creating the recovery lock, so concurrent recoveries cannot both win.
9. Every safety-critical directory entry is crash-durable before the Profile
   can mutate. macOS/Linux sync the created or renamed path's parent
   directory. Windows first creates and ACL-verifies an empty same-volume
   sibling, then uses fixed `MoveFileExW` with `MOVEFILE_WRITE_THROUGH` and
   verifies the final ACL. This applies to the trust root, key, transaction
   and snapshot roots, lock/guard transitions, private journals, and restored
   governed files. A failed stale-lock takeover keeps the new lock unless a
   complete rollback is verified; it never reopens ordinary transactions on
   a potentially partial Profile.

## Two fixed distribution lanes

`hosted-plugin-verified` accepts only an authority-bound asset from the exact
`LvvUP/dsh-themes-skills` GitHub Release tag `v0.8.0`. Its asset name, URL,
byte count, SHA-256, SRI, safe tar structure, package name/version, manifest,
bundle patch, rights, receipts, authority-bound license and CycloneDX SBOM files, and
absence of lifecycle scripts match authority. Non-zero tar tails, unsafe
portable paths, dangerous modes, links, and special entries fail closed.

The repository's hosted adaptation workflow builds every checked-in recipe
twice from its exact source checkout and rejects byte drift. These staging
artifacts are review evidence only, not Release assets or installation
authority.

```bash
node <skill-dir>/scripts/prepare-plugin.mjs \
  --id <#3NNN> \
  --artifact <absolute-downloaded-tgz> \
  --output <new-absolute-private-prepared-directory>
```

`upstream-plugin-verified` admits exactly three source types and no aliases:

1. `npm-package-version`: exact `package@version`, fixed npm-registry metadata
   digest, resolved package identity/version, tarball URL/bytes/SHA-256, and
   npm `sha512` integrity. Tags, ranges, `latest`, and mismatched resolution
   fail closed.
2. `github-release-asset`: fixed GitHub repository, non-`latest` tag, exact
   `.tgz` asset name/URL/bytes/SHA-256/SRI, and package-manifest digest.
3. `git-commit`: credential-free GitHub repository, full 40-hex commit, tree,
   repository-root manifest digest, and canonical `git+https` spec ending in
   that commit. A source with runtime dependencies or any standard lifecycle
   hook also binds an exact lockfile path/digest. A lockless source is admitted
   only when the exact manifest has no runtime or peer dependency graph and no
   standard lifecycle hook, so the already-built package needs no source build.
   Short commits, branch names, and subfolders fail closed.

Before local preparation, the fixed fetcher validates the source coordinate,
uses `redirect: manual`, admits only its hard-coded HTTPS origin set, streams
under a strict size cap, verifies every authority digest and identity, and
writes a sanitized receipt without executing the candidate:

```bash
node <skill-dir>/scripts/fetch-plugin-source.mjs \
  --id <#3NNN> \
  --output <new-absolute-private-fetch-directory>
```

During installation, the installer first resolves with `--ignore-scripts
--lockfile-only`, then binds policy to the exact depPath emitted by pnpm 11.7.
A selected package receives an explicit `allowBuilds: false` rule for that
exact peer-normalized depPath. An existing positive rule for the same exact
depPath fails closed instead of silently widening that item.
Every newly created negative rule carries the stable
`dsh-plugin-installer-owned-v1` YAML value comment. This marker is cleanup
provenance, never build permission: removal prunes only marked `false` keys
that no longer correspond to any current lockfile package or peer-normalized
snapshot key. Pre-existing unmarked denials and every `true` value remain
untouched; forging the comment cannot grant execution because
`strictDepBuilds: true` remains mandatory.

All three verify package identity, bundle patch, and the complete standard npm
lifecycle-hook map and digest. An undeclared `prepare`, `install`, `postinstall`,
or any other standard lifecycle hook fails preparation. Any package that still
requires a live lifecycle build is rejected before consent; it must instead be
prebuilt in an isolated review workflow, repackaged as a digest-bound
script-free artifact when rights allow, or replaced. Every newly resolved
transitive depPath is explicitly denied build permission.

```bash
node <skill-dir>/scripts/prepare-plugin.mjs \
  --id <#3NNN> \
  --checkout <absolute-clean-upstream-checkout> \
  --output <new-absolute-private-prepared-directory>
```

For an exact npm version, replace `--checkout` with `--artifact
<absolute-downloaded-tgz> --resolution <absolute-raw-registry-metadata.json>`.
For a GitHub Release asset, use only `--artifact
<absolute-downloaded-release-tgz>`.

Do not run any fetch or preparation command until the authority is promoted
and the user has consented to the download or checkout. Reject automatic or
unallowlisted redirects, mutable refs, version ranges, shortened commits, URL
credentials, authority query strings, shell fragments, archive links, or
traversal paths.

## Plan and consent

Place each prepared directory at `<prepared-root>/<numeric-id>`. Generate a
non-mutating plan for one or more exact IDs:

```bash
node <skill-dir>/scripts/install-transaction.mjs plan \
  --id <#3NNN> \
  --prepared-root <absolute-private-prepared-root>
```

The `--top10` form reads IDs only from the independently hashed release set;
it is unavailable while that set remains unfrozen:

```bash
node <skill-dir>/scripts/install-transaction.mjs plan \
  --top10 \
  --prepared-root <absolute-private-prepared-root>
```

Show the complete plan before asking for consent: ordered public IDs, exact
packages and sources, every lifecycle hook and script, permission/network/process/file
disclosures, license/redistribution terms, the closed authority-bound runtime
acceptance records, cold restart, rollback target, and the creation/use of the
private non-exportable local recovery-authentication key.
The plan command first validates every prepared member and reports one
all-member preflight result. Consent happens once after that preflight, must be
immediate and explicit, and is bound to the printed plan SHA-256. Changing any
member or field requires a new preflight, plan, and consent.

## Execute one atomic transaction

Only after consent, execute with the same IDs and plan digest. Use a new
private transaction directory outside `DSH_HOME`, source, and prepared trees:

```bash
node <skill-dir>/scripts/install-transaction.mjs execute \
  --id <#3NNN> \
  --dsh-home <absolute-DSH_HOME> \
  --harness-source <absolute-alpha2-source> \
  --harness-receipt <absolute-private-build-receipt.json> \
  --prepared-root <absolute-private-prepared-root> \
  --transaction-root <new-absolute-private-transaction-directory> \
  --consent-sha256 <exact-plan-sha256>
```

Replace `--id` with `--top10` only for the fixed Top10 set. The script:

1. revalidates Harness, item, prepared, safety, rights, receipt, and plan
   authority before mutation, resolves IDs internally, and re-hashes the built
   CLI against its receipt;
2. acquires the exclusive `DSH_HOME` transaction lock, then snapshots the four
   exact Web Profile files and the governed `DSH_HOME`
   state (`settings.yaml`, root `cordis.patch.yml`, `.credentials.yaml`, and
   `.anonymous-user-id`, recording optional absence), plus the prior
   dependency closure and Plugin inventory, to a private directory; snapshot
   schema v3 preserves and verifies POSIX permission bits, while Windows
   restores the current-user SID-only ACL boundary;
3. invokes the private `pnpm.cjs` through the already-certified absolute Node
   with a fixed argument array, `shell: false`, `--` option termination, and
   only `--ignore-scripts --lockfile-only` resolution, then strictly parses the
   bounded lockfile and derives each
   direct package's exact source-like depPath plus the complete newly added
   package-key closure; this direct phase avoids alpha.2's Windows
   `dsh plugin` cmd forwarding, which cannot preserve an artifact path with
   spaces as one literal argument;
4. rejects `dangerouslyAllowAllBuilds: true`, fixes the project policy at
   `dangerouslyAllowAllBuilds: false` and `strictDepBuilds: true`, writes
   `false` for every newly resolved peer-normalized depPath, never writes a new
   positive lifecycle permission, and verifies those effective values through
   the same privately bound pnpm and frozen minimal child environment;
5. materializes the already-resolved batch once with `--frozen-lockfile
   --ignore-scripts --ignore-pnpmfile`, requires the lockfile bytes to remain
   identical, then verifies every exact package identity and bundle activation;
6. runs the fixed `--profile web --dump-config` command, parses its output as a
   bounded strict YAML entry list in memory, and requires exactly one
   authority-bound `{ id, name }` entry for every selected item;
7. requires the exact post-install Plugin inventory, starts the real
   `web --no-open` process with all output discarded, requires the bare
   loopback root to return BrowserAuth 401 while that process remains alive,
   terminates it, then rechecks inventory and installed package identity; and
8. writes `state.json` with `status: "committed"` only after all of those
   checks pass. On the first failure, it restores the snapshot and frozen
   prior closure, then
   requires exact files, actual package versions, ordered bundles, inventory,
   a fresh credential-free Profile probe, and a real `web --no-open` cold
   start whose token-bearing output is discarded and whose bare root returns
   BrowserAuth 401 before calling rollback complete. The rollback boundary
   begins as soon as the eight-file snapshot succeeds: if closure capture,
   the initial inventory probe, evidence writes, or recovery-key loading fails
   before a complete baseline exists, all eight governed file states are still
   restored and verified. Once closure plus inventory are captured, every
   later failure requires the complete file/closure/inventory/cold-start
   rollback before the lock can be released.

The fixed executor, not an authority-provided command, performs these probes.
It never stores raw `dump-config` output and never captures Web startup output.
An absent, malformed, duplicated, or mismatched item probe fails closed before
commit. A failed single item or Top10 member restores the entire retained
snapshot and frozen closure; no partial batch is a successful outcome.

## Remove and recover

Removal is a separate consented transaction. It resolves the same exact
authority items, verifies that each exact package version is currently active,
and prints a removal plan before mutation:

```bash
node <skill-dir>/scripts/install-transaction.mjs remove-plan \
  --id <#3NNN>
```

After immediate explicit consent to that exact plan digest, run:

```bash
node <skill-dir>/scripts/install-transaction.mjs remove \
  --id <#3NNN> \
  --dsh-home <absolute-DSH_HOME> \
  --harness-source <absolute-alpha2-source> \
  --harness-receipt <absolute-private-build-receipt.json> \
  --transaction-root <new-absolute-private-removal-directory> \
  --consent-sha256 <exact-removal-plan-sha256>
```

Use `--top10` instead of `--id` only for the frozen Top10 set. The executor
snapshots the complete pre-remove Profile and closure, removes packages in
reverse plan order through fixed `remove <package> --lockfile-only` source-built
CLI argument arrays, then performs one
`install --frozen-lockfile --ignore-scripts --ignore-pnpmfile` materialization
and requires the lockfile bytes to remain identical. It verifies package
absence plus the exact remaining inventory before and after a real cold Web
start, and writes `status: "removed"` only after all checks pass. Any
failure restores the whole pre-remove snapshot; partial removal is never a
successful state.

Every committed install or removal transaction retains a digest-bound private
snapshot and baseline. To restore that exact pre-transaction state, first
inspect the recovery plan:

```bash
node <skill-dir>/scripts/install-transaction.mjs recover-plan \
  --source-transaction-root <absolute-private-install-or-removal-directory> \
  --dsh-home <absolute-DSH_HOME>
```

After immediate explicit consent to the recovery plan digest, restore it into
a new recovery transaction:

```bash
node <skill-dir>/scripts/install-transaction.mjs recover \
  --source-transaction-root <absolute-private-install-or-removal-directory> \
  --dsh-home <absolute-DSH_HOME> \
  --harness-source <absolute-alpha2-source> \
  --harness-receipt <absolute-private-build-receipt.json> \
  --transaction-root <new-absolute-private-recovery-directory> \
  --consent-sha256 <exact-recovery-plan-sha256>
```

Recovery accepts no Plugin selector, prepared artifact, injected runner, or
caller-provided snapshot. It validates the source plan, state, baseline and
snapshot bindings, reconstructs the exact source plan from current Plugin
authority, and authenticates the retained transaction with a private 32-byte
HMAC trust key held under the same explicit `DSH_HOME`. Every transaction uses
a fresh private 32-byte nonce stored only in its protected recovery-auth file;
domain-separated HMAC bindings cover the rollback baseline and private
snapshot manifest, plus the terminal closure and inventory used for drift
checks. Ordinary SHA-256 of the secret-bearing manifest or potentially private
dependency closure is never copied into state, a recovery plan, or CLI output,
and the opaque bindings are also omitted from CLI output. A separate random
public transaction ID, independent of Profile bytes, binds recovery consent to
one exact retained transaction without becoming a secret fingerprint. The
installer creates that key with private permissions during the first consented
install or remove transaction, never prints it, and never stores it inside a
transaction directory. A self-hashed or copied directory without the local
trust binding is not recoverable. Recovery also requires the current Profile closure and
inventory to match the authenticated terminal state of that source
transaction; later Profile drift must be handled explicitly and is never
silently overwritten. While holding the exclusive `DSH_HOME` lock, the
executor also recomputes a private HMAC over the existence, POSIX mode, and
exact bytes of all eight governed Profile/`DSH_HOME` files; settings or
credential drift blocks recovery before a recovery snapshot or mutation.
Private transaction JSON is opened without following symlinks and is
validated and read through the same private, single-link file handle. The
executor snapshots the current Profile before restoring. When it captures a
complete valid current dependency-closure snapshot and inventory, a recovery
failure atomically restores and verifies that complete pre-recovery state. An
interrupted source can instead make valid closure capture impossible. If
frozen dependency restoration has begun in that exceptional path and a later
step fails, the executor restores and verifies only the eight governed file
states, deliberately retains the takeover lock, and requires manual inspection
of the dependency closure. It must not report a complete rollback or reopen
ordinary transactions. Only a successful frozen install plus exact
closure/inventory/cold-start verification may write `status: "recovered"`.

Before the first Profile mutation, install and removal also persist one
private `in-progress.json` rollback journal authenticated by the same local
HMAC key and transaction nonce. Its authentication binds the public
transaction ID, exact plan, rollback baseline, snapshot manifest, and exact
original lock holder. It is usable only when `state.json` does not exist, that
exact holder is stale, the fixed lock takeover succeeds, and the user grants
new explicit consent to the interrupted-recovery plan digest. A terminal
`committed` or `removed` `state.json` is the durable marker: terminal recovery
never opens or replays the earlier journal, and successful finalization removes
it. A missing, active, replaced, concurrently claimed, or mismatched holder
fails closed.

## Prepare authorization and privacy

A fixed upstream lifecycle script is executable code. Every standard hook,
including `prepare`, `install`, and `postinstall`, must be enumerated with its
exact text in authority, but the v0.8.0 transaction does not execute or
authorize any live lifecycle build. Such a candidate is rejected before
consent until an isolated review produces an authority-bound script-free
artifact, or the candidate is replaced. The installer first resolves with
scripts disabled and lockfile-only, then writes every newly added
peer-normalized pnpm depPath—not a bare package name—as `false`; a strict YAML
AST rejects aliases, merge keys, duplicates, custom tags, non-boolean values,
an existing explicit denial, and any unsafe global build-policy switch. Missing
safe booleans are written explicitly; existing unsafe values are never silently
overridden. The installer then queries the effective project policy through a
fixed `pnpm config get --location project --json` argument array and fails if
environment or user configuration changes the safe values. Removal can delete
an exact historical depPath authorization and, after frozen materialization,
atomically prune stale installer-marked `false` entries absent from the
current lockfile graph. A legacy broad package-name `true` without installer
provenance fails closed and requires explicit migration; user-authored
denials, reachable marked denials, and all `true` entries remain untouched. The
authorization helper has no
standalone mutating CLI and accepts no implicit process environment; only the
consent-bound transaction may provide its frozen environment. The installer
never executes authority script text itself and never grants a transitive
depPath build permission implicitly.

Profile snapshots, prepared artifacts, build receipts, and transaction state
are private local recovery material. Do not publish them. A private snapshot
may necessarily contain the exact pre-transaction settings and credential
bytes; the installer never returns, prints, or copies those bytes or their
per-file digests into a receipt. Never capture Harness Web startup output,
browser tokens, cookies, authorization headers, credentials, or hashes derived
from those secrets in logs, screenshots, public evidence, or receipts. Child
process output is streamed to the live terminal and is not inserted into
transaction receipts.
The local recovery HMAC key and per-transaction nonce are also private recovery
material: do not copy, publish, print, hash into a public receipt, or place the
key inside a transaction. The nonce lives only in the protected authentication
record and is never included in plans, terminal state, or CLI output.
Losing that key makes retained transactions unrecoverable; preserve it in protected backup.
