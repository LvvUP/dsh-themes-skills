# Alpha.2 runtime certification

## Authority effect

`.github/workflows/alpha2-runtime-certification.yml` is manual-only and runs
only from `main`. It cannot edit authority. Its first output is an unsigned
candidate; signing and verification produce review evidence, not automatic
promotion.

The matrix contains exactly six independently executed tasks: Linux x64,
macOS arm64, and Windows x64 on exact Node 22.19.0 and 24.15.0.

## Per-task inputs

Every task independently:

1. checks out and verifies the exact official tag, commit, tree, and source
   lockfile;
2. installs the exact official npm runtime into a versioned user directory,
   using the bundled `pnpm@11.7.0` archive and frozen resolution;
3. creates a private install receipt;
4. performs the exact source cross-build and creates a private build receipt;
5. validates both receipts and their tuple binding;
6. runs all operational probes against the official npm CLI, not the source
   build;
7. runs a version cross-check against the source-built CLI without asserting
   binary equivalence.

The public tuple receipt includes the official tarball, installed CLI,
resolution-lock, private-install-receipt, source-built CLI, and
private-build-receipt digests. It also records that npm supplied no `gitHead`
or provenance attestation and that binary equivalence is not claimed.

## Required probes

- CLI reports exactly `0.1.2-alpha.2`.
- `--profile web --dump-config` returns a valid composed Cordis entry list.
- Unauthenticated root returns `401`.
- One-time launch exchange returns `303` and establishes the protected session.
- Authenticated root returns `200`.
- Host-only, Origin-only, and cross-site request attacks return `403`.
- Cold restart matches the bound alpha.2 session/launch-credential contract.
- Boot graph provides canonical `entries` and `batches`, bootstrap and
  application combo URLs, unique entry revisions, and one graph revision.
- Stale revision requests return `404`.
- JavaScript and source-map MIME types are correct.
- Both gzip and identity paths work, cache behavior is stable, and
  `__DSH_BOOT_READY__` becomes ready.

## BrowserAuth privacy

Startup output is held only in bounded process memory long enough to extract
the launch URL. The token and cookie are cleared after use. They, request
headers, launch URLs, session identifiers, and any related digest or HMAC are
forbidden in tuple receipts, aggregate candidates, logs, screenshots, and
attestations. The privacy scanner fails the task before upload if it detects
credential-shaped material.

Private build and install receipts are bounded canonical JSON with closed,
authority-bound schemas. Their required
`capturesCredentialDerivedDigest: false` assertion is validated first and then
omitted only from a temporary scanner projection because its defensive field
name intentionally matches the generic derived-credential rule. Every other
key and value still passes through the unchanged scanner, and the original
canonical receipt bytes remain the bytes bound by the public SHA-256. This
schema-aware exception does not apply to logs, public receipts, candidates, or
arbitrary evidence.

## Candidate aggregation

Aggregation accepts exactly one canonical receipt for each tuple. All six must
share repository, workflow path, workflow bytes, run ID, run attempt, and head
SHA. Receipt digests must be unique. The aggregate binds:

- all six canonical receipt bytes;
- a receipt-set payload digest;
- a full provenance-set digest;
- the exact workflow digest;
- a durable evidence predicate and candidate manifest.

Any missing task, cross-run copy, reordering, duplicate, altered workflow,
altered receipt, malformed privacy field, or invalid probe fails closed.

## Signing and explicit promotion

GitHub Actions signs the exact receipt-set bytes and the durable evidence
predicate using GitHub OIDC/Sigstore. A separate unprivileged job verifies the
detached bundles and repository/workflow/run identity. Retained signed evidence
is still candidate evidence.

Review locally with:

```bash
node <skill-dir>/scripts/runtime-certification.mjs verify \
  --candidate <absolute-candidate-directory> \
  --workflow <absolute-repository>/.github/workflows/alpha2-runtime-certification.yml
```

Only the explicit promotion command may change the bundled publication state,
and only on a clean POSIX checkout whose HEAD and workflow match the signed run.
Windows promotion is refused. Failure at any point keeps the authority at 0/6;
there is no fallback to alpha.1 or RC.2.
