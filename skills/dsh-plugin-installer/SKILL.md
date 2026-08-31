---
name: dsh-plugin-installer
description: Inspect, prepare, install, remove, recover, and atomically roll back only item-level verified DSH Plugins under the pinned alpha.1 source-build authority. Use for exact public #3NNN Plugin requests, including the fixed Top10 batch, not Themes, Skins, or showcase-only repositories.
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
[references/alpha1-plugin-migration-map.md](references/alpha1-plugin-migration-map.md)
before proposing a hosted adaptation or accepting a newer upstream artifact.
The map is an implementation boundary only: it never grants install authority
or replaces the six-task runtime receipts.

For a license-permitted hosted derivative, require one closed
[`plugin-hosted-adaptation.schema.json`](references/plugin-hosted-adaptation.schema.json)
recipe and one closed
[`plugin-runtime-probe.schema.json`](references/plugin-runtime-probe.schema.json)
contract. `scripts/build-hosted-adaptation.mjs` accepts only the exact clean
source commit/tree, digest-bound reviewed replacement files, exact alpha.1
peer versions, the preserved upstream license, an Acorn-parsed JavaScript AST,
and a zero-computed-syntax policy: runtime JavaScript may contain no AST node
whose `computed` flag is true, including members, properties, methods, or class
fields. It also rejects Node built-ins, indirect dependency loading, and
React/DOM shapes outside the checked-in reviewed
allowlist, while flagging direct or statically foldable external CSS reference
syntax.
It strips every lifecycle script and uncontrolled dependency field, emits a
normalized tarball, CycloneDX SBOM, and modification notice, and never executes
candidate code.
This AST gate is defense in depth for digest-bound, manually reviewed
replacements; it is not a JavaScript sandbox and is not runtime certification.
Its receipt is always non-installable and runtime-uncertified; only the six
real runtime tasks can promote the resulting bytes.

The same isolated checkout is also inventoried by
`scripts/audit-candidate-risk.mjs`. Its closed
[receipt schema](references/plugin-static-risk-receipt.schema.json) records
only bounded signal IDs, counts, and safe file/line locations. It does not
record source snippets, lifecycle commands, credentials, environment values,
or candidate output. `scripts/aggregate-candidate-risk.mjs` requires one valid
receipt for every intake ID and emits a non-installable review queue under the
[summary schema](references/plugin-static-risk-summary.schema.json). A clean
or low-signal inventory is not compatibility, legal, distribution, runtime,
installation, or Top10 authority; every candidate still requires manual review
and the six-task runtime gate.

## Current result: inspect only

The website currently publishes 80 curated Plugin records, but
`references/plugin-authority.json` contains **zero verified installation
items**. Its independently hashed `references/top10-release-set.json` is
`candidate-pending` with `frozen: false`, no ranked entries or item-authority
digests, and zero completed matrix tasks. The alpha.1 Harness runtime receipt
set is also pending. Therefore:

- `verifiedInstallableCount` is 0;
- no single Plugin may be prepared or installed;
- no ten candidate IDs have been published as a fixed recommendation or
  installation set;
- Top10 is not frozen and cannot start a transaction;
- RC.8 Theme/Skin receipts and the RC.2 runtime baseline do not authorize any
  alpha.1 Plugin.

Do not create a temporary authority, infer a package from a repository, copy a
website command, or mark an item verified to satisfy a request. Explain the
pending evidence and stop before network access or Profile mutation.

Inspect the machine authority with:

```bash
node <skill-dir>/scripts/authority.mjs
```

The remaining workflow below becomes executable only after a reviewed
authority update includes real runtime receipts and flips the relevant gates.
Promotion requires exactly 80 unique item records and matching catalog,
required, verified, authority, and item counts; a partial set cannot open the
single-item lane. Top10 must be the exact ordered ten-ID subset of that set,
bind every item authority digest, record every six-dimension score and exact
total, pass all six platform/Node tasks, preserve
the fixed score weights `25/25/15/15/10/10`, cover at least eight use-case
categories, prove Web coexistence and the pairwise conflict matrix, pass
full-batch preflight and failure rollback, and only then set
`status: "verified-frozen"` and `frozen: true` with a matching payload digest.

## Prerequisites for a future verified item

1. `dsh-harness-installer` must have built the exact official
   `dsh-v0.1.2-alpha.1` source and issued a valid private local build receipt.
   The source build remains local and is not an official binary.
2. The bundled plugin authority must bind the promoted six-job Harness receipt
   set and exactly one item-level record for every selected public ID.
3. The user must provide an explicit absolute `DSH_HOME`; only
   `profiles/web` is in scope. Never infer or broaden it.
