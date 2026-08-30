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
