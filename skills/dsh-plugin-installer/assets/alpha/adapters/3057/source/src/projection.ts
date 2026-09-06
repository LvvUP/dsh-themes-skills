import { z } from 'zod'
import type { ContentBlock, Message, StreamChunk, TokenUsage } from '@deepseek-ai/dsh-llm'
import type { EpochHeader, SessionEvent, SurfaceEvent } from '@deepseek-ai/dsh-session'
import { isSurfaceEvent } from '@deepseek-ai/dsh-session'
import type { ProjectionDefinition } from '@deepseek-ai/dsh-session-projection'
import type { TokenUsageProjection } from '@deepseek-ai/dsh-token-meter'
import type { TokenCounter } from './tokenizer.ts'
import type { LiveTokenUsageProjection } from './types.ts'

const zeroBuckets = (): TokenUsageProjection => ({
  uncachedInputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
})

const bucketsFrom = (usage: TokenUsage): TokenUsageProjection => ({
  uncachedInputTokens: usage.inputTokens,
  outputTokens: usage.outputTokens,
  cacheReadTokens: usage.cacheReadTokens ?? 0,
  cacheWriteTokens: usage.cacheWriteTokens ?? 0,
})

const addReplacing = (
  totals: TokenUsageProjection,
  previous: TokenUsageProjection | undefined,
  next: TokenUsageProjection,
): TokenUsageProjection => ({
  uncachedInputTokens: totals.uncachedInputTokens - (previous?.uncachedInputTokens ?? 0) + next.uncachedInputTokens,
  outputTokens: totals.outputTokens - (previous?.outputTokens ?? 0) + next.outputTokens,
  cacheReadTokens: totals.cacheReadTokens - (previous?.cacheReadTokens ?? 0) + next.cacheReadTokens,
  cacheWriteTokens: totals.cacheWriteTokens - (previous?.cacheWriteTokens ?? 0) + next.cacheWriteTokens,
})

const projectionSchema = z.object({
  uncachedInputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative(),
  cacheWriteTokens: z.number().int().nonnegative(),
  estimated: z.boolean(),
  tokensPerSecond: z.number().nonnegative().optional(),
}).strict() as unknown as z.ZodType<LiveTokenUsageProjection>

interface SurfaceNode {
  seq: number
  tokens: number
}

type OutputBlock =
  | { type: 'text'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'tool-call'; id: Extract<ContentBlock, { type: 'tool-call' }>['id']; name: string; arguments: string }
  | { type: 'fixed'; block: ContentBlock }

interface ActiveStep {
  turn: number
  step: number
  buckets: TokenUsageProjection
  exact: boolean
  blocks: Array<OutputBlock | null>
  firstOutputTime?: number
  firstOutputTokens?: number
  latestOutputTime?: number
}

interface SettledSample {
  turn: number
  step: number
  buckets: TokenUsageProjection
  estimated: boolean
  tokensPerSecond?: number
}

export interface State {
  settled: TokenUsageProjection
  settledEstimates: number
  last: SettledSample | null
  surface: SurfaceNode[]
  surfaceTokens: number
  header: EpochHeader | undefined
  active: ActiveStep | null
}

// Alpha persists the internal state separately from its browser wire view.
const nonnegative = z.number().finite().nonnegative()
const count = nonnegative.int()
const bucketsSchema = z.object({
  uncachedInputTokens: count, outputTokens: count,
  cacheReadTokens: count, cacheWriteTokens: count,
}).strict()
const outputBlockSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('text'), text: z.string() }).strict(),
  z.object({ type: z.literal('reasoning'), text: z.string() }).strict(),
  z.object({ type: z.literal('tool-call'), id: z.string(), name: z.string(), arguments: z.string() }).strict(),
  z.object({ type: z.literal('fixed'), block: z.record(z.string(), z.json()) }).strict(),
])
export const liveTokenUsageStateSchema = z.object({
  settled: bucketsSchema,
  settledEstimates: count,
  last: z.object({ turn: count, step: count, buckets: bucketsSchema,
    estimated: z.boolean(), tokensPerSecond: nonnegative.optional() }).strict().nullable(),
  surface: z.array(z.object({ seq: count, tokens: count }).strict()),
  surfaceTokens: count,
  header: z.record(z.string(), z.json()).optional(),
  active: z.object({ turn: count, step: count, buckets: bucketsSchema,
    exact: z.boolean(), blocks: z.array(outputBlockSchema.nullable()),
    firstOutputTime: nonnegative.optional(), firstOutputTokens: count.optional(),
    latestOutputTime: nonnegative.optional(),
  }).strict().nullable(),
}).strict() as unknown as z.ZodType<State>

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionStateMap { liveTokenUsage: State }
}

