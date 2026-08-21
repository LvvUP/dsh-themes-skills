# Community catalog contract

`community-catalog.json` is a local installation allowlist, not a general discovery feed.

## Independent axes

- `rightsStatus`: evidence and restrictions for code, media, attribution, and marks.
- `runtimeStatus`: whether exact bytes passed the current RC.8 acceptance matrix.
- `installationMode`: `skin-center-builtin` or `bundled-user-skin`.
- `executableHooks`: whether selecting the skin executes a built-in `hooks.mjs`.
- `networkDisclosure`: known external requests; an empty array is not a claim that the upstream can never change.

## Publication rule

Translated names and descriptions are untrusted metadata. The validator accepts the website's nested directory record (`source`, `rights`, `runtime`, `compatibility`, `distribution`, and `admission`) and a legacy flat record for transition inspection only. A legacy record is never installation authority. Before installation, the nested record's stable catalog number, slug, distribution, RC.8 identity, source repository/revision/subdirectory, installation mode, rights/runtime status, exact Skin Center tarball, and adaptation identity must match the local allowlist.

The website record never supplies executable artifact or command authority. Exact Skin Center bytes and CSS-adaptation hashes come only from this Skill. `external-showcase` is always inspection-only. `external-runtime-verified` can be handed to this Skill only when the local item is also `runtime-verified`, consent is required, and the adjacent Manager's certified release is exact RC.8.

A changed authority field requires a catalog and Skill release with new evidence; never accept it from the network at runtime. A remote `verified: true`, install command, artifact URL, compatibility claim, or mutable source link cannot open either install gate.
