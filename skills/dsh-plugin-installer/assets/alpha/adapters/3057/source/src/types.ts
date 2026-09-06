import type { TokenUsageProjection } from '@deepseek-ai/dsh-token-meter'

/** Continuously updated session totals published by the live-stats plugin. */
export interface LiveTokenUsageProjection extends TokenUsageProjection {
  /** Whether any displayed input or output bucket still contains an estimate. */
  estimated: boolean
  /** Output throughput for the active or latest response when an interval exists. */
  tokensPerSecond?: number
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /** Live cumulative usage, estimated during streaming and corrected by provider usage. */
    liveTokenUsage: LiveTokenUsageProjection
  }
}