function surfaceMessage(event: SurfaceEvent): Message {
  switch (event.type) {
    case 'user/message':
      return event.data
    case 'assistant/message':
    case 'tool/result':
      return event.data.message
  }
}

function applySurface(
  state: State,
  event: SurfaceEvent,
  counter: TokenCounter,
): Pick<State, 'surface' | 'surfaceTokens'> {
  const tokens = counter.countMessage(surfaceMessage(event))
  if (event.surfaceOp === 'append') {
    return {
      surface: [...state.surface, { seq: event.seq, tokens }],
      surfaceTokens: state.surfaceTokens + tokens,
    }
  }
  const operation = event.surfaceOp
  const start = state.surface.findIndex(node => node.seq === operation.start)
  const end = state.surface.findIndex(node => node.seq === operation.end)
  if (start === -1 || end === -1 || start > end) {
    throw new Error(
      `live-stats: replace at seq ${event.seq} has invalid current range ${operation.start}-${operation.end}`,
    )
  }
  const removed = state.surface.slice(start, end + 1)
    .reduce((sum, node) => sum + node.tokens, 0)
  return {
    surface: [
      ...state.surface.slice(0, start),
      { seq: event.seq, tokens },
      ...state.surface.slice(end + 1),
    ],
    surfaceTokens: state.surfaceTokens - removed + tokens,
  }
}

function applyOutputChunk(
  blocks: Array<OutputBlock | null>,
  chunk: StreamChunk,
): Array<OutputBlock | null> {
  const next = [...blocks]
  if ('index' in chunk) {
    while (next.length <= chunk.index) next.push(null)
  }
  switch (chunk.type) {
    case 'text-delta': {
      if (chunk.text === '') return blocks
      const previous = next[chunk.index]
      next[chunk.index] = {
        type: 'text',
        text: (previous?.type === 'text' ? previous.text : '') + chunk.text,
      }
      return next
    }
    case 'reasoning-delta': {
      if (chunk.text === '') return blocks
      const previous = next[chunk.index]
      next[chunk.index] = {
        type: 'reasoning',
        text: (previous?.type === 'reasoning' ? previous.text : '') + chunk.text,
      }
      return next
    }
    case 'tool-call-delta': {
      if (chunk.name === undefined && chunk.argumentsDelta === '') return blocks
      const previous = next[chunk.index]
      next[chunk.index] = {
        type: 'tool-call',
        id: chunk.id,
        name: chunk.name ?? (previous?.type === 'tool-call' ? previous.name : ''),
        arguments: (previous?.type === 'tool-call' ? previous.arguments : '') + chunk.argumentsDelta,
      }
      return next
    }
    case 'block-end':
      next[chunk.index] = { type: 'fixed', block: chunk.block }
      return next
    default:
      return blocks
  }
}

function outputTokens(blocks: readonly (OutputBlock | null)[], counter: TokenCounter): number {
  const content: ContentBlock[] = []
  for (const block of blocks) {
    if (block == null) continue
    content.push(block.type === 'fixed' ? block.block : block)
  }
  return counter.countAssistantOutput(content)
}

function outputDeltaTokens(chunk: StreamChunk, counter: TokenCounter): number {
  switch (chunk.type) {
    case 'text-delta':
    case 'reasoning-delta':
      return counter.countText(chunk.text)
    case 'tool-call-delta':
      return counter.countText(chunk.name ?? '') + counter.countText(chunk.argumentsDelta)
    default:
      return 0
  }
}

function rateOf(step: ActiveStep): number | undefined {
  if (step.firstOutputTime === undefined || step.latestOutputTime === undefined) return
  if (step.firstOutputTokens === undefined) return
  const elapsedMs = step.latestOutputTime - step.firstOutputTime
  const generatedTokens = step.buckets.outputTokens - step.firstOutputTokens
  if (elapsedMs <= 0 || generatedTokens <= 0) return
  return generatedTokens * 1_000 / elapsedMs
}

function exactStep(step: ActiveStep, usage: TokenUsage): ActiveStep {
  return {
    ...step,
    buckets: bucketsFrom(usage),
    exact: true,
  }
}

