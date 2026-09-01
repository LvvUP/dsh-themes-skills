# Verified compatibility baseline

Treat every value below as exact. The current **item installation** contract is RC.8/V3 plus the final runtime attestation; version strings and runtime-baseline certification alone are never item authority.

## Release lanes

| Lane | Exact release | Status |
| --- | --- | --- |
| Operational Harness baseline | `0.1.2-alpha.2`, tag `dsh-v0.1.2-alpha.2`, source `0a53fb55bea101816fa226bb964ae2bed71c343b`, tree `64ccbfa8e0caa4711cd4a75717ef9e022657961b` | Official npm runtime promoted 6/6 with `publishedInstallable: true`; source cross-build remains independent and no item authority is implied |
| V4 candidate projection | Same exact `0.1.2-alpha.2` baseline | 54 exact candidate tuples, but the V4 set itself remains 0/6 runtime jobs with no promotion receipt; inspect-only and never Manager-installable |
| Historical certified runtime baseline | `0.1.1-rc.2`, tag `dsh-v0.1.1-rc.2`, source `b150a551b8d465e31e418e1b2eaf5e79bbb7d28e` | Six-job baseline and detached provenance verified; `productionReady: true`, but `installableItems: false` and item authority remains separate |
| Operational item authority | `0.1.0-rc.8`, tag `dsh-v0.1.0-rc.8`, source `141eb6fef83422698aef7a981029e843e8161534` | Manager-installable only through the exact V3 sidecar, final runtime attestation, and item artifact authority |
| Historical V2 | `0.1.0-rc.6` | Audit-only under normal validation; never current-installable. Only exact retained tuples can cross the schema-2 rollback/reverse gate. |
| Historical V1 | `0.1.0-rc.5`, source `47f943859bef60e4160492346772ded9b24f765a` | Audit-only under normal validation; never current-installable. Only exact retained tuples can cross the schema-2 rollback/reverse gate. |

The RC.2 baseline is bound to run `32694257969` attempt `1`, source SHA `cc7546cb5ccd77002713171328972291ceaa12e6`, final attestation SHA-256 `4c41e96827bb03eb7c4d6138f5723864e91f0324b1aec8bcf3b3a1bc47ba3fb7`, final receipt SHA-256 `4a649841766b4bf3421c78906f98f29a186d718ea34b03daca96ee52e9a3db98`, archive SHA-256 `0b4f03e9c3f76d241890f46330fce84f32183774a5d9228077835e2258c76f3e`, and detached Sigstore bundle SHA-256 `b520580f05101b4783079aa52f0e159b2aa1a9e239f7e6a68e469f4c5d084b2d`. Run `scripts/verify-promoted-rc2-provenance.mjs` to verify the checked-in closure. This evidence authorizes no selector, artifact, catalog result, authoring, submission, or community item.

The alpha.2/V4 candidate projection is pinned by `references/alpha2-v4-candidate-authority.json` at SHA-256 `1ce7c213460b8929c9adb0478684cf4608575d2e0a8832993609864cbe72727a`. It binds promoted Harness authority SHA-256 `100e24ea87e111a7abb13aab5d8c81e38585319c27ea09ce82e62dd4fcc80094` while keeping item authority separate. Its declared-order tuple set SHA-256 is `e5bc3aec7191f1f9958d35dd5a7caec5a0d01e628e7737bcfa5a72cddb0b06cf`, covering six Themes and 48 Full Skins. It binds source lock SHA-256 `6cc109a574218f51762474455c8d72e5f7c2625aedf25e85569dba1af7adcef0` separately from official npm tarball SHA-256 `5bf062a26a490853ffb9294fe3c9fb2047f029be3545612dea45718a81920a47`; neither is a binary-equivalence claim. The V4 contract requires baseline ID, provenance, `web` Profile, one-time BrowserAuth exchange, `entries+batches`, combo/revision/MIME/cache/compression/boot protocol, 12/14/17px, and its own pending 0/6 receipt with no credential-derived evidence. `scripts/alpha2-v4-candidate.mjs` accepts only `inspect` or exact-byte `validate-manifest`; it has no installation or promotion command.

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

