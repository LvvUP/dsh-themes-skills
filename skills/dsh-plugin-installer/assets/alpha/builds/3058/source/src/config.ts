/** Validated configuration for the dsh-record-replay bundle. */

import z from '@deepseek-ai/schemastery'
import type Schema from '@deepseek-ai/schemastery'

/** User-facing configuration. Path fields are optional; the CLI resolver and environment provide fallbacks. */
export interface RecordReplayConfig {
  /** Explicit path to an open-record-replay `bin/orr.js` (or a compatible CLI). */
  cliPath?: string
  /** Path to an open-record-replay checkout; the CLI is `<repoRoot>/bin/orr.js`. */
  repoRoot?: string
  /** Workspace-relative recordings directory. Defaults to `runs`. */
  runsOut?: string
  /** Workspace-relative skill-input packages directory. Defaults to `skill-inputs`. */
  skillInputsOut?: string
}

/** Fully normalized configuration consumed at runtime. */
export interface ResolvedRecordReplayConfig {
  cliPath?: string
  repoRoot?: string
  runsOut: string
  skillInputsOut: string
}

/** Configuration schema used by Cordis. */
export const Config: Schema<RecordReplayConfig> = z.object({
  cliPath: z.string(),
  repoRoot: z.string(),
  runsOut: z.string().default('runs'),
  skillInputsOut: z.string().default('skill-inputs'),
})

/** Fail-fast configuration error, surfaced as a loud plugin-load failure. */
export class RecordReplayConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RecordReplayConfigError'
  }
}

/** Accept only a non-empty workspace-relative path without `..` traversal. */
function workspaceRelative(name: string, value: string): string {
  const trimmed = value.trim()
  if (trimmed.length === 0) {
    throw new RecordReplayConfigError(`${name} must be a non-empty workspace-relative path`)
  }
  if (trimmed.startsWith('/') || /^[A-Za-z]:[\\/]/.test(trimmed)) {
    throw new RecordReplayConfigError(`${name} must be workspace-relative (no absolute paths): ${trimmed}`)
  }
  if (trimmed.split(/[\\/]+/u).includes('..')) {
    throw new RecordReplayConfigError(`${name} must not contain '..': ${trimmed}`)
  }
  return trimmed
}

/** Normalize raw config into runtime values. */
export function resolveConfig(config: RecordReplayConfig = {}): ResolvedRecordReplayConfig {
  return {
    ...(config.cliPath !== undefined ? { cliPath: config.cliPath.trim() } : {}),
    ...(config.repoRoot !== undefined ? { repoRoot: config.repoRoot.trim() } : {}),
    runsOut: workspaceRelative('runsOut', config.runsOut ?? 'runs'),
    skillInputsOut: workspaceRelative('skillInputsOut', config.skillInputsOut ?? 'skill-inputs'),
  }
}
