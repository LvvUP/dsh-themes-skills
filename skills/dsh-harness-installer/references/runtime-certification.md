# Alpha.1 runtime certification

This gate certifies runtime behavior of a local build from the pinned official
source. It does not certify or create an official binary.

## Exact six-task workflow

`.github/workflows/alpha1-runtime-certification.yml` is `workflow_dispatch`
only and issues promotable evidence only from `refs/heads/main`. Its matrix is
exactly:

- Linux x64 with Node 22.19.0 and 24.15.0.
- macOS arm64 with Node 22.19.0 and 24.15.0.
- Windows x64 with Node 22.19.0 and 24.15.0.

Every external action is pinned by a full commit SHA. Each tuple checks out the
fixed upstream tag, verifies its commit/tree/origin/lock authority, installs
with the frozen lock while suppressing dependency lifecycle scripts, executes
the reviewed `build:official` project build, and probes the resulting regular
`apps/cli/lib/bin.js` file. The tuple uploads only its closed runtime receipt;
the private build receipt and runtime home remain runner-local.

## Real probes and privacy

The probe uses a fresh runner-local runtime root (mode `0700` where filesystem
semantics support it), removes it after the probe, and supplies a minimal child
environment. It does not inherit arbitrary CI credentials, proxy settings,
`NODE_OPTIONS`, npm/pnpm overrides, or cloud-provider secrets. CLI output is
bounded and retained only long enough to parse `--version` or strict
`--profile web --dump-config` YAML.

Web startup output is also bounded and memory-only because it contains the
process launch BrowserAuth URL. After the URL is parsed, the listeners drain and
discard further output. The token and cookie are never printed, written,
included in an exception, hashed, or copied into a receipt. The tuple proves:

- unauthenticated root 401, launch exchange 303, authenticated root 200, a
  successful `settings/describe` RPC, then independent Host-only, Origin-only,
  and cross-site Fetch Metadata 403 responses, and alpha.1's cold-restart behavior: the prior signed cookie
  remains valid while the in-memory process launch credential rotates;
- `entries+batches`, bootstrap/application assignment, combo routes, stale
  revision 404, JavaScript and source-map MIME, identity/gzip equivalence,
  immutable cache headers, and `__DSH_BOOT_READY__`.

Before upload, a separate evidence scan rejects credential query strings,
cookie/authorization fields, credential-derived digest fields, session
assignments, private keys, GitHub credentials, and any standalone 43-character
base64url value.

## Candidate aggregation

The unprivileged aggregate job downloads six exact artifact names for its own
run ID and attempt (no wildcard merge). It requires exactly the six canonical filenames, regular non-symlink
bounded files, unique digests, one source identity, one workflow digest, one
run identity, canonical task order, and closed receipt fields. It recomputes
the separately persisted provenance-set file and digest plus the receipt-set
payload digest, scans the completed bundle again, and uploads a candidate whose
manifest says
`authorityEffect: none`.

The workflow gives OIDC only to a separate signer job that checks out no code,
installs no dependencies, and consumes only the already-verified handoff. It
signs the exact canonical `runtime-receipt-set.json` subject with GitHub artifact
provenance and also publishes a custom full-six-receipt predicate through the
GitHub Attestations API and Sigstore transparency log. That attestation remains
queryable after the 90-day convenience artifact expires. A final unprivileged
job verifies both bundles and validates the provenance certificate's immutable
repository/workflow/run extensions using a byte-pinned GitHub CLI. A locally fabricated set
can pass structural tests, but it cannot satisfy this signed promotion gate.

Run the same strict verifier after downloading the artifact:

```bash
node skills/dsh-harness-installer/scripts/runtime-certification.mjs verify \
  --candidate <absolute-candidate-directory> \
  --workflow <absolute-repository>/.github/workflows/alpha1-runtime-certification.yml
```

## Explicit promotion

Candidate creation never edits authority. Promotion is a separate reviewer
action and requires four absolute paths explicitly:

```bash
node skills/dsh-harness-installer/scripts/promote-runtime-authority.mjs \
  --candidate <absolute-candidate-directory> \
  --provenance <absolute-runtime-receipt-set.json.sigstore.json> \
  --authority <absolute-repository>/skills/dsh-harness-installer/references/alpha1-source-authority.json \
  --gh <absolute-byte-pinned-gh-binary>
```

The script accepts only the bundled authority path, the pending 0/6 state, a
candidate that verifies again against the bundled workflow bytes, and a clean
checkout at the exact workflow-run HEAD. It verifies the supplied GitHub CLI's
platform-specific digest before invoking that absolute binary against the
detached bundle under the closed OIDC/SLSA policy; no unsigned candidate can
reach the write. On POSIX it fsyncs a new same-directory
file and atomically renames it over the authority. Before rename, errors remove
the temporary file and leave the pending authority unchanged. If directory
fsync fails after rename, the script reports that promotion is already present
but durability is unconfirmed; it does not falsely claim rollback. Windows promotion
is fail-closed until an equivalent atomic replacement is certified.

The accepted verifier is GitHub CLI 2.93.0 with extracted executable SHA-256
`014fcd614de4de5b4a1441d298175684bad99f713d10296c5fcaaba47ac332d1`
on Linux x64 or
`a38e8ea1b9794a445a1ce746392e36111ca00a3242a6447b49cd4c162cb191a7`
on macOS arm64. The workflow additionally binds the Linux release archive to
SHA-256
`02d1290eba130e0b896f3709ffff22e1c75a51475ddb70476a85abc6b5807af0`.

No real six-task candidate is bundled by this infrastructure change. Until a
workflow run succeeds and a reviewer performs the explicit step, publication
must remain `source-build-evidence-pending`, `publishedInstallable: false`, and
0/6.
