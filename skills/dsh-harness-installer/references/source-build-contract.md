# DSH 0.1.2-alpha.2 runtime and source cross-build contract

## Two independent artifact chains

The operational candidate is the official npm package
`@deepseek-ai/dsh@0.1.2-alpha.2`. It is pinned by tarball URL, npm integrity,
registry signature metadata, tarball SHA-256, frozen dependency lock, and the
installed CLI SHA-256 in `alpha2-release-authority.json`.

The source cross-build is the official tag `dsh-v0.1.2-alpha.2`, commit
`0a53fb55bea101816fa226bb964ae2bed71c343b`, tree
`64ccbfa8e0caa4711cd4a75717ef9e022657961b`, and root `pnpm-lock.yaml` SHA-256
`6cc109a574218f51762474455c8d72e5f7c2625aedf25e85569dba1af7adcef0`.

The npm metadata supplies neither `gitHead` nor a provenance attestation.
Consequently the two chains prove consistent identity and version behavior but
do not prove byte-for-byte or cryptographic source-to-package equivalence.
Receipts must state that boundary explicitly.

The authority separately binds the exact upstream `SAFETY.md` path, tag and
commit URLs, Git blob, byte count, and SHA-256. `verify-source.mjs` checks those
bytes before build. Preserve that official experimental-safety statement; it
does not itself certify this installer or authorize publication.

## Official npm installation

The versioned user install uses the bundled exact resolution:

- `package.json` SHA-256
  `5caa5cce90cb4e3d61c4a38573ae892263336c2a08b5439ac4c7be2eed80a5c0`
- `pnpm-workspace.yaml` SHA-256
  `35f7101cc78d762bd0f88518fdb1af2f8d9cb812aa8c43df0d35c2a93f4bfb97`
- `pnpm-lock.yaml` SHA-256
  `083152c5eaf99bd2ecad3db1b5a04aca2141b5347e7db97caca82e0ce5a09b1c`
- pnpm `11.7.0`, materialized from the bundled digest-closed archive
- integrity-checked `fetch --frozen-lockfile --ignore-scripts`, followed by
  `install --frozen-lockfile --ignore-scripts --offline`

The upstream dependency graph contains a React peer-range disagreement. The
bundled resolution records `strictPeerDependencies: false` and labels the
decision `upstream-compatible-locked-resolution`; it does not silently relax
any other identity, version, lifecycle, or digest check. The six real runtime
tasks are required to demonstrate that this exact resolution functions.

The destination must be a new `dsh-v0.1.2-alpha.2-npm` directory below the
current user's home. The package-manager store and temporary toolchain are
private install material and are removed before activation. POSIX activates by
an atomic sibling rename. Windows installs at the final path so pnpm junctions
cannot be invalidated by relocation, and an incomplete marker keeps that path
unlaunchable until final verification succeeds. PATH is never modified.

## Exact source cross-build

The source checkout must be clean, detached, and have the exact origin, tag,
commit, tree, lockfile, package-manager declaration, Node engine, build script,
and four product package manifests. Accepted task tuples are only:

- Linux x64 / Node 22.19.0 or 24.15.0
- macOS arm64 / Node 22.19.0 or 24.15.0
- Windows x64 / Node 22.19.0 or 24.15.0

The source lane materializes the same bundled exact pnpm `11.7.0`, performs an
integrity-checked fetch, then runs `install --frozen-lockfile --ignore-scripts
--offline`, followed by the upstream `build:official` script. Dependency
lifecycle scripts stay disabled; the explicit project build is separately
visible and reviewable. A source build receipt is private local evidence only
and can never authorize publication on its own.

The sanitized package-manager/build environment intentionally keeps Git outside
`PATH`. After the checkout identity probe succeeds, the builder supplies
`DSH_CLIENT_COMMIT_HASH` from that verified exact commit so the reviewed
upstream build does not need to rediscover it by spawning Git. Ambient values
for PATH, `npm_execpath`, PNPM/Corepack, Node injection, and DSH build metadata
are discarded; only the explicit platform runtime/temporary-variable whitelist
is retained. Any mismatch between the verified commit and authority aborts
before dependency or build execution.

The fixed upstream `build:web` script invokes `pnpm` by command name. The source
lane therefore creates one ephemeral, builder-created command shim whose bytes,
mode, file identity, Node path, pnpm CLI path, and pnpm CLI digest are verified
again immediately before the build. On POSIX, that same private directory also
contains fixed wrappers for `/usr/bin/dirname`, `/usr/bin/sed`, and
`/usr/bin/uname`, the three host utilities used by pnpm's generated executable
shims; their bytes and backing file identities are bound in the same check. Its
base child `PATH` contains only that builder directory and the current Node
directory; package-manager lifecycle code may prepend only `.bin` directories
from the exact frozen installation. Caller PATH entries are discarded, and the
lifecycle shell is an identity-checked absolute host shell rather than a caller
`COMSPEC` or PATH command. The lane neither invokes Corepack nor admits an
ambient pnpm or general system-command directory. This ephemeral child
environment does not edit the user's shell or persistent `PATH`.

The checkout path may not contain the platform PATH delimiter. Before
installation the builder rejects every existing ignored `node_modules` tree.
After the exact offline installation it rejects root lifecycle `.bin` entries
that could shadow Node, npm, Git, pnpm, or the three POSIX utility authorities,
writes the same fixed pnpm shim into the lifecycle-preferred root `.bin`, and
verifies both shim locations. It removes that temporary lifecycle shim after
the build and repeats the shim, utility, and shell identity checks immediately
before the fixed build.

These checks bind the deterministic builder inputs; they are not a concurrency
isolation boundary for a local actor that can rewrite the checkout or temporary
directory while the build is running. The authoritative Windows receipts use a
fresh GitHub-hosted VM with no concurrent untrusted local principal. A shared or
self-hosted runner is outside this evidence lane and must not reuse its receipts.

## Profile and BrowserAuth safety

Before a launch can mutate an existing `web` Profile, the eight governed
Profile/Home files must be copied into one new, verified, private snapshot. An
empty new `DSH_HOME` is the only no-snapshot case.

The local Web launch credential and authenticated cookie exist only in the live
process or bounded CI probe memory. Process output, request headers, credential
values, and credential-derived hashes are excluded from install, build, and
runtime receipts.

## Publication state

Upstream publication and project certification are different facts. The
official prerelease and npm package exist, while the DSH Themes authority stays
`official-npm-runtime-evidence-pending` until the complete signed six-task
candidate is explicitly reviewed and promoted. Alpha.1, RC.8, and RC.2 evidence
remains historical and is never overwritten.
