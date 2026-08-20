---
name: dsh-theme-submitter
description: Validate a local declarative DSH-Themes manifest and guide its author into the website's authenticated submission flow. Use when preparing a theme or full skin for moderation, checking provenance and compatibility, or opening a safe submission page without API credentials, cookies, or automated account access.
---

# DSH Theme Submitter

Validate locally, then let the user sign in on the website. Never request, read, save, copy, or transmit a browser cookie, session, password, API key, authorization header, or long-lived credential.

Upstream DeepSeek Harness `0.1.0-rc.8` is available on npm `next`, but DSH-Themes certifies submissions only for `0.1.0-rc.6`. Reject rc.7/rc.8 compatibility rather than upgrading or rewriting it; V1 rc.5 is historical and is not accepted by this submission path. [`release-state.json`](../../release-state.json) records this informational distinction without controlling validation.

## Preflight

1. Confirm the user intends to publish and can license every included asset for the declared commercial-use policy. Licensed hosted submissions that require attribution need a genuine fixed-revision NOTICE URL; a LICENSE URL is not a NOTICE. Upstreams without a NOTICE may only be handed off as non-installable external showcases with `noticeUrl` omitted or null.
2. Read [references/submission-checklist.md](references/submission-checklist.md).
3. Validate the manifest and produce a safe handoff URL:

   ```bash
   node <skill-dir>/scripts/validate-submission.mjs \
     --manifest <absolute-manifest.json> \
     --site <https://trusted-dsh-themes-site>
   ```

For local development only, `http://localhost:<port>` is allowed. The script performs no network request and writes no credentials or configuration. It rejects executable fields, unsafe color syntax, non-rc.6 compatibility, missing hashes, remote runtime assets, secret-like keys, package publication claims, and malformed copyright declarations.

## Handoff

1. Report validation success, manifest SHA-256, theme slug, and exact DSH version.
2. Report `distributionEligibility`: commercially permitted declarations may enter hosted review; noncommercial declarations are showcase-only; unclear rights require clearance.
3. Open or give the user the returned `submissionUrl`.
4. Tell the user to sign in in their own browser, upload the validated JSON and its local raster assets, review the parsed values, accept the declaration, and submit for moderation.
5. Do not post directly to a private submission API, scrape a browser session, or claim acceptance before the website returns a submission ID.

If validation fails, fix the declarative source with `dsh-theme-creator`; do not bypass the failed check. The website remains authoritative and will repeat image decoding, ownership, schema, compatibility, and security validation.