The local hosted authority lives in [`scripts/hosted-artifact-authority.mjs`](../scripts/hosted-artifact-authority.mjs). `CURRENT_INSTALLABLE_HOSTED_ARTIFACTS` is generated from current RC.8-frozen executable index SHA-256 `7c3044a1df66179f6592cafe42001d3ef4b3fa178950b704b36c4f71d844e732` and binds 45 exact package-version-complete-digest tuples: six Themes and 39 Full Skins. The index exposes only the same numeric public `catalogId` used by cards, details, APIs, and Finder; historical `DSH-FS-*` receipt labels remain immutable evidence coordinates and cannot authorize installation. The declared-order JSON entry array hashes to `6806fb4dfa5e59524fd3e29b9c4c7b20e5ece8108b7efec2f4a42ed8f5e4c954`:

- `1.0.0`: `apex-telemetry`, `arcana-nocturne`, `argentina-matchday`, `bamboo-quietude`, `banff-alpine`, `borough-pinstripe`, `eiffel-lumiere`, `england-matchday`, `fire-horse-chronicle`, `fjord-matchday`, `frontier-ink`, `germany-matchday`, `harbor-brick-diamond`, `harbour-pulse`, `hexagon-matchday`, `jianghu-ink`, `lakeside-ivy-diamond`, `liberty-ink`, `metro-hardwood`, `neko-dream-parade`, `pacific-blue-diamond`, `sakura-kawaii`, `savanna-horizon`, `shiba-morning-post`, `silver-court`, `spain-matchday`, `st-basils-avant`, `sunset-court`, `suomenlinna-nordic`, `swanstone-modern`, `tropical-matchday`, `yellowstone-wpa`
- `1.1.0`: `abyssal-maid`, `reasoning-tide`
- `1.2.0`: `arctic-panel`, `copper-wire`, `deep-ocean`, `graphite-relay`, `high-signal`, `jade-circuit`, `neon-afterline`, `paper-console`, `quiet-matrix`, `redline-02`, `solar-trace`

The live catalog may discover more slugs, but it cannot change this executable set. Fresh install, normal target validation, and the normal plugin-add path accept only those 45 hosted tuples. The Skin Center digest is a separate adjacent-installer exception and is not a hosted theme.

### Promoted v0.7.0 cohort

The promoted cohort is the exact non-contiguous set `#2030–#2041 + #2043`; `#2042` is already issued to another record and is excluded. The 13 packages are `apex-telemetry`, `sunset-court`, `metro-hardwood`, `silver-court`, `hexagon-matchday`, `tropical-matchday`, `fjord-matchday`, `borough-pinstripe`, `harbor-brick-diamond`, `pacific-blue-diamond`, `lakeside-ivy-diamond`, `neko-dream-parade`, and `shiba-morning-post`, all at `1.0.0`. The historical final candidate index SHA-256 `f2701f3af25d90fb72c8c2a68592b1adb4294e8f3c9652f34db8ca487c6f4c63` remains only to verify the promotion chain; `PENDING_CANDIDATE_HOSTED_ARTIFACTS` is empty.