function view(state: State): LiveTokenUsageProjection {
  const active = state.active
  const previous = active !== null
    && state.last?.turn === active.turn
    && state.last.step === active.step
    ? state.last
    : undefined
  const buckets = active === null
    ? state.settled
    : addReplacing(state.settled, previous?.buckets, active.buckets)
  const estimates = state.settledEstimates
    - (previous?.estimated === true ? 1 : 0)
    + (active !== null && !active.exact ? 1 : 0)
  const rate = active === null ? state.last?.tokensPerSecond : rateOf(active)
  return {
    ...buckets,
    estimated: estimates > 0,
    ...(rate === undefined ? {} : { tokensPerSecond: rate }),
  }
}

/** Create the replayable live usage projection consumed by DSH Web and the TPS row. */
export function createLiveTokenUsageProjectionDefinition(
  counter: TokenCounter,
): ProjectionDefinition<'liveTokenUsage', State> {
  return {
    key: 'liveTokenUsage',
    stateSchema: liveTokenUsageStateSchema,
    init: () => ({
      settled: zeroBuckets(),
      settledEstimates: 0,
      last: null,
      surface: [],
      surfaceTokens: 0,
      header: undefined,
      active: null,
    }),
    apply: (state, event: SessionEvent) => {
      let next = state
      if (event.type === 'step/start') {
        next = {
          ...next,
          active: {
            ...event.data,
            buckets: {
              ...zeroBuckets(),
              uncachedInputTokens: counter.countHeader(state.header) + state.surfaceTokens,
            },
            exact: false,
            blocks: [],
          },
        }
      } else if (event.type === 'request/header') {
        next = {
          ...next,
          header: event.data.header,
          ...(next.active === null ? {} : {
            active: {
              ...next.active,
              buckets: {
                ...next.active.buckets,
                uncachedInputTokens: counter.countHeader(event.data.header) + state.surfaceTokens,
              },
            },
          }),
        }
      } else if (event.type === 'assistant/chunk' && next.active !== null) {
        const { chunk } = event.data
        if (chunk.type === 'usage') {
          next = { ...next, active: exactStep(next.active, chunk.usage) }
        } else {
          const blocks = applyOutputChunk(next.active.blocks, chunk)
          if (blocks !== next.active.blocks) {
            const addedTokens = outputDeltaTokens(chunk, counter)
            const tokens = chunk.type === 'block-end'
              ? outputTokens(blocks, counter)
              : next.active.buckets.outputTokens + addedTokens
            const isOutputDelta = chunk.type === 'text-delta'
              || chunk.type === 'reasoning-delta'
              || chunk.type === 'tool-call-delta'
            const advanced = isOutputDelta && addedTokens > 0
            next = {
              ...next,
              active: {
                ...next.active,
                blocks,
                buckets: { ...next.active.buckets, outputTokens: tokens },
                ...(advanced
                  ? {
                    firstOutputTime: next.active.firstOutputTime ?? event.time,
                    firstOutputTokens: next.active.firstOutputTokens ?? tokens,
                    latestOutputTime: event.time,
                  }
                  : {}),
              },
            }
          }
        }
      } else if (event.type === 'assistant/message' && next.active !== null) {
        next = {
          ...next,
          active: event.data.usage === undefined
            ? next.active
            : exactStep(next.active, event.data.usage),
        }
      } else if (event.type === 'step/end' && next.active !== null) {
        const active = next.active
        const rate = rateOf(active)
        const previous = next.last?.turn === active.turn && next.last.step === active.step
          ? next.last
          : undefined
        next = {
          ...next,
          settled: addReplacing(next.settled, previous?.buckets, active.buckets),
          settledEstimates: next.settledEstimates
          - (previous?.estimated === true ? 1 : 0)
          + (!active.exact ? 1 : 0),
          last: {
            turn: active.turn,
            step: active.step,
            buckets: active.buckets,
            estimated: !active.exact,
            ...(rate === undefined ? {} : { tokensPerSecond: rate }),
          },
          active: null,
        }
      } else if (event.type === 'turn/end'
      && event.data.reason.kind !== 'completed'
      && next.last?.turn === event.data.turn
      && next.last.estimated) {
        next = {
          ...next,
          settled: addReplacing(next.settled, next.last.buckets, zeroBuckets()),
          settledEstimates: next.settledEstimates - 1,
          last: null,
        }
      }

      if (isSurfaceEvent(event)) next = { ...next, ...applySurface(next, event, counter) }
      return next
    },
    wire: { viewSchema: projectionSchema, view },
    stateVersion: 3,
  }
}
