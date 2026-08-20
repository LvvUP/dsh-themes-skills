# RC.8 community-skin certification target

The target lane is exact DeepSeek Harness `0.1.0-rc.8`, official tag `dsh-v0.1.0-rc.8`, source commit `141eb6fef83422698aef7a981029e843e8161534`. It is released upstream but remains a DSH-Themes certification target in this public Skill release.

This Skill does not carry a second DSH runner. It requires the adjacent `dsh-theme-manager` runner and an RC.8 V3 attestation so two skills cannot silently drift to different Harness closures. The adjacent Manager currently certifies only `0.1.0-rc.6`; therefore community installation is unavailable even if a remote record claims RC.8 compatibility. The self-contained install gate is frozen in `community-catalog.json`. The repository's [`release-state.json`](../../../release-state.json) is an informational summary only and does not create executable authority.

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

All bundled records are `verification-pending` and the Manager is still RC.6. Missing evidence keeps installation fail-closed even when the source license permits redistribution.
