# Verified compatibility baseline

Treat every value as exact. A missing source commit is intentional; the published npm metadata for this release does not expose a trustworthy `gitHead`, so do not invent one.

| Field | Value |
| --- | --- |
| DeepSeek Harness package | `@deepseek-ai/dsh@0.1.0-rc.6` |
| DSH npm integrity | `sha512-brpZfED7ieRa2PQ5tUxMhHrM1pb2CmKFVM/f6yMULBDMicahk+Z2OsHgTwTDnoiZm23Ftu9rQz0NN4pflaoJcg==` |
| Web frontend package | `@deepseek-ai/dsh-web-frontend@0.1.0-rc.6` |
| Frontend npm integrity | `sha512-+RpdDF11FqUZSbJGoZ4oLIk/4PJR+ynTS4ELMn9QqucbYZ8tv0Itq9ZtG2o6pKIe7NO0lj/eBjCR2EoRKx7L+g==` |
| Main frontend JS SHA-256 | `a40165a9916acf9c5710e440842c9a56bc472ae9991f37f4675a7664ae784d68` |
| Token catalog SHA-256 | `fe38fdb18dae76f3cc93e3ca3a37bb1916f207180781b1aa8321ee2ddadcb926` |
| DSH-Themes selector catalog SHA-256 | `4c04e9fcff6caccd4c76ebc23a4442d4d1443356d9750f7135506d788a3ec7c7` |

The token hash is the SHA-256 of the sorted 13-token catalog, one UTF-8 token per line with a final newline. The selector hash is the SHA-256 of this canonical ordered UTF-8 list, one selector per line with a final newline:

```text
html
body
#root
[data-ds-dark-theme]
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
