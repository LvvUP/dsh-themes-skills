# Community catalog contract

The authority has two layers:

- `community-catalog.json` preserves the exact 11-item identity, rights, asset, and historical RC.8 evidence.
- `alpha1-recertification.json` alone decides current-baseline installability.

## Independent axes

- `rightsStatus`: code, media, attribution, commercial-use, and trademark restrictions.
- current `runtimeStatus`: whether exact bytes passed the alpha.1 six-task matrix.
- `installationMode`: historical package form, not permission to install.
- `executableHooks` and `networkDisclosure`: capabilities that must be disclosed and re-tested.

## Public-ID and website rule

Finder must resolve the exact public `#NNNN` shown in the top-left of the selected card or detail page. The ID must use the four-digit form, match `^#([1-9]\d{3})$`, and carry `selection.authority: "unique-catalog-id"`. Names, slugs, detail URLs, package names, and legacy `DSH-*` labels are discovery-only. Technical coordinates remain internal checks, never a second user-facing identifier.

All 11 alpha.1 items are `verification-pending`. The website may publish their descriptive records, but must use `external-showcase`, `showcase-only`, and alpha.1 `verification-pending` compatibility. It must not supply an artifact URL or install command.

The validator accepts a nested website directory record for inspection. A legacy flat RC.8 record is historical inspection input only. `--mode install` must fail while any current item, aggregate gate, runtime receipt, or rollback receipt is incomplete.

Translated names and prose are untrusted metadata. A remote `verified: true`, URL, command, artifact, mutable version, old Manager attestation, old receipt, or `release-state.json` cannot alter the local gate. A future promotion requires a reviewed authority and validator release with fresh alpha.1 evidence; local edits are never a bypass.
