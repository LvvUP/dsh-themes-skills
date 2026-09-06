# Computer Use — fixed Alpha adaptation

Catalog ID: #3061. Upstream: Anionex/dsh-computer-use at 97b9731abcccb14d32d3985df971982a56506e1a, MIT, version 0.3.2. Adapted package: @anionex/dsh-computer-use@0.3.2-dsh.alpha.2.

This package retains the complete upstream published-file set: all 20 JavaScript modules and their declarations, all providers, source, documentation, cursor/fixture images, native Swift sources, native manifest and the upstream universal macOS helper. The helper bytes are unchanged and its executable mode is preserved. macOS 14 or newer and the relevant macOS Accessibility permission are required; screenshots additionally need Screen Recording permission. No account or independent backend is required. Permissions and actual desktop operations remain user-controlled. The package performs its native health initialization when loaded; preparing this artifact did not launch it.

Changes for DeepSeek Harness 0.1.3-alpha.1:

- Use the literal `computer-use` namespace accepted by Alpha Settings.register/replace, replacing the removed settingsNamespace factory. Preserve the full schema, live settings watch, revision-conflict checks, same-origin settings endpoint, locale and settings.section UI. The client registration and settings/document-updated event contract remain supported by the fixed Alpha source.
- Replace the obsolete browser client-runtime dependency injection with the Alpha client-ui-renderer provider of slots; retain UI settings, locale and remotes.
- Replace two removed visual aliases with current border-l1 and label-secondary aliases in the source and precompiled client.
- Bundle the exact MIT-licensed Zod 4.4.3 dependency into the upstream leases module, preserving its validation and behavior. The configuration module is recompiled for the namespace change; other backend modules, provider paths, stale-observation protection, read/control leases, approval flows, screenshots and Web diagnostics remain intact.
- Remove npm lifecycle/build scripts and old development/peer dependency installation metadata from the distributed manifest. Host-provided modules remain external. This prevents installing an older Harness or invoking the upstream Swift rebuild during package installation; the complete original maintenance scripts remain available as source.

UPSTREAM.json records the fixed archive and all 168 upstream source files; DEPENDENCIES.json records the fixed dependency archive and every dependency file. alpha.patch records the human-readable non-generated changes; build.mjs reproduces the bundled lease module and the configuration module with esbuild 0.28.2 and the verified Zod input. The source directory contains the final package files. pack.py writes a deterministic archive, preserving mode 0755 for native/macos/bin/dsh-computer-use-helper; all other entries are mode 0644.

Reproduction:

    node build.mjs /absolute/esbuild-0.28.2 /absolute/fixed-node_modules
    DSH_ALPHA_FIXTURE_ROOT=/absolute/fixed-alpha-source node --test fixture.test.mjs
    python3 pack.py /absolute/output.tgz

The tests are isolated pure-schema/static package fixtures. They check the actual bundled Zod schema, pure configuration against the real Alpha Schemastery module, retained settings route/watch/UI contract, import and entry-point completeness, native source/binary hashes and executable mode. They do not start a DSH service, native helper, browser or desktop action, and do not prove DSH installation, permissions, tool success or end-to-end functionality. Runtime validation and its receipt must be produced separately before installation approval.