The exact bytes passed both required stages before atomic promotion. Capture-candidate bound 13 targets, 65 screenshots, and 1,010 evidence files with plan SHA-256 `f095f964d21357eabd9f9bcad310faa2ccc7292f0a75e9dd49b526140043a940`, receipt SHA-256 `907ed35fd089b292f41f3daa47297fd9a9ca591b7b12f469d4ab651f6919111d`, archive SHA-256 `cef82c0db7601b869fa53c3f034e9ad5d77978d89a553b6bc0a646c05f87d029`, `SHA256SUMS` SHA-256 `b4ece672e5561816d1cf409b9de2cc8c2cda8afce04bc09dc101672847202863`, and frozen identity SHA-256 `e1935797b5eff2804cea2012924815fc4aaa6fbed002ec97d0796d8a8d1e0cb9`. Rebuilt-byte certify-final bound the same 13 targets, 65 screenshots, and 1,010 evidence files with plan SHA-256 `65eef49f75d873989d27de04b206e17eec55a4a7b4b992261ef856fa1b39b3fc`, receipt SHA-256 `43bdf28f3947f558afe3273478b92502b015ead2be10278516b2624038d0795a`, archive SHA-256 `d47520f808ea576b3a24500541397db0364107d54b9c0aee62d0eb0d1a4f5590`, `SHA256SUMS` SHA-256 `f2e6a9e05a25139630926c0edca9521912a7ec52ec86ae0057c7e87d9504ce2a`, and frozen identity SHA-256 `48aa04ac73b5ead54ff7fb992b8c95aa3baa1302f860fca48cf76f7a631d7a2b`.

`LEGACY_ROLLBACK_HOSTED_ARTIFACTS` contains 24 retained predecessors. Their complete `.tgz` hashes were recomputed from the retained artifacts and cross-checked against the retained sidecars plus the most recent matching historical indexes; the declared-order JSON entry array hashes to `f55deceee4f59a2512c155ba3d707e6564dcd7171806cc9426269601c75ec8ce`:

- V1 / RC.5: `deep-ocean`, `graphite-relay`, `high-signal`, `jade-circuit`, `paper-console`, and `solar-trace` at `1.0.0` (6 tuples).
- V2 / RC.6: the same six token themes at `1.1.0`; `abyssal-maid`, `copper-wire`, `reasoning-tide`, and `redline-02` at `1.0.0`; plus `arctic-panel`, `neon-afterline`, and `quiet-matrix` at `1.0.0` (13 tuples).
- V3 / RC.8: `arctic-panel`, `copper-wire`, `neon-afterline`, `quiet-matrix`, and `redline-02` at `1.1.0` (5 tuples).

Normal validation continues to identify V1 and V2 as historical and non-current. All 24 retained predecessors are rejected by fresh install and normal catalog validation. Their bytes may reach the current RC.8 runner only when an executable schema-2 record selects the exact `previous` entry and a separately retained release record matches its schema, package, version, URL, compatibility object, complete digest, and payload digest. This narrow recovery exception does not promote V1/V2 to current compatibility and does not authorize any other historical artifact.

### Current 45-item package runtime evidence

The `full-skins-2026-08` release-set records 39 Full Skins, all with runtime previews and `certified-rc8` package-level state. The original 26 retain their exact historical evidence below; the 13-item v0.7.0 cohort is bound by the two-stage evidence above. FS-005 through FS-024 completed the original 20/20 isolated managed cold-restart `certify-final` matrix, with zero failed targets and 106 screenshots. Plan SHA-256 `0205c8d237834913751aec451411e90f06c3eed5b0437ce321a67dd44df3d06d` binds the pre-promotion identities; compact promotion receipt SHA-256 `b8af1bf145dae15ae3575ad2a7b19b691e802dd58cdc247332fd944262b79198` binds the passing result; deterministic evidence archive SHA-256 `f572fff1a944f3313e2b95a6702d549ae790bc36264b9dd3b20e34e010ec8276` is covered by `SHA256SUMS` SHA-256 `20a8f8dc746b92c9c9b72ac01a7aa1726a3b22f779da50acc3ba5c99d5f7842d`; and the frozen 20-target identity SHA-256 is `f0f427dc48670b70a72cb2dd4d556eb2278dcb24244ceb5d16f5c443600cbe59`. Four subsequently refreshed packages (`liberty-ink`, `germany-matchday`, `england-matchday`, and `neon-afterline`) then passed a 4/4 focused `verify-promoted` sample against their exact current complete-package digests. That non-promotional sample is bound by plan SHA-256 `6ba9ded86fce882f764f4595dc74071f6c48f4534a9d12f8d6ed9071237023ef`, receipt SHA-256 `54697e730554d2282970c4a9bcea29a34980dc2d30fc378efaf1be994da64858`, evidence archive SHA-256 `e440159b2f90e21fd0b62c9561cb8f617fbbbf6575515d3508499fa37892dc75`, and `SHA256SUMS` SHA-256 `99e08006deaf9a060f86985bea34ab67d5d260bddc996743a5640db817b4d979`. FS-003, FS-004, FS-025, and the then-current FS-026 bytes independently passed a targeted 4/4 `certify-final` matrix. That result is bound by plan SHA-256 `251e9e05e90b61fab35b8f05b44c2da3caa0ae8cca7591fcff9d84a15d34b1b0`, receipt SHA-256 `4f887b47c49f1ad44e0ff0163a142f05a52ebb5e3fdfa666ddda7a942600676f`, archive SHA-256 `e495eb5774a0419c97f51eac46d7b359c5ddc9c181ee659abbb86c7017e40a10`, `SHA256SUMS` SHA-256 `52ae724412e53424a584279482b3fc95d847f29f873e8a1789226fb9bbd07`, frozen identity SHA-256 `945c9ed2dc2cc65bc99fb37eb9107361865824619160d1df41d685aeb75a5dc8`, and after-plan SHA-256 `39c9957aec584e025926f63a3a93ae132cf855a5216920ad8e0862afaa69ac58`. This remains exact evidence for current FS-003 (`redline-02`), FS-004 (`copper-wire`), and FS-025 (`bamboo-quietude`), but its Fire Horse bytes were superseded and must not be used as proof for current FS-026.

