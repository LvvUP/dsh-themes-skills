/**
 * The `wikilink` settings namespace: the durable enable switch every
 * deployment can turn off from the Web settings page. Registered with the
 * settings provider at plugin load; the runtime reads the owner scope's live
 * value on every call, so a toggle takes effect without a restart.
 */
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type { SettingsScope } from '@deepseek-ai/dsh-settings'
import type { WikilinkSettings } from './contract.ts'

/**
 * The `wikilink` settings namespace. dsh 0.1.2-rc.1 removed the runtime
 * `settingsNamespace()` factory: `SettingsProvider.register` now takes the
 * namespace string directly (validated by the `SettingsNamespaceInput` type
 * and a runtime `NAMESPACE_PATTERN` check).
 */
export const WIKILINK_NAMESPACE = 'wikilink'

/** Schemastery schema of the `wikilink` namespace section. */
export const WikilinkSettingsSchema: z<WikilinkSettings> = z.object({
  enabled: z.boolean().default(true),
})

/**
 * Register the namespace with the settings provider and return its owner scope.
 * @param ctx - the plugin context carrying the settings provider.
 * @returns the owner scope backing the runtime's live enable check.
 */
export function registerWikilinkSettings(ctx: Context): SettingsScope<WikilinkSettings> {
  return ctx.settings.register(WIKILINK_NAMESPACE, WikilinkSettingsSchema, { applies: 'live' })
}
