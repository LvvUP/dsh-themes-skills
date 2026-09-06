import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the locale service into ClientContext.
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-session-stats'
import type {} from '../types.ts'
import { LiveStatsLine } from './LiveStatsLine.tsx'
import { en, LIVE_STATS_NS, zh } from './locales.ts'
import { TpsLine } from './TpsLine.tsx'

export {
  billedInputTokens, cacheHitPercent, formatDuration, formatFullTokens, formatTokens,
  LiveStatsLine,
} from './LiveStatsLine.tsx'
export { TpsLine, formatTokensPerSecond } from './TpsLine.tsx'

/** Client services required by the composer dock contribution. */
export const inject = ['slots', 'locale']

/** Replace the built-in statistics cell and mount the TPS row below it. */
export function apply(ctx: ClientContext): void {
  ctx.effect(
    () => ctx.locale.register(LIVE_STATS_NS, { zh, en }),
    'live-stats: dictionaries',
  )
  ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
    name: 'conversation.composer.dock',
    id: 'stats',
    order: 0,
    priority: -1,
    locale: LIVE_STATS_NS,
  }, LiveStatsLine))
  ctx.slots.inject('conversation.composer.dock', () => ctx.slots.register({
    name: 'conversation.composer.dock',
    id: 'live-tps',
    order: 1,
    locale: LIVE_STATS_NS,
  }, TpsLine))
}
