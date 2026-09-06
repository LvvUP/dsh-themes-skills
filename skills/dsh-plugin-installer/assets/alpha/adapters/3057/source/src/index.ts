import type { Context } from '@deepseek-ai/cordis'
import z from 'schemastery'
import type {} from '@deepseek-ai/dsh-session-projection'
import { createLiveTokenUsageProjectionDefinition } from './projection.ts'
import { createDeepSeekTokenCounter } from './tokenizer.ts'

/** Services required by the host projection plugin. */
export const inject = ['sessionProjections']

/** Plugin configuration; no tunables are required by the provider tokenizer. */
export type Config = Record<never, never>

/** Runtime schema for {@link Config}. */
export const Config: z<Config> = z.object({})

/** Register the replayable live-token projection. */
export function apply(ctx: Context, _config: Config = {}): void {
  ctx.sessionProjections.register(createLiveTokenUsageProjectionDefinition(createDeepSeekTokenCounter()))
}

export { createLiveTokenUsageProjectionDefinition, liveTokenUsageStateSchema } from './projection.ts'
export { createDeepSeekTokenCounter } from './tokenizer.ts'
export type { TokenCounter } from './tokenizer.ts'
export type { LiveTokenUsageProjection } from './types.ts'
