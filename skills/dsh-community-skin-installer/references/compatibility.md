# RC.8 community-skin certification target

The baseline is exact DeepSeek Harness `0.1.0-rc.8`, official tag `dsh-v0.1.0-rc.8`, source commit `141eb6fef83422698aef7a981029e843e8161534`. The adjacent Manager is certified with final attestation `1cd9a0b4a6b9d215f0a1f70a97b4d43eae7bf4f846ae7009b7ddb812823ca0ae`; community authority remains a separate gate.

This Skill does not carry a second DSH runner. It requires the adjacent `dsh-theme-manager` runner and the exact final RC.8 V3 attestation so two skills cannot silently drift to different Harness closures. Community installation is authorized only for the exact 11 records whose self-contained catalog, final receipt, item status, and Manager gate all validate. A remote claim or Manager certification alone cannot add another item. The repository's [`release-state.json`](../../../release-state.json) is informational only.

## Skin Center authority

- Package: `@linxin666/dsh-client-ui-skin-center@0.2.5`
- Source: dsh-web-ui tag `v0.2.5`, commit `dda2780bd6467de92ad7533f9f1c28a7a5a04118`
- Tarball: `https://registry.npmjs.org/@linxin666/dsh-client-ui-skin-center/-/dsh-client-ui-skin-center-0.2.5.tgz`
- SHA-256: `5b0c06426320a011a54cc8ddbe921e7b3f2d8d11a3d18bf0b92ad186ffb39499`
- npm integrity: `sha512-Dl82U+Gg7/KCkwjHkhMveW0e8R/oBSOFnB3d/AnYFpIL0IyC/SQ5IEkDLpNpp6dwz7FHIIMOGyChsIcd8Bxixg==`
- Size: `58,988,084` bytes

The npm package metadata says Apache-2.0 while the published repository/package LICENSE file is BSD-3-Clause. Expose that conflict; do not normalize it away.

## Runtime acceptance

Installation authority requires both (1) an item-level `runtimeStatus: runtime-verified` record produced from the exact package, exact user-skin asset hashes where applicable, and the RC.8 runner, and (2) an adjacent Manager whose certified current lane is exact RC.8. Verification covers package state, Skin Center catalog identity, try-on/apply/switch-back/restart/rollback, light/dark/system, narrow and 200% zoom surfaces, console/network behavior, and cleanup.

All 11 bundled records are `runtime-verified` in the executable catalog. The sanitized [final receipt](runtime-receipt.rc8.json), SHA-256 `89bb10b995e7734b6c13ab7d0027d73440f5d8f40b1f618b3c9adbbe52e1b1a1`, binds the item matrix to final Manager attestation `1cd9a0b4a6b9d215f0a1f70a97b4d43eae7bf4f846ae7009b7ddb812823ca0ae`. For the QQ98 and THS CSS-only adaptations, both the executable catalog and this receipt bind the upstream source digest, `PROVENANCE.json`, and every bundled file digest; the installer recomputes and matches all of them before writing a profile. Their reviewed bundles contain no runtime asset, so every CSS `url()` token is rejected. The [prepared evidence](runtime-evidence-prepared.json) remains byte-addressed history and preserves the different candidate attestation; the explicit bridge forbids silently replacing one hash with the other.
