# alpha.2 Plugin migration evidence

This reference records the fail-closed static review of the 44 source-intake
items rejected by the alpha.1 workflow. It supplements, and does not replace,
[`alpha1-plugin-migration-map.md`](./alpha1-plugin-migration-map.md). The
alpha.1 map remains historical evidence for that baseline.

The machine authority for this review is
[`alpha2-plugin-migration-map.json`](./alpha2-plugin-migration-map.json),
validated by its adjacent schema and
`scripts/validate-alpha2-plugin-migration-map.mjs`. It binds both inputs:

- DeepSeek Harness `dsh-v0.1.2-alpha.2`, commit
  `0a53fb55bea101816fa226bb964ae2bed71c343b`, tree
  `64ccbfa8e0caa4711cd4a75717ef9e022657961b`.
- `awesome-dsh-plugin/awesome-dsh-plugin`, commit
  `db181e1aed39ad4a041cb9d379f0d713edfc49bb`, tree
  `24c75117d9fe59fd832359c7ef2ab14632fd543d`.

This file and its JSON are review evidence only. They are not runtime receipts
and do not make any item installable. `plugin-authority.json` binds their exact
bytes only as a fail-closed migration prerequisite; its installable `items`
array remains empty until the independent runtime gates pass.

## Frozen outcome

- Keep the original Public ID with a direct exact pin for six items:
  `#3021`, `#3022`, `#3032`, `#3039`, `#3066`, and `#3076`.
- Keep the original Public ID only behind a separately built and certified
  hosted adaptation for ten items: `#3004`, `#3006`, `#3008`, `#3010`,
  `#3011`, `#3017`, `#3040`, `#3041`, `#3042`, and `#3050`.
- Permanently retire 28 IDs: `#3009`, `#3012`, `#3013`, `#3014`, `#3015`,
  `#3018`, `#3020`, `#3026`, `#3034`, `#3035`, `#3037`, `#3043`, `#3044`,
  `#3047`, `#3055`, `#3056`, `#3057`, `#3059`, `#3060`, `#3061`, `#3065`,
  `#3071`, `#3072`, `#3073`, `#3078`, `#3079`, `#3080`, and `#3086`.

The direct and hosted-retention labels mean only that static review found a
bounded path worth runtime certification. Every retained item remains
`pending-runtime` until its exact artifact or adaptation passes the full
matrix.

## Replacement pool boundary

The JSON freezes 44 ranked replacement candidates: 35 have an exact upstream
npm version or versioned Release asset, and nine require a hosted adaptation.
Every candidate is exactly `static-reviewed` and `pending-runtime`.

The first 20 static-review ranks are:

1. `FuRongJun-1999/dsh-memory`
2. `ADWMC/helm-d#packages/helmd`
3. `DeepTrial/dsh-bash-rtk`
4. `zhujunpeng12/dsh-memory-system`
5. `00080000/dsh-project-memory`
6. `tafcear/kimi-tide#packages/dsh-kimi-tide`
7. `SuCriss/dsh-version-update`
8. `squirrel20/dsh-cron`
9. `baisama-cloud/dsh-stt-input`
10. `Yu-tao-Li/dsh-reference-checker`
11. `kui123456789/dsh-codex-workflow`
12. `victorzhong0110/dsh-outcome-loop`
13. `zizhongfeiyang/dsh-settings-drawer`
14. `ruisenbai/dsh-annotation`
15. `Raphaelutumn/dsh-change-budget`
16. `uigdwunm/dsh-process-fold`
17. `wyouwd1/dsh-opencode-models`
18. `yxqfg/phone-lens#packages/phone-lens`
19. `Ruixinhua/dsh-universe-api`
20. `baisama-cloud/dsh-session-mover`

Rank is an editorial static-review order, not a runtime result and not a
promise of inclusion. The pool deliberately contains no Public ID field. It
must not be copied into the installable `plugin-authority.json.items` array
before certification.

## Public ID issuance gate

The 28 retired IDs are never rebound. A replacement can receive a new Public
ID only after that individual candidate has passed all six alpha.2 runtime
tasks:

- macOS arm64 with Node 22.19.0 and Node 24.15.0;
- Linux x64 with Node 22.19.0 and Node 24.15.0;
- Windows x64 with Node 22.19.0 and Node 24.15.0.

Only after an individual six-task pass may the release workflow assign one of
the 28 needed new IDs, in certification order, beginning at `#3089` and
continuing sequentially. A static-review rank, source commit, Release asset,
or hosted-adaptation plan alone never reserves an ID. Failed or incomplete
candidates remain ID-less and non-installable.

## Fail-closed checks

The dedicated validator rejects:

- a baseline or awesome-snapshot commit/tree mismatch;
- any count other than 6 direct, 10 hosted, 28 retired, and 44 replacements;
- duplicate candidate keys, repository/subdirectory coordinates, package
  names, or install/source coordinates;
- any candidate Public ID field or any reuse of a retired legacy ID;
- a mutable branch, release alias, or non-exact npm coordinate;
- a candidate status stronger than `static-reviewed` / `pending-runtime`;
- a direct-upstream claim that still needs an alpha.2 package rewrite; and
- overlap between a replacement repository and the existing 80-item intake.

Passing this validator proves only that the static evidence is internally
consistent. Runtime certification, capability disclosure, licensing,
installation, removal, and rollback receipts remain separate mandatory gates.
