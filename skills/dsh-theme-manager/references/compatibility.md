# Verified compatibility baseline

Treat every value below as exact. The current installation contract is RC.8/V3 plus the final runtime attestation; version strings alone are never authority.

## Release lanes

| Lane | Exact release | Status |
| --- | --- | --- |
| Current upstream and certified | `0.1.0-rc.8`, npm `next`, tag `dsh-v0.1.0-rc.8`, source `141eb6fef83422698aef7a981029e843e8161534` | Manager-installable only through the exact V3 sidecar and final runtime attestation |
| Historical V2 | `0.1.0-rc.6` | Audit-only under normal validation; never current-installable. Only exact retained tuples can cross the schema-2 rollback/reverse gate. |
| Historical V1 | `0.1.0-rc.5`, source `47f943859bef60e4160492346772ded9b24f765a` | Audit-only under normal validation; never current-installable. Only exact retained tuples can cross the schema-2 rollback/reverse gate. |

The final publisher-side sidecar is `themes/compatibility/dsh-0.1.0-rc.8.json`. This public Skill does not rely on a relative link into the private publisher repository: it freezes and validates the corresponding fields through its local attestation and scripts. The sidecar has no blockers and binds publisher GitHub Actions run `32393288849`, head `e3fe9ac465b8db8070efbdb83ddc6c821f923a73`, across Linux, macOS, and Windows on Node `22.19.0` and `24.15.0`. The private run URL is intentionally not presented as a public proof link; the checked-in attestation carries the durable evidence. The earlier `.candidate.json` and candidate attestation remain historical evidence, not alternate authority.

The official Git tag maps RC.8 to public source. npm provenance is separately and narrowly recorded as `registry-digest-only`: integrity, shasum, tarball SHA-256, and registry URL do not prove a byte-for-byte build from the official commit.

## Catalog authorization

An exact compatibility match is necessary but not sufficient. A current release record must also set `verified: true`, use a controlled same-origin download, and contain exactly:

```json
{
  "kind": "hosted-verified-artifact",
  "installability": "manager",
  "redistribution": "allowed",
  "previewPolicy": "hosted"
}
```

`external-showcase`, `external-runtime-verified`, community-installer records, incomplete rights, and unknown distribution values are not Manager-installable. The adjacent community installer has its own allowlist and may use the Manager launcher only for its exact Skin Center package.

The local hosted authority lives in [`scripts/hosted-artifact-authority.mjs`](../scripts/hosted-artifact-authority.mjs). `CURRENT_INSTALLABLE_HOSTED_ARTIFACTS` is generated from rebuilt `public/theme-packages/index.json` SHA-256 `316c4b9a4ffcc797223438f256cf5c9fd935e4ec8e96f9c17f55b0e254c60721` and binds 32 exact package-version-complete-digest tuples. The index exposes only the same numeric public `catalogId` used by cards, details, APIs, and Finder; historical `DSH-FS-*` receipt labels remain immutable evidence coordinates and cannot authorize installation. The declared-order JSON entry array hashes to `e3ed309a499b162041bff48e89f522b04866f612c504614fe80f5f56f2226e5c`:

- `1.0.0`: `arcana-nocturne`, `argentina-matchday`, `bamboo-quietude`, `banff-alpine`, `eiffel-lumiere`, `england-matchday`, `fire-horse-chronicle`, `frontier-ink`, `germany-matchday`, `harbour-pulse`, `jianghu-ink`, `liberty-ink`, `sakura-kawaii`, `savanna-horizon`, `spain-matchday`, `st-basils-avant`, `suomenlinna-nordic`, `swanstone-modern`, `yellowstone-wpa`
- `1.1.0`: `abyssal-maid`, `reasoning-tide`
- `1.2.0`: `arctic-panel`, `copper-wire`, `deep-ocean`, `graphite-relay`, `high-signal`, `jade-circuit`, `neon-afterline`, `paper-console`, `quiet-matrix`, `redline-02`, `solar-trace`

The live catalog may discover more slugs, but it cannot change this executable set. Fresh install, normal target validation, and the normal plugin-add path accept only those 32 hosted tuples. The Skin Center digest is a separate adjacent-installer exception and is not a hosted theme.

`LEGACY_ROLLBACK_HOSTED_ARTIFACTS` contains 24 retained predecessors. Their complete `.tgz` hashes were recomputed from the retained artifacts and cross-checked against the retained sidecars plus the most recent matching historical indexes; the declared-order JSON entry array hashes to `f55deceee4f59a2512c155ba3d707e6564dcd7171806cc9426269601c75ec8ce`:

- V1 / RC.5: `deep-ocean`, `graphite-relay`, `high-signal`, `jade-circuit`, `paper-console`, and `solar-trace` at `1.0.0` (6 tuples).
- V2 / RC.6: the same six token themes at `1.1.0`; `abyssal-maid`, `copper-wire`, `reasoning-tide`, and `redline-02` at `1.0.0`; plus `arctic-panel`, `neon-afterline`, and `quiet-matrix` at `1.0.0` (13 tuples).
- V3 / RC.8: `arctic-panel`, `copper-wire`, `neon-afterline`, `quiet-matrix`, and `redline-02` at `1.1.0` (5 tuples).

Normal validation continues to identify V1 and V2 as historical and non-current. All 24 retained predecessors are rejected by fresh install and normal catalog validation. Their bytes may reach the current RC.8 runner only when an executable schema-2 record selects the exact `previous` entry and a separately retained release record matches its schema, package, version, URL, compatibility object, complete digest, and payload digest. This narrow recovery exception does not promote V1/V2 to current compatibility and does not authorize any other historical artifact.

The `full-skins-2026-08` release-set records 26 Full Skins, all with runtime previews and `certified-rc8` package-level state. FS-005 through FS-024 completed the original 20/20 isolated managed cold-restart `certify-final` matrix, with zero failed targets and 106 screenshots. Plan SHA-256 `0205c8d237834913751aec451411e90f06c3eed5b0437ce321a67dd44df3d06d` binds the pre-promotion identities; compact promotion receipt SHA-256 `b8af1bf145dae15ae3575ad2a7b19b691e802dd58cdc247332fd944262b79198` binds the passing result; deterministic evidence archive SHA-256 `f572fff1a944f3313e2b95a6702d549ae790bc36264b9dd3b20e34e010ec8276` is covered by `SHA256SUMS` SHA-256 `20a8f8dc746b92c9c9b72ac01a7aa1726a3b22f779da50acc3ba5c99d5f7842d`; and the frozen 20-target identity SHA-256 is `f0f427dc48670b70a72cb2dd4d556eb2278dcb24244ceb5d16f5c443600cbe59`. Four subsequently refreshed packages (`liberty-ink`, `germany-matchday`, `england-matchday`, and `neon-afterline`) then passed a 4/4 focused `verify-promoted` sample against their exact current complete-package digests. That non-promotional sample is bound by plan SHA-256 `6ba9ded86fce882f764f4595dc74071f6c48f4534a9d12f8d6ed9071237023ef`, receipt SHA-256 `54697e730554d2282970c4a9bcea29a34980dc2d30fc378efaf1be994da64858`, evidence archive SHA-256 `e440159b2f90e21fd0b62c9561cb8f617fbbbf6575515d3508499fa37892dc75`, and `SHA256SUMS` SHA-256 `99e08006deaf9a060f86985bea34ab67d5d260bddc996743a5640db817b4d979`. FS-003, FS-004, FS-025, and the then-current FS-026 bytes independently passed a targeted 4/4 `certify-final` matrix. That result is bound by plan SHA-256 `251e9e05e90b61fab35b8f05b44c2da3caa0ae8cca7591fcff9d84a15d34b1b0`, receipt SHA-256 `4f887b47c49f1ad44e0ff0163a142f05a52ebb5e3fdfa666ddda7a942600676f`, archive SHA-256 `e495eb5774a0419c97f51eac46d7b359c5ddc9c181ee659abbb86c7017e40a10`, `SHA256SUMS` SHA-256 `52ae724412e53424a584279482b3fc95d847f29f873e8a1789226fb9bbd07`, frozen identity SHA-256 `945c9ed2dc2cc65bc99fb37eb9107361865824619160d1df41d685aeb75a5dc8`, and after-plan SHA-256 `39c9957aec584e025926f63a3a93ae132cf855a5216920ad8e0862afaa69ac58`. This remains exact evidence for current FS-003 (`redline-02`), FS-004 (`copper-wire`), and FS-025 (`bamboo-quietude`), but its Fire Horse bytes were superseded and must not be used as proof for current FS-026.

