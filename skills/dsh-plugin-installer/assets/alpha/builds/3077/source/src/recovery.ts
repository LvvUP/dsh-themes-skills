/**
 * Restart recovery manifest: the durable roster of live top-level sessions a
 * confirmed `dsh_self_restart` leaves behind, so a fresh host process can
 * bring them back. Written atomically (random-name tmp + rename) right before
 * the exit is dispatched; consumed by the `session.resume` RPC of the new
 * process.
 *
 * The manifest is an availability aid, not a security boundary: it names
 * which persisted session logs were live at restart time. Resume still goes
 * through the ordinary servable-session checks.
 * @module @deepseek-ai/dsh-self-control-guard
 */

import { randomBytes, randomUUID } from 'node:crypto'
import { closeSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeSync } from 'node:fs'
import { dirname, join } from 'node:path'
/** One roster entry: the session identity (non-empty by construction). */
export interface RestartManifestSession {
  readonly sessionId: string
}

/** The durable restart recovery roster. */
export interface RestartRecoveryManifest {
  readonly version: 0
  readonly restartId: string
  readonly createdAt: number
  readonly sessions: readonly RestartManifestSession[]
}

/**
 * Atomically write the recovery manifest: a random-name exclusive tmp file in
 * the same directory (0600, never following an existing symlink), fsync-less
 * write, then rename; the tmp is cleaned up on failure.
 * @param filePath - destination manifest path.
 * @param sessions - the live top-level sessions captured at restart time.
 * @param now - clock for `createdAt` (injectable for tests).
 * @param uuid - restart-id factory (injectable for tests).
 * @param randomName - tmp-name entropy (injectable for tests).
 * @returns the written manifest.
 */
export function writeRestartManifest(
  filePath: string,
  sessions: readonly RestartManifestSession[],
  now: number = Date.now(),
  uuid: () => string = randomUUID,
  randomName: () => string = () => randomBytes(16).toString('hex'),
): RestartRecoveryManifest {
  const manifest: RestartRecoveryManifest = {
    version: 0,
    restartId: uuid(),
    createdAt: now,
    sessions: sessions.map(({ sessionId }) => ({ sessionId })),
  }
  const dir = dirname(filePath)
  mkdirSync(dir, { recursive: true })
  const tmp = join(dir, `.${process.pid}.${randomName()}.tmp`)
  let fd: number | undefined
  try {
    fd = openSync(tmp, 'wx', 0o600)
    writeSync(fd, `${JSON.stringify(manifest, undefined, 2)}\n`)
    renameSync(tmp, filePath)
  } catch (error) {
    if (fd !== undefined) closeSync(fd)
    rmSync(tmp, { force: true })
    throw error
  }
  closeSync(fd)
  return manifest
}

/**
 * Read and shape-validate the manifest, or return `undefined` when absent or
 * malformed (a missing file simply means "no pending recovery"). Every field
 * is checked structurally — a malformed durable file never masquerades as a
 * manifest.
 * @param filePath - manifest path.
 * @returns the parsed manifest, or `undefined`.
 */
export function readRestartManifest(filePath: string): RestartRecoveryManifest | undefined {
  let raw: string
  try {
    raw = readFileSync(filePath, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException | null)?.code === 'ENOENT') return undefined
    throw error
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return undefined
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return undefined
  const candidate = parsed as Partial<RestartRecoveryManifest>
  if (candidate.version !== 0
    || typeof candidate.restartId !== 'string' || candidate.restartId === ''
    || typeof candidate.createdAt !== 'number' || !Number.isFinite(candidate.createdAt)
    || !Array.isArray(candidate.sessions)) {
    return undefined
  }
  for (const entry of candidate.sessions) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return undefined
    const sessionId = (entry as { sessionId?: unknown }).sessionId
    if (typeof sessionId !== 'string' || sessionId === '') return undefined
  }
  return {
    version: 0,
    restartId: candidate.restartId,
    createdAt: candidate.createdAt,
    sessions: candidate.sessions.map(({ sessionId }) => ({ sessionId })),
  }
}
