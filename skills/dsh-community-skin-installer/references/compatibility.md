# alpha.1 community-skin certification target

The current target is exact DeepSeek Harness `0.1.2-alpha.1`, official tag `dsh-v0.1.2-alpha.1`, source commit `cd5ef8148158c3a752a658978873241fdf8e2bbc`, and tree `a712eec535b48badc4fefb4df5176a7002e4280b`.

The tag has no official binary Release asset. Certification therefore targets the project-certified official-source build and must retain that label. It must not be described as an official binary distribution.

`baseline-policy.json` selects `currentAlpha1`; `alpha1-recertification.json` is its current installation gate. It records 11 required items, 0 completed items, and `installable: false`. Every website record must consequently remain `external-showcase`, `showcase-only`, and `verification-pending` on baseline `0.1.2-alpha.1`.

## Historical evidence

`community-catalog.json`, `runtime-receipt.rc8.json`, and `runtime-evidence-prepared.json` preserve exact RC.8 identity, rights, asset, network, lifecycle, and rollback history. Their checked-in SHA-256 values remain fixed. They are useful inputs to a new review, but they do not prove alpha.1 compatibility and cannot authorize current installation.

The RC.2 runtime-baseline and pending receipt remain historical evidence of a different baseline. Baseline certification cannot replace item authority.

## Promotion boundary

Each item needs six current-baseline tasks: macOS arm64, Linux x64, and Windows x64 on Node 22.19 and 24.15. Every task must cover exact install, `web` Profile state, `dump-config`, cold restart, functional probe, removal, and complete rollback. A reviewed future authority must bind the exact sanitized runtime and rollback receipt sets and teach the validator to verify them before the lane can reopen.

The historical Skin Center coordinate and rights conflict remain review inputs:

- `@linxin666/dsh-client-ui-skin-center@0.2.5`
- source commit `dda2780bd6467de92ad7533f9f1c28a7a5a04118`
- package metadata says Apache-2.0 while its scoped LICENSE file says BSD-3-Clause

This coordinate is not an alpha.1 installation recommendation while the gate is pending.
