/**
 * Package-owned invariant companion for `@a179-sanae/dsh-code-check`.
 * @module @a179-sanae/dsh-code-check/invariant
 */

import type { Context } from '@deepseek-ai/cordis'

const PACKAGE_NAME = '@a179-sanae/dsh-code-check'

/** A package-attributed invariant failure reported by the host registry. */
type InvariantFailure = (message: string) => never

/** Installer callback accepted by the host's invariant registry. */
type InvariantInstaller = (ctx: Context, fail: InvariantFailure) => void | Promise<void>

/** Minimal runtime contract used by the companion without a source checkout. */
interface InvariantRegistry {
  register(packageName: string, installer: InvariantInstaller): () => void
}

/** Cordis companion plugin name. */
export const name = 'code-check-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * Runtime invariant: each project's cached diagnostics must not outlive the
 * tsconfig they were produced from. Failures are reported through the host
 * registry; the engine itself degrades gracefully when tsconfig disappears.
 */
const install: InvariantInstaller = (ctx, fail) => {
  ctx.on('fs/observed', (target: unknown, observation: unknown) => {
    const displayPath = (target as { displayPath?: unknown } | undefined)?.displayPath
    const kind = (observation as { kind?: unknown } | undefined)?.kind
    if (typeof displayPath !== 'string') return
    if (kind === 'absent' && displayPath.endsWith('tsconfig.json')) {
      fail(`tsconfig.json removed at ${displayPath}: cached code-check diagnostics are stale and must be invalidated`)
    }
  })
}

/**
 * Resolve the host registry through Cordis's named service lookup. Keeping this
 * narrow local contract lets the plugin build without host source files; a
 * composed DSH profile still supplies the real `invariants` service.
 * @param ctx - Cordis context carrying the host service.
 * @returns the host invariant registry.
 * @throws {Error} when the companion is loaded without its host service.
 */
function getInvariantRegistry(ctx: Context): InvariantRegistry {
  const registry = ctx.get('invariants') as InvariantRegistry | undefined
  if (registry === undefined) {
    throw new Error(`invariant companion requires the "invariants" service for ${PACKAGE_NAME}`)
  }
  return registry
}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(getInvariantRegistry(ctx).register(PACKAGE_NAME, install))
