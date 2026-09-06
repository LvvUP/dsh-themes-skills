# Submission checklist

- The manifest was generated from data-only authoring input.
- RC.2 runtime-baseline certification is not a submission authority; RC.2 submission remains disabled until a separate reviewed submission sidecar exists.
- The normalized full skin has distinct background, sidebar, card, light-preview, and dark-preview WebP files, each no larger than 10MB and 24MP, with its SHA-256 recorded. JPEG/PNG originals are uploaded through Theme Studio for conversion.
- The theme contains all 13 `--dsw-*` tokens in light and dark modes.
- Optional `visual.mobileWelcomeSurface` is boolean. Optional `visual.mobileWelcomeOffset` is an integer from **-120 through 120**, inclusive, preserved without coercion: positive values move the mobile welcome group down, negative values move it up, and zero or omission keeps its default vertical position. Check the resulting mobile composition before submission.
- The manifest is schema V3 and compatibility exactly matches [compatibility-alpha.json](compatibility-alpha.json): DeepSeek Harness `0.1.3-alpha.1` official tag/commit, fixed source lockfile and build fingerprints, token/UI/entrypoint/asset-set/selector fingerprints, and the verified runtime attestation SHA-256. `npmArtifacts` must be `null`.
- RC.6 V2 and RC.5 V1 are historical only. They are neither upgraded by rewriting version strings nor accepted as current Submitter input; RC.8 is accepted only with explicit `--baseline historical-rc8` for historical validation without a current submission URL; partial or mixed evidence is rejected.
- The author name and copyright source type, declaration, and optional HTTPS source URL are accurate.
- The license identifier, fixed license URL, commercial-use status, attribution duty, and share-alike duty are explicit and mutually consistent.
- The license covers the manifest and all submitted art; licensed third-party art entering hosted review includes a fixed source revision when available, attribution of no more than 256 characters, and a genuine fixed NOTICE URL. A LICENSE URL cannot substitute for NOTICE. An upstream with no NOTICE can only be recorded by the website as a non-installable external showcase with omitted/null `noticeUrl`. These declarations still require moderation and do not prove permission.
- Noncommercial art is understood to be external-showcase-only in the current sponsored site context unless separate rights clearance is documented.
- The manifest contains no code, CSS, HTML, dependencies, lifecycle script, font, SVG, external runtime asset, credential, or secret.
- The author manifest contains neither `payload` nor `artifact`; the trusted publisher may add both to a release sidecar, and publication readiness trusts only the complete `.tgz` artifact digest.
- Mock previews are labeled drafts. Publication requires screenshots from an isolated real Harness run.
- The user understands that moderation may reject unsafe, incompatible, misleading, or unlicensed content.