The final `fire-horse-chronicle@1.0.0` tarball SHA-256 is `6eccabbdc98e00ad92144cbaee608159412e7c8e19d8c4272c8fe76194228455`. It passed a pre-index 1/1 isolated sample bound by plan SHA-256 `467bb93a459c910c4f360946da7a148517fe836433baed4d4b75a0e7b3632a22`, receipt SHA-256 `9cc311e0b151c2653abcbce4afd38beb19ca59b074572862849ab418d0fffd91`, archive SHA-256 `345dd0d748f1b012fe08f30cf70ccec63aac19b3ddb9bee5597639e8dec43bd7`, `SHA256SUMS` SHA-256 `011a041c40dfa560b17a2ce9ba98704e4624e5c700fa2c1f87201fcb62b513d1`, and frozen identity SHA-256 `5d030337ee82a69bdcb16455e6361f7ca1cbf392c09d16832bcb9d6c22cbcece`. That pre-index evidence generated the prior 32-entry authority. The identical tarball then passed a frozen post-index 1/1 verification against the prior final index, bound by receipt SHA-256 `5da6c5839edd3dd1f25238555f983429fb0fd6a4fe00720a894d94f01f6635ea`, plan-metadata SHA-256 `4dd4fc6da4f1eaa6f2314380d6741b763de90a12b33d8413cdb0173dc147ca19`, archive SHA-256 `b1d9c770fdecb1f117f8ba3859285b8021129d575c61a2075a36c7bc7283c733`, `SHA256SUMS` SHA-256 `3f252b716691b1a0af0e451dd95a181a7010c7bb48a4055088d1e3c1f3fabea7`, and the same frozen identity SHA-256 `5d030337ee82a69bdcb16455e6361f7ca1cbf392c09d16832bcb9d6c22cbcece`.

A later site rebuild produced raw index SHA-256 `f706364d3f44fb0667147155c8400fe456da482fb908625e4d4c2c301022bbe6` without changing any of the prior 32 package-version-complete-digest tuples; that exact hash remains in the immutable lifecycle-smoke archive. The first numeric public-ID projection produced prior executable index SHA-256 `316c4b9a4ffcc797223438f256cf5c9fd935e4ec8e96f9c17f55b0e254c60721`. After the 13-item two-stage matrix passed, atomic promotion produced executable index SHA-256 `a894ed95febe69910281f4c603dd7ef392d5a004f8c5fc3f2b25cc67fa08de15` and the 45-tuple set above. Freezing the RC.8 catalog input changed only its evidence path from `themes/full-skins/catalog.json` to `themes/full-skins/catalog.rc8.json`, yielding current index SHA-256 `7c3044a1df66179f6592cafe42001d3ef4b3fa178950b704b36c4f71d844e732`; the 45 package-version-complete-digest tuples and their declared-order hash did not change. Post-index evidence remains documentation-only and is deliberately excluded from index construction; do not feed it back into the index. Runtime state remains independently represented, and package-level evidence cannot alter or replace the immutable RC.8 Manager attestation.

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

