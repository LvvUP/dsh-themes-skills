---
name: dsh-theme-submitter
description: Validate a local declarative DSH-Themes manifest and guide its author into the website's authenticated submission flow. Use when preparing a theme or full skin for moderation, checking provenance and compatibility, or opening a safe submission page without API credentials, cookies, or automated account access.
---

# DSH Theme Submitter

Validate locally, then let the user sign in on the website. Never request, read, save, copy, or transmit a browser cookie, session, password, API key, authorization header, or long-lived credential.

Accept only `schemaVersion: "3.0"` manifests whose compatibility object exactly equals the current Alpha source evidence in [references/compatibility-alpha.json](references/compatibility-alpha.json), bound by its exact SHA-256 and cross-checked against the Manager source runtime and 54-package authority. Reject partial, candidate, mixed-version, or extra compatibility evidence. RC.6 V2 and RC.5 V1 are historical and are not accepted by this submission path.

The default is DeepSeek Harness `0.1.3-alpha.1`, source commit `d347e703908d0406b7a7ef80e3a0e594d86b2215`, with `npmArtifacts: null`. Run `scripts/inspect-baseline.mjs` to inspect this sidecar. Local validation admits a draft for review; it does not certify the new theme or publish it.

Public catalog identity is assigned by the website only after moderation. Creator and Submitter never mint, accept, or preserve a user-chosen public ID or legacy `DSH-*` label; published selections use the site's exact four-digit `#NNNN` contract, while the manifest slug remains discovery metadata rather than installation authority.

`node <skill-dir>/scripts/inspect-baseline.mjs certifiedRuntimeBaseline` exposes the verified RC.2 runtime baseline without enabling submission. It must remain `enabled: false`: the six-job runtime proof is not a submission sidecar and cannot enter the website handoff. The `candidate` view is retained only as immutable historical-at-capture evidence.

## Preflight

1. Confirm the user intends to publish and can license every included asset for the declared commercial-use policy. Licensed hosted submissions that require attribution need a genuine fixed-revision NOTICE URL; a LICENSE URL is not a NOTICE. Upstreams without a NOTICE may only be handed off as non-installable external showcases with `noticeUrl` omitted or null.
2. Read [references/submission-checklist.md](references/submission-checklist.md).
3. Validate the manifest and produce a safe handoff URL:

   ```bash
   node <skill-dir>/scripts/validate-submission.mjs \
     --manifest <absolute-manifest.json> \
     --site <https://trusted-dsh-themes-site>
   ```

For local development only, `http://localhost:<port>` is allowed. The script performs no network request and writes no credentials or configuration. It rejects executable fields, unsafe color syntax, non-V3 or non-exact-Alpha compatibility, missing hashes, remote runtime assets, secret-like keys, `artifact`/`payload` publication claims, and malformed copyright declarations.

## Handoff

1. Report validation success, manifest SHA-256, theme slug, and exact DSH version.
2. Report `distributionEligibility`: commercially permitted declarations may enter hosted review; noncommercial declarations are showcase-only; unclear rights require clearance.
3. Open or give the user the returned `submissionUrl`.
4. Tell the user to sign in in their own browser, upload the validated JSON and its local raster assets, review the parsed values, accept the declaration, and submit for moderation.
5. Do not post directly to a private submission API, scrape a browser session, or claim acceptance before the website returns a submission ID.

If validation fails, fix the declarative source with `dsh-theme-creator`; do not bypass the failed check. The website remains authoritative and will repeat image decoding, ownership, schema, compatibility, and security validation.

The companion `dsh-theme-manager` Skill must be present from the same reviewed repository revision; it supplies the independent Alpha source and hosted-evidence checks.

## Historical verification

Use `--baseline historical-rc8` only to validate a retained RC.8 manifest against the unchanged [RC.8 sidecar](references/compatibility-v3.json). It returns `historical: true`, `ready: false`, and no submission URL. The old proof remains reviewable but cannot authorize the current Alpha website handoff. `inspect-baseline.mjs certified` inspects this historical lane.
