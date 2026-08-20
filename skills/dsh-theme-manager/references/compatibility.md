# Verified compatibility baseline

Treat every value below as exact. The current installation contract is RC.8/V3 plus the final runtime attestation; version strings alone are never authority.

## Release lanes

| Lane | Exact release | Status |
| --- | --- | --- |
| Current upstream and certified | `0.1.0-rc.8`, npm `next`, tag `dsh-v0.1.0-rc.8`, source `141eb6fef83422698aef7a981029e843e8161534` | Manager-installable only through the exact V3 sidecar and final runtime attestation |
| Historical V2 | `0.1.0-rc.6` | Recognized for audit only; never current-installable or rollback-executable |
| Historical V1 | `0.1.0-rc.5`, source `47f943859bef60e4160492346772ded9b24f765a` | Recognized for audit only |

The final sidecar is [`themes/compatibility/dsh-0.1.0-rc.8.json`](../../../../themes/compatibility/dsh-0.1.0-rc.8.json). It has no blockers and binds GitHub Actions run [`32393288849`](https://github.com/LvvUP/DSH-Themes/actions/runs/32393288849), head `e3fe9ac465b8db8070efbdb83ddc6c821f923a73`, across Linux, macOS, and Windows on Node `22.19.0` and `24.15.0`. The earlier `.candidate.json` and candidate attestation remain historical evidence, not alternate authority.

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

The selector digest uses `declared-order-selector-lf` over the selectors actually consumed by the 13 current artifacts:

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

All operations use `node "<skill-dir>/scripts/run-dsh.mjs" ...`. The launcher resolves the attested Node entry, disables telemetry, forces loopback, and launches Web with exactly one `--no-open`. Plugin add accepts only the 13 current hosted artifact digests or exact Skin Center 0.2.5, copies the opened bytes into a private `wx` no-overwrite workspace snapshot at `.dsh-themes/verified-artifacts/<sha256>.tgz`, and gives DSH only that durable 0600 file. The snapshot closes the caller-path swap window and remains present for pnpm's `file:` locator and rollback; the 0700 parent directories and digest-named no-overwrite file also reduce accidental replacement, though a process already running as the same OS user remains inside the local trust boundary. The launcher rejects caller-supplied open/host flags, `0.0.0.0`, LAN hosts, `--patch`, and `--trusted-host`.

RC.8 live unload/HMR is not part of the contract. Install, switch, remove, rollback, and acceptance all require a managed cold restart. The official five-style disposer remains cleanup fixture evidence only.

## Rollback authority

Only rollback schema 2 is executable. It binds `dshPackageVersion: "0.1.0-rc.8"` and the final attestation SHA-256. `validate-record` re-hashes each referenced `.tgz`, requires exactly one embedded current V3 manifest, and re-checks the final runtime attestation. Schema 1 may be inspected for history but cannot be validated or reversed.

Before rollback, re-run `validate-release.mjs` for every package that will be installed. A rollback record is not a substitute for current catalog authority. The launcher removes only `@dsh-themes/*` plus the exact adjacent-installer package `@linxin666/dsh-client-ui-skin-center`; arbitrary third-party package names remain rejected.

## Digest scopes and history

| Contract | Field | Scope | Installation authority |
| --- | --- | --- | --- |
| V3 sidecar/catalog | `artifact.sha256` / `artifactSha256` | Complete downloaded `.tgz` | Yes, only with all current authority fields |
| V3/V2 embedded or sidecar | `payload.sha256` | Canonical tar excluding the manifest | No |
| V1 embedded or sidecar | `package.sha256` | Canonical payload excluding `theme.json` | No |

The exact RC.6 attestation and lock remain under `runtime/` with SHA-256 values `2400606c5cb6534e09a65020e4ae12a0df4c1d08f15918d714bc5037c2ed99ba` and `22f995efe8338c2a3cd97bd731853d010363531145c35073adb2dca3773f6053`. They are historical evidence only and must never be mixed with `runtime-rc8/`.
