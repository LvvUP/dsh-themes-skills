/**
 * Serializable configuration, schema, and direct-call defaults.
 * @module @a179-sanae/dsh-code-check/config
 */

import z from '@deepseek-ai/schemastery'

/** Plugin configuration supplied by the profile composition. */
export interface Config {
  /** Master switch; when false the listener idles and code_check explains. */
  enabled?: boolean
  /** Debounce window after the last edit before tsc runs (ms). */
  debounceMs?: number
  /** Tool actor names whose mutations trigger a check. */
  triggerTools?: string[]
  /** File extensions that schedule a check. */
  includeExtensions?: string[]
  /** Cap on diagnostics included in one report. */
  maxDiagnostics?: number
  /** Timeout for one tsc invocation (ms). */
  tscTimeoutMs?: number
  /** Extra CLI args appended to `tsc --noEmit -p <tsconfig>`. */
  extraArgs?: string[]
  /** Max cached project states before the least-recently-checked is evicted. */
  cacheCap?: number
}

/** Configuration after defaults have been resolved. */
export interface ResolvedConfig {
  enabled: boolean
  debounceMs: number
  triggerTools: string[]
  includeExtensions: string[]
  maxDiagnostics: number
  tscTimeoutMs: number
  extraArgs: string[]
  cacheCap: number
}

/** Loader-visible configuration schema and defaults. */
export const Config: z<Config> = z.object({
  enabled: z.boolean().default(true),
  debounceMs: z.number().min(50).default(800),
  triggerTools: z.array(z.string()).default(['edit', 'write']),
  includeExtensions: z.array(z.string()).default(['.ts', '.tsx', '.mts', '.cts']),
  maxDiagnostics: z.number().min(1).default(120),
  tscTimeoutMs: z.number().min(1000).default(60000),
  extraArgs: z.array(z.string()).default(['--incremental']),
  cacheCap: z.number().min(1).default(200),
})

const DEFAULTS: ResolvedConfig = {
  enabled: true,
  debounceMs: 800,
  triggerTools: ['edit', 'write'],
  includeExtensions: ['.ts', '.tsx', '.mts', '.cts'],
  maxDiagnostics: 120,
  tscTimeoutMs: 60000,
  extraArgs: ['--incremental'],
  cacheCap: 200,
}

/**
 * Resolve the same defaults for direct callers that bypass Cordis Loader.
 * @param config - Partial serialized configuration.
 * @returns Configuration with all defaults applied.
 */
export function resolveConfig(config: Config = {}): ResolvedConfig {
  return {
    enabled: config.enabled ?? DEFAULTS.enabled,
    debounceMs: config.debounceMs ?? DEFAULTS.debounceMs,
    triggerTools: config.triggerTools ?? DEFAULTS.triggerTools,
    includeExtensions: config.includeExtensions ?? DEFAULTS.includeExtensions,
    maxDiagnostics: config.maxDiagnostics ?? DEFAULTS.maxDiagnostics,
    tscTimeoutMs: config.tscTimeoutMs ?? DEFAULTS.tscTimeoutMs,
    extraArgs: config.extraArgs ?? DEFAULTS.extraArgs,
    cacheCap: config.cacheCap ?? DEFAULTS.cacheCap,
  }
}