4. Exact pnpm `11.7.0` must already be the executable that alpha.1 resolves on
   its input PATH. The installer resolves that first command to one canonical
   absolute regular file, verifies its bytes and version directly, then creates
   a transaction-private first-PATH launcher. That launcher rechecks the target
   size and SHA-256 before every invocation. It does not install pnpm or modify
   the caller's persistent PATH. On Windows the child environment also sets
   `NoDefaultCurrentDirectoryInExePath`, so alpha.1's Profile working directory
   cannot shadow the protected first-PATH launcher. This matches the inspected
   alpha.1 `apps/cli/src/plugin.ts` behavior, including its Windows
   `shell: true` `.cmd` boundary. That boundary uses the verified absolute
   system `cmd.exe`, not an inherited `COMSPEC`, and does not use an unrelated
   Corepack probe. Promotion receipts must bind both target and
   private-launcher digests.
   Every pnpm/DSH/Web child receives one frozen minimal environment containing
   `DSH_HOME`, the private pnpm binding plus reviewed PATH, required OS
   user/home/temp fields, locale fields, and non-secret binding digests/paths.
   `NODE_OPTIONS`, npm/pnpm/Corepack configuration, CI flags, cloud credentials,
   tokens, and unrelated caller variables are never inherited. The preflight
   effective-policy check and the install/remove/recovery process must use that
   same environment object.
5. Finish or stop any running Harness process before package mutation. A
   package add/remove still requires a cold restart even though alpha.1 can
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
   repository-root manifest digest, exact lockfile path/digest, and canonical
   `git+https` spec ending in that commit. Short commits, branch names, and
   subfolders fail closed.

Before local preparation, the fixed fetcher validates the source coordinate,
uses `redirect: manual`, admits only its hard-coded HTTPS origin set, streams
under a strict size cap, verifies every authority digest and identity, and
writes a sanitized receipt without executing the candidate:

```bash
node <skill-dir>/scripts/fetch-plugin-source.mjs \
  --id <#3NNN> \
  --output <new-absolute-private-fetch-directory>
```

All three verify package identity, bundle patch, the complete standard npm
lifecycle-hook map and digest, and every declared hook included in the single
summarized lifecycle authorization. An undeclared `prepare`, `install`,
`postinstall`, or any other standard lifecycle hook fails. The plan shows the
exact hook names and script text before one aggregate consent. pnpm may still
run disclosed transitive-dependency lifecycle scripts; that residual risk is
also part of consent.

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
  --harness-source <absolute-alpha1-source> \
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
3. rejects `dangerouslyAllowAllBuilds: true`, fixes the project policy at
   `dangerouslyAllowAllBuilds: false` and `strictDepBuilds: true`, adds only
   package keys whose complete reviewed lifecycle-hook set requires execution
   to `allowBuilds`, and verifies those effective values through the same
   privately bound pnpm under the same frozen minimal child environment before
   package mutation;
4. invokes the absolute source-built CLI with a fixed argument array and
   `shell: false` under the frozen minimal child environment;
5. installs sequentially and verifies exact package identity and bundle
   activation after each item;
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
  --harness-source <absolute-alpha1-source> \
  --harness-receipt <absolute-private-build-receipt.json> \
  --transaction-root <new-absolute-private-removal-directory> \
  --consent-sha256 <exact-removal-plan-sha256>
```

Use `--top10` instead of `--id` only for the frozen Top10 set. The executor
snapshots the complete pre-remove Profile and closure, removes packages in
reverse plan order through the fixed source-built CLI argument array, verifies
their absence plus the exact remaining inventory before and after a real cold
Web start, and writes `status: "removed"` only after all checks pass. Any
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
  --harness-source <absolute-alpha1-source> \
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
exact text in authority and in the consented plan. The installer only writes
its exact package key under the Profile's `allowBuilds`; a strict YAML
AST rejects aliases, merge keys, duplicates, custom tags, non-boolean values,
an existing explicit denial, and any unsafe global build-policy switch. Missing
safe booleans are written explicitly; existing unsafe values are never silently
overridden. The installer then queries the effective project policy through a
fixed `pnpm config get --location project --json` argument array and fails if
environment or user configuration changes the safe values. Removal deletes
only the removed items' exact `allowBuilds: true` keys while preserving
explicit denials and unrelated entries. The authorization helper has no
standalone mutating CLI and accepts no implicit process environment; only the
consent-bound transaction may provide its frozen environment. The authority and plan also disclose that
pnpm may run lifecycle scripts from transitive dependencies. The installer
never executes authority script text itself.

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
Losing or replacing that key intentionally makes retained transactions
unrecoverable; preserve it only as part of a protected private `DSH_HOME`
backup.
