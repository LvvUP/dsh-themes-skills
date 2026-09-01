# Alpha.2 replacement Plugin runtime lane

This lane exists only for the 44 ID-less candidates frozen in
`alpha2-plugin-migration-map.json`. It does not run the 28 retired legacy
records and it does not modify the installable `plugin-authority.json` items.

The checked-in runtime plan binds the migration-map bytes and schema, the
official alpha.2 tag/commit/tree/lockfile, and the current Harness release
authority digest. It remains `runtime-input-authority-pending`; therefore the
matrix planner exits non-zero before any candidate checkout or execution.

After every exact artifact, hosted-adaptation recipe, and functional probe has
been reviewed, the plan can expand four disjoint batches of eleven candidates.
Each candidate runs on these six tuples:

- Linux x64 with Node 22.19.0 and 24.15.0;
- macOS arm64 with Node 22.19.0 and 24.15.0;
- Windows x64 with Node 22.19.0 and 24.15.0.

`candidateKey` and `candidateToken` are internal CI identities. Neither is a
public installation selector. Task artifacts contain only a closed sanitized
receipt: no environment, secret, browser credential, machine path, candidate
output, or digest derived from private Profile/credential bytes. Receipt filenames bind the run ID, run attempt, candidate
token, and tuple; aggregation rejects duplicate tasks and cross-run reuse.

A candidate qualifies only when all six exact passed receipts are present.
Five receipts are not partial success. When at least 28 candidates qualify,
the aggregator selects them by the frozen migration rank and proposes the
sequential range `#3089` through `#3116`. Every retired ID remains excluded.

The proposal explicitly states `installable: false` and
`writesPluginAuthorityItems: false`. Hosted entries remain
`hosted-adaptation-candidate-only`, even after 6/6 runtime evidence. A later
reviewed promotion must separately create complete item authority; this lane
never performs that promotion and never permits partial installation.
