# Verified compatibility baseline

Treat every value as exact. A missing source commit is intentional: the published npm metadata for this release does not expose a trustworthy `gitHead`, so never invent or reuse one.

## Release lanes

| Lane | Exact release | Status |
| --- | --- | --- |
| Upstream | `0.1.0-rc.8`, npm `next`, tag `dsh-v0.1.0-rc.8` at `141eb6fef83422698aef7a981029e843e8161534` | Released upstream; not certified or Manager-installable |
| Certified | `0.1.0-rc.6` | The only current DSH-Themes installation lane |
| Historical V1 | `0.1.0-rc.5` at `47f943859bef60e4160492346772ded9b24f765a` | Historical recognition only; never current |

The official rc.8 tag maps that release to public source; it does not upgrade the rc.6 package contract or prove npm tarball provenance. npm `latest` was still rc.7 when this status was captured on 2026-08-20. The repository's [`release-state.json`](../../../release-state.json) is the canonical informational summary, but Manager never reads it as a security authority. Validators, the frozen lockfile, and the runtime attestation below remain exact rc.6 evidence and must fail closed for rc.7/rc.8.

An exact compatibility match is necessary but not sufficient for installation. The release record must also set `verified: true` and contain this exact catalog authorization:

```json
{
  "kind": "hosted-verified-artifact",
  "installability": "manager",
  "redistribution": "allowed",
  "previewPolicy": "hosted"
}
```

Treat `external-showcase`, `showcase-only`, `link-only`, noncommercial, rights-clearance-required, missing, or unknown distribution values as non-installable. This remains true when external provenance legitimately omits NOTICE or sets `noticeUrl: null`; Manager must not inspect a LICENSE, source tree, or executable repository to manufacture missing authority.

| Field | Value |
| --- | --- |
| DeepSeek Harness package | `@deepseek-ai/dsh@0.1.0-rc.6` |
| DSH npm integrity | `sha512-brpZfED7ieRa2PQ5tUxMhHrM1pb2CmKFVM/f6yMULBDMicahk+Z2OsHgTwTDnoiZm23Ftu9rQz0NN4pflaoJcg==` |
| DSH npm shasum | `de9fbf39056c7f4e658a3e284cb1d66ebc86d040` |
| Package-manifest `sourceCommit` | key omitted |
| ui-theme package | `@deepseek-ai/dsh-client-ui-theme@0.1.0-rc.6` |
| ui-theme npm integrity | `sha512-Wu+bvnuti/gLA+t5a2cWUMQJ5UCqxt6oEK+OJiJ68gN0ixs2skpaN0nFdFoY2exC5KByXrNlN1rRrD+FsZSBLA==` |
| Web frontend package | `@deepseek-ai/dsh-web-frontend@0.1.0-rc.6` |
| Frontend npm integrity | `sha512-+RpdDF11FqUZSbJGoZ4oLIk/4PJR+ynTS4ELMn9QqucbYZ8tv0Itq9ZtG2o6pKIe7NO0lj/eBjCR2EoRKx7L+g==` |
| Main frontend JS SHA-256 | `a40165a9916acf9c5710e440842c9a56bc472ae9991f37f4675a7664ae784d68` |
| Main frontend CSS SHA-256 | `8ecb4b25268f5acae7e6f1b9e5cc8d14e5c5fa17da70a6a7863c896496f257ea` |
| Token catalog SHA-256 | `fe38fdb18dae76f3cc93e3ca3a37bb1916f207180781b1aa8321ee2ddadcb926` |
| DSH-Themes selector catalog SHA-256 | `5bcd9f874095af2114d86f91301868c6b0f2cebe58f51b9919150975d406baa3` |

## Verified runner

The package compatibility manifest and runtime attestation are separate contracts. The historical V2 package manifest contains five rc.6 compatibility fingerprints. It does not claim to contain the dependency closure. A current Manager release record additionally carries the exact independent runtime-attestation fields below.

| Field | Exact value |
| --- | --- |
| Attestation SHA-256 | `2400606c5cb6534e09a65020e4ae12a0df4c1d08f15918d714bc5037c2ed99ba` |
| Runner lockfile SHA-256 | `22f995efe8338c2a3cd97bd731853d010363531145c35073adb2dca3773f6053` |
| Critical `@deepseek-ai/*` package count | `197` |
| Canonical critical-package array SHA-256 | `f883815b282c4e86a1ecb8cf60914459f875a1d34da02cfce8b119824a950894` |
| Package manager | `pnpm@11.7.0` |
| pnpm integrity | `sha512-GcyFLBIMcSV2DyRD7mvgyltA+fUFmN4aCaHxd1A+AQ5Xwjx3ZG4B52HeWb+HT7IqM5jDOrlpH8E+uUa28PTWIA==` |
| Web frontend integrity | `sha512-+RpdDF11FqUZSbJGoZ4oLIk/4PJR+ynTS4ELMn9QqucbYZ8tv0Itq9ZtG2o6pKIe7NO0lj/eBjCR2EoRKx7L+g==` |

Bootstrap once from the Skill directory. The subshell preserves the caller's workspace; subsequent launcher calls always retain that workspace as the child `cwd`:

```sh
(
  cd "<skill-dir>/runtime" &&
  corepack pnpm install --frozen-lockfile --ignore-scripts
)
node "<skill-dir>/scripts/verify-runner.mjs"
```

Corepack reads the exact `packageManager` version and SHA-512 hash from `runtime/package.json`. The frozen install refuses lock drift and lifecycle scripts. `verify-runner.mjs` then verifies the attestation, lock digest, pnpm/DSH versions, and all 197 attested critical package resolutions before any DSH operation.

All operations use `node "<skill-dir>/scripts/run-dsh.mjs" ...`; never use a PATH `dsh` or `pnpm dlx`. Real UI acceptance is limited to `http://127.0.0.1:<port>` or `http://[::1]:<port>`, with telemetry disabled. `0.0.0.0`, LAN hosts, `--patch`, and `--trusted-host` are rejected; trusted-host controls are not authentication.

The token hash is the SHA-256 of the sorted 13-token catalog, one UTF-8 token per line with a final newline. The selector hash is the SHA-256 of this canonical ordered UTF-8 list, one selector per line with a final newline:

```text
html
body
#root
body[data-ds-dark-theme]
[data-slot='root']
[data-slot='root'] > div
[data-slot='sidebar']
[data-slot='sidebar'] > div
[data-slot='conversation']
[data-slot='conversation'] > div
[data-slot='conversation.session']
[data-slot='conversation.composer']
[data-composer-card='true']
[data-slot='details']
[data-shell-overlay='true']
```

This is the rc.6 DSH-Themes allowlist verified against the real Web UI, not every selector present in Harness.

## Digest scopes

| Contract | Field | Scope | Installation authority |
| --- | --- | --- | --- |
| V2 sidecar | `artifact.sha256` | Complete downloaded `.tgz` | Yes, when it also matches the trusted catalog |
| V2 embedded/sidecar | `payload.sha256` | Canonical tar excluding the manifest | No |
| V1 embedded/sidecar | `package.sha256` | Canonical package payload excluding `theme.json` | No |
| Catalog | `artifactSha256` | Complete downloaded `.tgz` | Yes |

V1 packages certified for `0.1.0-rc.5` remain historical artifacts. Their exact source commit is `47f943859bef60e4160492346772ded9b24f765a`, but this value must never appear in an rc.6 V2 compatibility record.