The final `fire-horse-chronicle@1.0.0` tarball SHA-256 is `6eccabbdc98e00ad92144cbaee608159412e7c8e19d8c4272c8fe76194228455`. It passed a pre-index 1/1 isolated sample bound by plan SHA-256 `467bb93a459c910c4f360946da7a148517fe836433baed4d4b75a0e7b3632a22`, receipt SHA-256 `9cc311e0b151c2653abcbce4afd38beb19ca59b074572862849ab418d0fffd91`, archive SHA-256 `345dd0d748f1b012fe08f30cf70ccec63aac19b3ddb9bee5597639e8dec43bd7`, `SHA256SUMS` SHA-256 `011a041c40dfa560b17a2ce9ba98704e4624e5c700fa2c1f87201fcb62b513d1`, and frozen identity SHA-256 `5d030337ee82a69bdcb16455e6361f7ca1cbf392c09d16832bcb9d6c22cbcece`. That pre-index evidence generated the 32-entry authority. The identical tarball then passed a frozen post-index 1/1 verification against the prior final index, bound by receipt SHA-256 `5da6c5839edd3dd1f25238555f983429fb0fd6a4fe00720a894d94f01f6635ea`, plan-metadata SHA-256 `4dd4fc6da4f1eaa6f2314380d6741b763de90a12b33d8413cdb0173dc147ca19`, archive SHA-256 `b1d9c770fdecb1f117f8ba3859285b8021129d575c61a2075a36c7bc7283c733`, `SHA256SUMS` SHA-256 `3f252b716691b1a0af0e451dd95a181a7010c7bb48a4055088d1e3c1f3fabea7`, and the same frozen identity SHA-256 `5d030337ee82a69bdcb16455e6361f7ca1cbf392c09d16832bcb9d6c22cbcece`. A later site rebuild produced raw index SHA-256 `f706364d3f44fb0667147155c8400fe456da482fb908625e4d4c2c301022bbe6` without changing any of the 32 authorized package-version-complete-digest tuples; that exact hash remains in the immutable lifecycle-smoke archive. The current public-ID projection and numeric live release set produce index SHA-256 `316c4b9a4ffcc797223438f256cf5c9fd935e4ec8e96f9c17f55b0e254c60721`, again without changing any authorized tuple. The post-index evidence is documentation-only and is deliberately excluded from index construction; do not feed it back into the index. This two-layer boundary keeps the final authority non-recursive. The 32-entry digest authority identifies the exact published bytes the Manager can accept, while runtime state remains independently represented. Package-level evidence cannot alter or replace the immutable RC.8 Manager attestation.

## RC.8 V3 compatibility

| Field | Exact value |
| --- | --- |
| DSH | `@deepseek-ai/dsh@0.1.0-rc.8` |
| DSH npm integrity | `sha512-VQU5NlomrKLRgcXuOf+sxWFvqxPA8q9vMhrKPlPPXiOJEhGlGlAdiyxZvZxkCVI+v0zbhe21cY3/luLyxpSzzA==` |
| Official tag/source | `dsh-v0.1.0-rc.8` / `141eb6fef83422698aef7a981029e843e8161534` |
| ui-theme | `@deepseek-ai/dsh-client-ui-theme@0.1.0-rc.8` |
| ui-theme client bundle SHA-256 | `86f6ae4775ca2f4af29b7abaf200a18833b6675aa8446942f819342829eba6a5` |
| Web frontend | `@deepseek-ai/dsh-web-frontend@0.1.0-rc.8` |
| Web `index.html` SHA-256 | `1af3332985a498e11b8a4b34e29304c59beedf0838eea3b3d61b676f0288c7f0` |
| 86-file Web asset-set SHA-256 | `b225f316eacc754b41ffdc1402f4de92c742cf5d9b7e460923092aad65800f06` |
| 13-token catalog SHA-256 | `fe38fdb18dae76f3cc93e3ca3a37bb1916f207180781b1aa8321ee2ddadcb926` |
| Published-artifact selector allowlist SHA-256 | `663aa5927591ac99076f924ee9cd6f9bd09e6a8a9ee1e6b8b1b0d9e3093df807` |
| Final runtime attestation SHA-256 | `1cd9a0b4a6b9d215f0a1f70a97b4d43eae7bf4f846ae7009b7ddb812823ca0ae` |

The selector digest uses `declared-order-selector-lf` over the 13 selectors consumed by the published Full Skin artifact family:

```text
html
body
body[data-ds-dark-theme]
#root
[data-slot='root'] > div
[data-slot='conversation'] > div
body[data-ds-dark-theme] [data-slot='conversation'] > div
[data-slot='sidebar'] > div
body[data-ds-dark-theme] [data-slot='sidebar'] > div
[data-composer-card='true']
[data-slot='details']
body[data-ds-dark-theme] [data-composer-card='true']
body[data-ds-dark-theme] [data-slot='details']
```

This is an artifact dependency allowlist, not a claim to enumerate every RC.8 product state.

## Verified runner

