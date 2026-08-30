# Alpha.1 source-build contract

Use this reference only when preparing, building, validating, or launching the
pinned alpha.1 checkout.

## Identity and publication boundary

The only admitted source is official tag `dsh-v0.1.2-alpha.1`, commit
`cd5ef8148158c3a752a658978873241fdf8e2bbc`, and Git tree
`a712eec535b48badc4fefb4df5176a7002e4280b`. The root lockfile is exactly
765,312 bytes with SHA-256
`506ad1fc7c40f71ce8c6afe08724fdd55020c1a527d7a7a185c559d39ecfcaf1`.

The official GitHub release has no binary assets, and the alpha.1 npm package
family is not published. A successful run of this Skill therefore produces a
local build from pinned official source. Never call it an official binary or
an npm installation.

`references/alpha1-source-authority.json` is still evidence-pending. One local
receipt never promotes it. Published installation requires all six exact
Linux/macOS/Windows × Node 22.19.0/24.15.0 receipts, an independently validated
receipt-set digest, provenance-set digest, immutable workflow/run identity,
review, and an explicit authority promotion. The strict receipt and set
schemas plus `scripts/runtime-authority.mjs` reject partial, duplicate,
out-of-order, cross-run, or source-mismatched matrices. No runtime receipt set
is bundled yet, so the current completed count remains 0/6.

The public workflow is manual-only and emits candidate evidence, never an
authority mutation. A candidate contains six canonical tuple receipts, one
receipt set, and a manifest that states `authorityEffect: none`. Its workflow
SHA-256 is computed from the checked-out workflow bytes at run time; promotion
re-hashes the same bundled path, requires the exact candidate HEAD in a clean
checkout, and validates every receipt byte and both aggregate digests. It then
requires a GitHub OIDC/Sigstore statement binding the exact receipt-set bytes
to the `main` workflow, hosted runner, source SHA, run ID, and attempt before a
same-directory atomic replacement. Missing or changed evidence leaves the
pending authority byte-for-byte unchanged.

## Filesystem and process boundary

- Clone into a new absolute destination. Refuse an existing destination,
  symlinks, mutable branches, tag-only assumptions, or a dirty checkout.
- Verify tag, commit, tree, lockfile bytes, lockfile digest, root package
  manager, root version, and the four named package manifests before install.
- Invoke pinned pnpm as
  `corepack pnpm@11.7.0 install --frozen-lockfile --ignore-scripts`; do not use
  `latest`, a global pnpm version, `npm install`, an unlocked update, or
  dependency lifecycle scripts.
- Build with the fixed `build:official` source script. This selects the
  upstream build profile; it does not convert the result into an official
  distributed binary.
- Hash the resulting `apps/cli/lib/bin.js` bytes into the private build
  receipt. Every later launcher or Plugin transaction must re-hash the exact
  regular file before trusting it; a matching Git tree alone is insufficient
  because generated `lib/` output is ignored by Git.
- Never add a symlink, shell alias, shim, package-manager global install, or
  PATH entry. Launch only with the absolute source-built
  `apps/cli/lib/bin.js` through the current Node executable.

## Receipt privacy boundary

Alpha.1 Web startup prints a URL containing a random `?token=` value and later
uses an authenticated browser cookie. Never redirect startup output into a
receipt or evidence file. A build receipt contains only the fields allowed by
`references/build-receipt.schema.json`.

Reject any added receipt property or value related to tokens, cookies,
credentials, authorization headers, launch URLs, captured output, environment
variables, browser-session secrets, or a hash/digest derived from any such
value. Build and runtime receipt validators also reject a standalone
43-character base64url value, the exact BrowserAuth secret shape, anywhere in
an individual receipt or runtime receipt set. A source, tree, or lockfile digest is permitted because it identifies
public source bytes rather than a credential.
The built CLI SHA-256 is also permitted: it binds local executable bytes and
is not derived from BrowserAuth state.

The live runtime probe holds the startup URL and browser session only in
bounded memory and immediately replaces process-output listeners with discard
handlers after readiness. It proves root 401, launch exchange 303,
authenticated root 200, a valid `settings/describe` RPC, independent Host-only,
Origin-only, and cross-site Fetch Metadata 403 responses, and alpha.1's exact
cold-restart behavior: the persistent
authority-bound cookie remains valid while the process launch credential
rotates, followed by a successful new exchange. It also proves strict Profile
YAML, entries+batches, combo URLs,
revision 404, JavaScript/source-map MIME, identity and gzip bytes, immutable
cache headers, and `__DSH_BOOT_READY__`. It records only the fixed outcome
fields in the closed receipt schema. If observed alpha.1 restart behavior does
not match the existing authority contract, the tuple fails; do not translate
the observation into the expected string or relax the receipt after the run.
