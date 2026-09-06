import { Fragment, memo } from 'react'
import type { UseProjection } from '@deepseek-ai/dsh-api-session-controller/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '@deepseek-ai/dsh-session-stats'
import type { TokenUsageProjection } from '@deepseek-ai/dsh-token-meter'
import type {} from '../types.ts'
import { LIVE_STATS_NS } from './locales.ts'

const fullTokenCount = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

const ROW_STYLE = {
  boxSizing: 'border-box',
  color: 'var(--dsw-alias-label-tertiary)',
  display: 'flex',
  flexWrap: 'wrap',
  fontSize: '12px',
  justifyContent: 'center',
  lineHeight: '20px',
  margin: '0 auto',
  maxWidth: 'var(--dsh-chat-content-width)',
  padding: '0 var(--dsh-composer-side-clearance)',
  width: '100%',
} as const

const SEPARATOR_STYLE = { margin: '0 6px' } as const

/** Compact a token count while keeping one decimal below three scaled digits. */
export function formatTokens(value: number): string {
  const scaled = (n: number): string => n >= 100
    ? String(Math.round(n))
    : String(Math.round(n * 10) / 10)
  if (value < 1_000) return String(value)
  if (value < 1_000_000) return `${scaled(value / 1_000)}K`
  return `${scaled(value / 1_000_000)}M`
}

/** Format a cumulative token total without magnitude abbreviation. */
export function formatFullTokens(value: number): string {
  return fullTokenCount.format(value)
}

/** Format a duration as seconds below one minute and minute/second text above it. */
export function formatDuration(value: number): string {
  const seconds = value / 1_000
  if (seconds < 60) return `${Math.round(seconds * 10) / 10}s`
  const rounded = Math.round(seconds)
  return `${Math.floor(rounded / 60)}m${rounded % 60}s`
}

/** Sum the three disjoint prompt-side billing buckets. */
export function billedInputTokens(usage: TokenUsageProjection): number {
  return usage.uncachedInputTokens + usage.cacheReadTokens + usage.cacheWriteTokens
}

/** Return the provider-owned cache-hit percentage, or null before billed input exists. */
export function cacheHitPercent(usage: TokenUsageProjection): number | null {
  const billed = billedInputTokens(usage)
  return billed === 0 ? null : Math.round(usage.cacheReadTokens / billed * 100)
}

/** Props supplied by the session-scoped composer dock. */
export interface LiveStatsLineProps {
  useProjection: UseProjection
  t: TranslateNS<typeof LIVE_STATS_NS>
}

/** Plugin-owned replacement for the built-in statistics row. */
export const LiveStatsLine = memo(function LiveStatsLine({ useProjection, t }: LiveStatsLineProps) {
  const stats = useProjection('sessionStats')
  const durableUsage = useProjection('tokenUsage')
  const liveUsage = useProjection('liveTokenUsage')
  const groups: string[] = []

  if (stats !== undefined && stats.steps > 0) {
    groups.push(t('counts', { turns: stats.turns, steps: stats.steps }))
    const durations: string[] = []
    if (stats.llmMs > 0) durations.push(t('llm', { duration: formatDuration(stats.llmMs) }))
    if (stats.toolMs > 0) durations.push(t('tool', { duration: formatDuration(stats.toolMs) }))
    if (durations.length > 0) groups.push(durations.join(' · '))
    if (stats.ttftSteps > 0) {
      groups.push(t('ttftAverage', { duration: formatDuration(stats.ttftMs / stats.ttftSteps) }))
    }
  }

  if (durableUsage !== undefined) {
    const hit = cacheHitPercent(durableUsage)
    if (hit !== null) groups.push(t('cacheHit', { percent: hit }))
  }

  const displayUsage = liveUsage ?? durableUsage
  if (displayUsage !== undefined
    && (billedInputTokens(displayUsage) > 0 || displayUsage.outputTokens > 0)) {
    const estimate = liveUsage?.estimated === true ? '~' : ''
    const input = billedInputTokens(displayUsage)
    groups.push(t('tokens', {
      input: `${estimate}${formatTokens(input)}`,
      output: `${estimate}${formatTokens(displayUsage.outputTokens)}`,
      total: `${estimate}${formatFullTokens(input + displayUsage.outputTokens)}`,
    }))
  }

  if (groups.length === 0) return null
  return (
    <div style={ROW_STYLE}>
      {groups.map((group, index) => (
        <Fragment key={group}>
          {index > 0 && <span aria-hidden style={SEPARATOR_STYLE}>|</span>}
          <span>{group}</span>
        </Fragment>
      ))}
    </div>
  )
})