| Field | Exact value |
| --- | --- |
| Runtime directory | `runtime-rc8/` |
| Attestation schema/status | `2` / `verified` |
| Attestation SHA-256 | `1cd9a0b4a6b9d215f0a1f70a97b4d43eae7bf4f846ae7009b7ddb812823ca0ae` |
| Lockfile SHA-256 | `b38b68f1f443b7065f530d665ea7acbc9327275503ba0d9a6edd030b81f915ec` |
| Production closure | `504` packages / `58c78fcf15d2b6c58bad0fc870a4d28dabda33bfae3633cf94794465564a939b` |
| DSH closure | `187` packages / `aa3929a9418b928d9ef200964f8ae4cce54086b1d5bc474cb9b42af90f0a78d8` |
| Package manager | `pnpm@11.7.0` |
| Certification run/head | `32393288849` / `e3fe9ac465b8db8070efbdb83ddc6c821f923a73` |
| Lifecycle | `managed-cold-restart` |

Bootstrap from the Skill directory without lifecycle scripts:

```sh
(
  cd "<skill-dir>/runtime-rc8" &&
  corepack pnpm install --frozen-lockfile --ignore-scripts
)
node "<skill-dir>/scripts/verify-runner.mjs"
```

All operations use `node "<skill-dir>/scripts/run-dsh.mjs" ...`. The launcher resolves the attested Node entry, disables telemetry, forces loopback, and launches Web with exactly one `--no-open`. Normal plugin add accepts only the 32 current hosted artifact digests or exact Skin Center 0.2.5. The runner's internal digest union also contains the 24 retained predecessors, but membership in that union is not sufficient authority: a retained digest is exposed only by the exact rollback command grammar, a verified schema-2 rollback/reverse record, and a matching retained release record. The launcher copies accepted opened bytes into a private `wx` no-overwrite workspace snapshot at `.dsh-themes/verified-artifacts/<sha256>.tgz` and gives DSH only that durable 0600 file. The snapshot closes the caller-path swap window and remains present for pnpm's `file:` locator and rollback; the 0700 parent directories and digest-named no-overwrite file also reduce accidental replacement, though a process already running as the same OS user remains inside the local trust boundary. The launcher rejects caller-supplied open/host flags, `0.0.0.0`, LAN hosts, `--patch`, and `--trusted-host`.

RC.8 live unload/HMR is not part of the contract. Install, switch, remove, rollback, and acceptance all require a managed cold restart. The official five-style disposer remains cleanup fixture evidence only.

## Rollback authority

Only rollback-record schema 2 is executable. It binds `dshPackageVersion: "0.1.0-rc.8"` and the final Manager attestation SHA-256. `validate-record` re-hashes each referenced `.tgz`, requires exactly one supported embedded manifest, checks schema-specific compatibility plus package, version, complete digest, and payload digest against current or rollback-only authority, derives rollback/reverse direction, and re-checks the final Manager attestation. Rollback-record schema 1 may be inspected for history but cannot be validated or reversed.

Before rollback, re-run `validate-release.mjs` for every package that will be installed. Current artifacts use default authority. A retained predecessor requires `--authority legacy-rollback --rollback-record <absolute-record>` and must exactly equal the record's selected `previous`; it reports `installableCurrent: false`, `rollbackEligible: true`, and its original schema status in `historicalStatus`. The record-bound `run-dsh.mjs ... add` form then independently validates the record, release record, local bytes, package, version, complete digest, and payload digest before snapshotting. A rollback record is not a substitute for release authority. The launcher removes only `@dsh-themes/*` plus the exact adjacent-installer package `@linxin666/dsh-client-ui-skin-center`; arbitrary third-party package names remain rejected.

## Digest scopes and history

| Contract | Field | Scope | Installation authority |
| --- | --- | --- | --- |
| V3 sidecar/catalog | `artifact.sha256` / `artifactSha256` | Complete downloaded `.tgz` | Yes for a 32-entry current tuple; rollback only for an exact retained tuple |
| V3/V2 embedded or sidecar | `payload.sha256` | Canonical tar excluding the manifest | Never alone; must also match the record-bound rollback entry |
| V1 embedded or sidecar | `package.sha256` | Canonical payload excluding `theme.json` | Never alone; must also match the record-bound rollback entry |

The exact RC.6 attestation and lock remain under `runtime/` with SHA-256 values `2400606c5cb6534e09a65020e4ae12a0df4c1d08f15918d714bc5037c2ed99ba` and `22f995efe8338c2a3cd97bd731853d010363531145c35073adb2dca3773f6053`. They are historical evidence only and must never be mixed with `runtime-rc8/`.
