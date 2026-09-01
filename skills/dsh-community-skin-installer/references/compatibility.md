# alpha.2 community-skin certification target

The current target is exact DeepSeek Harness `0.1.2-alpha.2`, official tag `dsh-v0.1.2-alpha.2`, source commit `0a53fb55bea101816fa226bb964ae2bed71c343b`, and tree `64ccbfa8e0caa4711cd4a75717ef9e022657961b`.

The upstream prerelease publishes the official `@deepseek-ai/dsh@0.1.2-alpha.2` npm runtime. DSH Themes also keeps an exact-source cross-build lane. These are independent artifacts; the community gate does not claim source-to-npm byte equivalence. Both coordinates are bound through the shared Harness release authority.

`baseline-policy.json` selects `currentAlpha2`; `alpha2-recertification.json` and its digest-bound schema are the current installation gate. They record 11 required items, 0 reviewed items, 66 required platform/Node tasks, 0 completed tasks, and 0 installable items. Every website record must consequently remain `external-showcase`, `showcase-only`, and `verification-pending` on baseline `0.1.2-alpha.2`.

The final review is not all-or-nothing across all 11 records: all 11 items must be reviewed and all 66 tasks must finish, the nine shared Skin Center records reopen only as one all-passing cohort, and QQ98 plus THS remain item-level decisions. Failed items remain visible as showcase-only with a reason; one failed Skin Center member blocks all nine shared records, while an independent failure does not transfer to the other independent item.

## Historical evidence

`alpha1-recertification.json` preserves the prior 0/11 alpha.1 pending state. `community-catalog.json`, `runtime-receipt.rc8.json`, and `runtime-evidence-prepared.json` preserve exact RC.8 identity, rights, asset, network, lifecycle, and rollback history. Their checked-in SHA-256 values remain fixed. They are review inputs only; none can authorize alpha.2 installation.

The RC.2 runtime baseline and pending receipt remain historical evidence of a different baseline. Baseline certification cannot replace item authority.

## Promotion boundary

Each item needs six current-baseline tasks: macOS arm64, Linux x64, and Windows x64 on Node 22.19.0 and 24.15.0. Every task must cover exact install, `web` Profile snapshot, `dump-config`, cold restart, functional probe, removal, complete rollback, and restored-state verification. A reviewed future authority must bind exact sanitized per-item runtime and rollback receipt sets plus aggregate receipt-set digests before the lane can reopen.

The checked-in `alpha2-community-skin-recertification.yml` workflow is a static six-target guard only. It validates that every target sees the same pending authority and emits no runtime receipt. It must never be represented as runtime certification evidence.

## Candidate receipt contract

The three `alpha2-community-certification-*-receipt.schema.json` files and `scripts/alpha2-community-certification.mjs` define a candidate-only evidence lane. `plan` freezes the 11 × 6 Cartesian product; `verify-task`, `aggregate`, and `scan` reject tuple, source, gate, run, rollback, and privacy mismatches. `run-task` is intentionally fail-closed with `executor-not-reviewed`, so this revision cannot execute a Profile, filesystem, or network certification mutation.

Every candidate aggregate remains pending review with `authorityMutation: false` and `installability: "none"`; it does not replace `alpha2-recertification.json` or Finder authority. The nine `skin-center-builtin` records, including Maid Atelier, form one shared-artifact cohort: all nine must pass their six tasks and rollback before any of the nine can be considered for publication. QQ98 and THS retain item-level candidacy. `fetch-skin-center.mjs` enforces the nine-member current-receipt cohort before creating output or opening the network.

The historical Skin Center coordinate and rights conflict remain review inputs:

- `@linxin666/dsh-client-ui-skin-center@0.2.5`
- source commit `dda2780bd6467de92ad7533f9f1c28a7a5a04118`
- package metadata says Apache-2.0 while its scoped LICENSE file says BSD-3-Clause

This coordinate is not an alpha.2 installation recommendation while the gate is pending.
