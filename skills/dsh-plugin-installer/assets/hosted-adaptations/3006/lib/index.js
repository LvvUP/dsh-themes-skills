/**
 * Public plugin #3006 alpha.2 reviewed replacement — Host half.
 *
 * The only Host behavior is registration of one non-secret preference
 * namespace. Registration belongs to the settings-injection child fiber:
 * alpha.2 removes it automatically when this plugin or the settings provider
 * unloads. User values remain in settings.yaml as inert preferences.
 */
import z from '@deepseek-ai/schemastery'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'

export const name = '@dsh-themes/dsh-better-model-selector'
export const SETTINGS_NAMESPACE = 'dsh-better-model-selector'
export const FAVORITES_FIELD = 'favorites'
export const MAX_FAVORITES = 128

// Static certification probe. Presence proves only that this reviewed source
// contains the intended registration path; it is not a runtime receipt.
export const HOST_SETTINGS_PROBE = 'DSH3006_PROBE:HOST_SETTINGS_REGISTER_V1'

const FavoriteSettingsSchema = z.object({
  favorites: z.array(z.string()).max(MAX_FAVORITES).default([]),
})

function isFavoriteKey(value) {
  if (typeof value !== 'string' || value.length > 4096) return false
  let parsed
  try {
    parsed = JSON.parse(value)
  } catch {
    return false
  }
  return Array.isArray(parsed)
    && parsed.length === 2
    && parsed.every(part => typeof part === 'string' && part.length > 0 && part.length <= 1024)
}

function validatePreferences(value) {
  const favorites = value && typeof value === 'object'
    ? value.favorites
    : undefined
  if (!Array.isArray(favorites)) {
    throw new TypeError('favorites must be an array')
  }
  if (favorites.length > MAX_FAVORITES) {
    throw new RangeError(`favorites must contain at most ${MAX_FAVORITES} entries`)
  }
  const seen = new Set()
  for (const key of favorites) {
    if (!isFavoriteKey(key)) throw new TypeError('favorites contains a malformed opaque model key')
    if (seen.has(key)) throw new TypeError('favorites must not contain duplicate model keys')
    seen.add(key)
  }
}

/**
 * Register the durable namespace only while the official settings service is
 * present. Duplicate ownership fails loudly in alpha.2 settings.register().
 */
export function apply(ctx) {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(
      settingsNamespace(SETTINGS_NAMESPACE),
      FavoriteSettingsSchema,
      { applies: 'live', validate: validatePreferences },
    )
  })
}
