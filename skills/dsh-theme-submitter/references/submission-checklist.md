# Submission checklist

- The manifest was generated from data-only authoring input.
- The normalized full skin has distinct background, sidebar, card, light-preview, and dark-preview WebP files, each no larger than 10MB and 24MP, with its SHA-256 recorded. JPEG/PNG originals are uploaded through Theme Studio for conversion.
- The theme contains all 13 `--dsw-*` tokens in light and dark modes.
- Compatibility is exactly DeepSeek Harness `0.1.0-rc.6` with the verified token and selector catalog hashes.
- The author name and copyright source type, declaration, and optional HTTPS source URL are accurate.
- The license covers the manifest and all submitted art; third-party art is accompanied by verifiable permission.
- The manifest contains no code, CSS, HTML, dependencies, lifecycle script, font, SVG, external runtime asset, credential, or secret.
- The author manifest contains neither `payload` nor `artifact`; the trusted publisher may add both to a release sidecar, and publication readiness trusts only the complete `.tgz` artifact digest.
- Mock previews are labeled drafts. Publication requires screenshots from an isolated real Harness run.
- The user understands that moderation may reject unsafe, incompatible, misleading, or unlicensed content.
