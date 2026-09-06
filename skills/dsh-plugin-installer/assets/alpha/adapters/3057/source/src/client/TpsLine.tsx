import { memo } from 'react'
import type { UseProjection } from '@deepseek-ai/dsh-api-session-controller/client'
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots'
import type {} from '../types.ts'
import { LIVE_STATS_NS } from './locales.ts'

/** Props supplied by the session-scoped composer dock. */
export interface TpsLineProps {
  useProjection: UseProjection
  t: TranslateNS<typeof LIVE_STATS_NS>
}

/** Format throughput with one decimal below 100 tok/s. */
export function formatTokensPerSecond(value: number): string {
  return String(value < 100 ? Math.round(value * 10) / 10 : Math.round(value))
}

const STYLE = {
  boxSizing: 'border-box',
  color: 'var(--dsw-alias-label-tertiary)',
  fontSize: '12px',
  lineHeight: '20px',
  margin: '0 auto',
  maxWidth: 'var(--dsh-chat-content-width)',
  overflow: 'hidden',
  padding: '0 var(--dsh-composer-side-clearance)',
  textAlign: 'center',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  width: '100%',
} as const

/** Second composer-status line for active or latest response throughput. */
export const TpsLine = memo(function TpsLine({ useProjection, t }: TpsLineProps) {
  const rate = useProjection('liveTokenUsage')?.tokensPerSecond
  if (rate === undefined) return null
  return <div style={STYLE}>{t('tps', { throughput: formatTokensPerSecond(rate) })}</div>
})
