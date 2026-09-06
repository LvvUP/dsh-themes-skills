/**
 * Standalone function plugin for DeepSeek Harness: auto type-check diagnostics.
 * @module @a179-sanae/dsh-code-check
 */

/** Cordis plugin name; keep this stable after publishing. */
export const name = 'code-check'

/** Services that must exist before the plugin is applied. */
export const inject = ['tools']

export { Config } from './config.ts'
export type { ResolvedConfig } from './config.ts'
export { apply } from './runtime.ts'
export type { PluginRuntime } from './runtime.ts'
