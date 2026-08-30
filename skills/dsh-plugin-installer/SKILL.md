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
   PATH because upstream currently spawns `pnpm` internally. Validate that
   actual executable and version; never run a separate Corepack command as a
   substitute, change PATH, install pnpm, or claim a different launcher proves
   the child process identity. Promotion from 0/80 also requires the six-task
   receipts to bind that resolved executable identity or a separately reviewed
   private PATH shim.
   Every pnpm/DSH/Web child receives one frozen minimal environment containing
   only `DSH_HOME`, `PATH`, required OS user/home/temp fields, and locale fields.
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
   under the explicit `DSH_HOME` with private POSIX permissions. Windows is
   intentionally promotion-blocked until a six-task-reviewed SID-only,
   no-inheritance ACL/key-storage implementation exists. Because a committed
   install without trustworthy remove/recover is not acceptable, the current
   executor fails before any Windows Profile mutation; do not reinterpret
   `mode: 0600/0700` as Windows ACL evidence.

## Two fixed distribution lanes

`hosted-plugin-verified` accepts only an authority-bound asset from the exact
`LvvUP/dsh-themes-skills` GitHub Release tag `v0.8.0`. Its asset name, URL,
byte count, SHA-256, SRI, safe tar structure, package name/version, manifest,
bundle patch, rights, receipts, authority-bound license and CycloneDX SBOM files, and
absence of lifecycle scripts match authority. Non-zero tar tails, unsafe
portable paths, dangerous modes, links, and special entries fail closed.

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
2. snapshots all four exact Web Profile files plus the prior dependency
   closure and Plugin inventory to a private directory;
3. rejects `dangerouslyAllowAllBuilds: true`, fixes the project policy at
   `dangerouslyAllowAllBuilds: false` and `strictDepBuilds: true`, adds only
   package keys whose complete reviewed lifecycle-hook set requires execution
   to `allowBuilds`, and verifies those effective values through the same
   PATH-resolved pnpm under the same frozen minimal child environment before
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
   BrowserAuth 401 before calling rollback complete.

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
snapshot digests, reconstructs the exact source plan from current Plugin
authority, and authenticates the retained transaction with a private 32-byte
HMAC trust key held under the same explicit `DSH_HOME`. The installer creates
that key with private permissions during the first consented install or remove
transaction, never prints it, and never stores it inside a transaction
directory. A self-hashed or copied directory without the local trust binding
is not recoverable. Recovery also requires the current Profile closure and
inventory to match the authenticated terminal state of that source
transaction; later Profile drift must be handled explicitly and is never
silently overwritten. The executor snapshots the current Profile before
restoring, performs a frozen install and exact
closure/inventory/cold-start verification, and writes `status: "recovered"`
only at the end. If recovery fails, it restores the complete pre-recovery
state instead of leaving a mixed Profile.

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
are private local recovery material. Do not publish them. Never capture
Harness Web startup output, browser tokens, cookies, authorization headers,
credentials, or hashes derived from those secrets. Child process output is
streamed to the live terminal and is not inserted into transaction receipts.
The local recovery HMAC key is also private recovery material: do not copy,
publish, print, hash into a public receipt, or place it inside a transaction.
Losing or replacing that key intentionally makes retained transactions
unrecoverable; preserve it only as part of a protected private `DSH_HOME`
backup.