All operations use `node "<skill-dir>/scripts/run-dsh.mjs" ...`. The launcher resolves the attested Node entry, disables telemetry, forces loopback, and launches Web with exactly one `--no-open`. Normal plugin add accepts only the 45 current hosted artifact digests or exact Skin Center 0.2.5; the pending candidate map is empty. The runner's internal digest union also contains the 24 retained predecessors, but membership in that union is not sufficient authority: a retained digest is exposed only by the exact rollback command grammar, a verified schema-2 rollback/reverse record, and a matching retained release record. The launcher copies accepted opened bytes into a private `wx` no-overwrite workspace snapshot at `.dsh-themes/verified-artifacts/<sha256>.tgz` and gives DSH only that durable 0600 file. The snapshot closes the caller-path swap window and remains present for pnpm's `file:` locator and rollback; the 0700 parent directories and digest-named no-overwrite file also reduce accidental replacement, though a process already running as the same OS user remains inside the local trust boundary. The launcher rejects caller-supplied open/host flags, `0.0.0.0`, LAN hosts, `--patch`, and `--trusted-host`.

RC.8 live unload/HMR is not part of the contract. Install, switch, remove, rollback, and acceptance all require a managed cold restart. The official five-style disposer remains cleanup fixture evidence only.

## Rollback authority

Only rollback-record schema 2 is executable. It binds `dshPackageVersion: "0.1.0-rc.8"` and the final Manager attestation SHA-256. `validate-record` re-hashes each referenced `.tgz`, requires exactly one supported embedded manifest, checks schema-specific compatibility plus package, version, complete digest, and payload digest against current or rollback-only authority, derives rollback/reverse direction, and re-checks the final Manager attestation. Rollback-record schema 1 may be inspected for history but cannot be validated or reversed.

Before rollback, re-run `validate-release.mjs` for every package that will be installed. Current artifacts use default authority. A retained predecessor requires `--authority legacy-rollback --rollback-record <absolute-record>` and must exactly equal the record's selected `previous`; it reports `installableCurrent: false`, `rollbackEligible: true`, and its original schema status in `historicalStatus`. The record-bound `run-dsh.mjs ... add` form then independently validates the record, release record, local bytes, package, version, complete digest, and payload digest before snapshotting. A rollback record is not a substitute for release authority. The launcher removes only `@dsh-themes/*` plus the exact adjacent-installer package `@linxin666/dsh-client-ui-skin-center`; arbitrary third-party package names remain rejected.

## Digest scopes and history

| Contract | Field | Scope | Installation authority |
| --- | --- | --- | --- |
| V3 sidecar/catalog | `artifact.sha256` / `artifactSha256` | Complete downloaded `.tgz` | Yes for a 45-entry current tuple; future pending candidates are never installable; rollback only for an exact retained tuple |
| V3/V2 embedded or sidecar | `payload.sha256` | Canonical tar excluding the manifest | Never alone; must also match the record-bound rollback entry |
| V1 embedded or sidecar | `package.sha256` | Canonical payload excluding `theme.json` | Never alone; must also match the record-bound rollback entry |

The exact RC.6 attestation and lock remain under `runtime/` with SHA-256 values `2400606c5cb6534e09a65020e4ae12a0df4c1d08f15918d714bc5037c2ed99ba` and `22f995efe8338c2a3cd97bd731853d010363531145c35073adb2dca3773f6053`. They are historical evidence only and must never be mixed with `runtime-rc8/`.
