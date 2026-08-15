# Verified compatibility baseline

Treat every value as exact. A missing source commit is intentional: the published npm metadata for this release does not expose a trustworthy `gitHead`, so never invent or reuse one.

| Field | Value |
| --- | --- |
| DeepSeek Harness package | `@deepseek-ai/dsh@0.1.0-rc.6` |
| DSH npm integrity | `sha512-brpZfED7ieRa2PQ5tUxMhHrM1pb2CmKFVM/f6yMULBDMicahk+Z2OsHgTwTDnoiZm23Ftu9rQz0NN4pflaoJcg==` |
| DSH npm shasum | `de9fbf39056c7f4e658a3e284cb1d66ebc86d040` |
| Source commit | omitted or `null` |
| Web frontend package | `@deepseek-ai/dsh-web-frontend@0.1.0-rc.6` |
| Frontend npm integrity | `sha512-+RpdDF11FqUZSbJGoZ4oLIk/4PJR+ynTS4ELMn9QqucbYZ8tv0Itq9ZtG2o6pKIe7NO0lj/eBjCR2EoRKx7L+g==` |
| Main frontend JS SHA-256 | `a40165a9916acf9c5710e440842c9a56bc472ae9991f37f4675a7664ae784d68` |
| Main frontend CSS SHA-256 | `8ecb4b25268f5acae7e6f1b9e5cc8d14e5c5fa17da70a6a7863c896496f257ea` |
| Token catalog SHA-256 | `fe38fdb18dae76f3cc93e3ca3a37bb1916f207180781b1aa8321ee2ddadcb926` |
| DSH-Themes selector catalog SHA-256 | `5bcd9f874095af2114d86f91301868c6b0f2cebe58f51b9919150975d406baa3` |

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
