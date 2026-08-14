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
| DSH-Themes selector catalog SHA-256 | `e544ff5a3f7edacced0c5c9ed8fd26cb598b3d01d1298b10952a64876beaf7fd` |

The token hash is the SHA-256 of the sorted 13-token catalog, one UTF-8 token per line with a final newline. The selector hash covers the DSH-Themes allowlist, not every selector present in Harness.
