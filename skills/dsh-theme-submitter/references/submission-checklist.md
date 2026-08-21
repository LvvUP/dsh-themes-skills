# Submission checklist

- The manifest was generated from data-only authoring input.
- The normalized full skin has distinct background, sidebar, card, light-preview, and dark-preview WebP files, each no larger than 10MB and 24MP, with its SHA-256 recorded. JPEG/PNG originals are uploaded through Theme Studio for conversion.
- The theme contains all 13 `--dsw-*` tokens in light and dark modes.
- The manifest is schema V3 and compatibility exactly matches [compatibility-v3.json](compatibility-v3.json): DeepSeek Harness `0.1.0-rc.8` official tag/commit, all three npm artifact digests, token/UI/entrypoint/asset-set/selector fingerprints, and the final runtime attestation SHA-256.
- RC.6 V2 and RC.5 V1 are historical only. They are neither upgraded by rewriting version strings nor accepted as current Submitter input; partial or candidate RC.8 evidence is also rejected.
- The author name and copyright source type, declaration, and optional HTTPS source URL are accurate.
- The license identifier, fixed license URL, commercial-use status, attribution duty, and share-alike duty are explicit and mutually consistent.
- The license covers the manifest and all submitted art; licensed third-party art entering hosted review includes a fixed source revision when available, attribution of no more than 256 characters, and a genuine fixed NOTICE URL. A LICENSE URL cannot substitute for NOTICE. An upstream with no NOTICE can only be recorded by the website as a non-installable external showcase with omitted/null `noticeUrl`. These declarations still require moderation and do not prove permission.
- Noncommercial art is understood to be external-showcase-only in the current sponsored site context unless separate rights clearance is documented.
- The manifest contains no code, CSS, HTML, dependencies, lifecycle script, font, SVG, external runtime asset, credential, or secret.
- The author manifest contains neither `payload` nor `artifact`; the trusted publisher may add both to a release sidecar, and publication readiness trusts only the complete `.tgz` artifact digest.
- Mock previews are labeled drafts. Publication requires screenshots from an isolated real Harness run.
- The user understands that moderation may reject unsafe, incompatible, misleading, or unlicensed content.
