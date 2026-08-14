# Catalog contract

The client accepts a JSON array, `{ "items": [...] }`, or the website envelope `{ "code": 0, "data": { "items": [...] } }`.

Each accepted item contains:

```json
{
  "slug": "ocean-workbench",
  "kind": "full-skin",
  "name": "Ocean Workbench",
  "description": "A calm blue workbench skin.",
  "status": "published",
  "verified": true,
  "modes": ["light", "dark"],
  "author": { "name": "Example" },
  "license": "CC-BY-4.0",
  "version": "1.0.0",
  "compatibility": {
    "schemaVersion": 2,
    "dshPackageVersion": "0.1.0-rc.6",
    "dshPackageIntegrity": "sha512-brpZfED7ieRa2PQ5tUxMhHrM1pb2CmKFVM/f6yMULBDMicahk+Z2OsHgTwTDnoiZm23Ftu9rQz0NN4pflaoJcg==",
    "frontendBundleSha256": "a40165a9916acf9c5710e440842c9a56bc472ae9991f37f4675a7664ae784d68",
    "tokenCatalogSha256": "fe38fdb18dae76f3cc93e3ca3a37bb1916f207180781b1aa8321ee2ddadcb926",
    "selectorCatalogSha256": "5bcd9f874095af2114d86f91301868c6b0f2cebe58f51b9919150975d406baa3"
  },
  "package": {
    "fileName": "ocean-workbench-1.0.0.tgz",
    "url": "/api/themes/ocean-workbench/download/1.0.0",
    "sha256": "64-lowercase-hex",
    "integrity": "matching-sha256-SRI"
  }
}
```

Unknown additional fields are ignored. A same-origin relative package URL is resolved against a remote HTTPS catalog; local catalog files must contain absolute HTTPS package URLs. `verified` is catalog attestation, not cryptographic publisher identity.
