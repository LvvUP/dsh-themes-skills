/**
 * Runtime boundary and Cordis activation: listens to model file mutations,
 * debounces a background `tsc --noEmit` per project, caches diagnostics, and
 * exposes the `code_check` tool to the model.
 * @module @a179-sanae/dsh-code-check/runtime
 */

import { extname, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool, type ToolRunContext } from '@deepseek-ai/dsh-tools'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import { resolveConfig, type Config } from './config.ts'
import {
  findProjectRoot,
  formatReport,
  runTypeCheck,
  type CheckResult,
} from './diagnostics.ts'

/** Minimal structural view of the fs/observed event payloads. */
interface ObservedTarget {
  displayPath: string
}
interface ObservedObservation {
  kind: 'present' | 'absent'
  version?: number
}
interface ObservedExec {
  name?: string
}

declare module '@deepseek-ai/cordis' {
  interface Events {
    'fs/observed'(target: ObservedTarget, observation: ObservedObservation, exec: ObservedExec): void
  }
}

/** One cached project state with its pending debounce timer. */
interface ProjectState {
  root: string
  result: CheckResult | undefined
  running: boolean
  dirty: boolean
  timer: NodeJS.Timeout | undefined
}

/** Host boundary the plugin talks to; fakeable in tests. */
export interface PluginRuntime {
  /** Schedule a debounced check for one project root. */
  schedule(root: string): void
  /** Run a check immediately and cache the result. */
  check(root: string, signal?: AbortSignal): Promise<CheckResult>
  /** Latest result for a root, if any. */
  peek(root: string): CheckResult | undefined
  /** All known project roots, newest-checked first. */
  roots(): string[]
  dispose(): void
}

/**
 * Create the production runtime from a scoped Cordis context.
 * @param ctx - Scoped plugin context.
 * @param config - Resolved plugin configuration.
 * @returns Host-facing runtime adapter.
 */
export function createPluginRuntime(ctx: Context, config: ReturnType<typeof resolveConfig>): PluginRuntime {
  const states = new Map<string, ProjectState>()
  const byRecency: string[] = []
  const disposed = new AbortController()

  function touch(root: string): void {
    const index = byRecency.indexOf(root)
    if (index >= 0) byRecency.splice(index, 1)
    byRecency.unshift(root)
    while (byRecency.length > config.cacheCap) {
      const evicted = byRecency.pop()
      if (evicted === undefined) break
      const state = states.get(evicted)
      if (state?.timer !== undefined) clearTimeout(state.timer)
      states.delete(evicted)
    }
  }

  async function check(root: string, signal?: AbortSignal): Promise<CheckResult> {
    const state = states.get(root) ?? { root, result: undefined, running: false, dirty: false, timer: undefined }
    states.set(root, state)
    touch(root)
    // An explicit check supersedes any pending debounced one, so the debounce
    // timer must not fire a second tsc afterwards.
    if (state.timer !== undefined) {
      clearTimeout(state.timer)
      state.timer = undefined
    }
    if (state.running) {
      state.dirty = true
      return state.result ?? {
        root,
        tsconfig: join(root, 'tsconfig.json'),
        diagnostics: [],
        ok: false,
        error: 'another type check is still running; call code_check again shortly',
        checkedAt: Date.now(),
      }
    }
    state.running = true
    let completed = false
    try {
      let result: CheckResult
      try {
        result = await runTypeCheck(root, {
          timeoutMs: config.tscTimeoutMs,
          signal: signal === undefined ? disposed.signal : AbortSignal.any([signal, disposed.signal]),
          extraArgs: config.extraArgs,
        })
      } catch (error) {
        // Engine failures (timeouts, spawn errors) degrade into a check result
        // so the code_check tool always returns a message instead of rejecting.
        result = {
          root,
          tsconfig: join(root, 'tsconfig.json'),
          diagnostics: [],
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          checkedAt: Date.now(),
        }
      }
      state.result = result
      ctx.logger.info(`code-check: ${result.ok ? `${result.diagnostics.length} diagnostics` : `unavailable: ${result.error ?? ''}`} for ${root}`)
      completed = true
      return result
    } finally {
      state.running = false
      if (completed && state.dirty && !disposed.signal.aborted && !signal?.aborted) {
        state.dirty = false
        return check(root, signal)
      }
      state.dirty = false
    }
  }

  function schedule(root: string): void {
    const state = states.get(root) ?? { root, result: undefined, running: false, dirty: false, timer: undefined }
    states.set(root, state)
    if (state.timer !== undefined) clearTimeout(state.timer)
    state.timer = setTimeout(() => {
      state.timer = undefined
      void check(root).catch(() => undefined)
    }, config.debounceMs)
  }

  return {
    schedule,
    check,
    peek(root) {
      return states.get(root)?.result
    },
    roots() {
      return [...byRecency]
    },
    dispose() {
      // Abort in-flight checks so no tsc survives plugin teardown, and make
      // the finally branch stop dirty re-runs after disposal.
      disposed.abort()
      for (const state of states.values()) {
        if (state.timer !== undefined) clearTimeout(state.timer)
      }
      states.clear()
      byRecency.length = 0
    },
  }
}

/** Filter events to model file mutations over configured source extensions. */
function isRelevantMutation(
  target: ObservedTarget | undefined,
  observation: ObservedObservation | undefined,
  actor: ObservedExec | undefined,
  config: ReturnType<typeof resolveConfig>,
): boolean {
  if (target === undefined || observation?.kind !== 'present') return false
  if (actor === undefined || !config.triggerTools.includes(actor.name ?? '')) return false
  return config.includeExtensions.includes(extname(target.displayPath).toLowerCase())
}

const TOOL_DESCRIPTION = `Type-check diagnostics for the current project (TypeScript).

Call this tool after editing or creating code files to learn whether the
changes introduced type errors. Projects are discovered automatically from
file edits (debounced background \`tsc --noEmit\`); on first use the caller's
workspace is scanned for a tsconfig.json and checked on demand.

Parameters:
- paths: optional relative paths (e.g. ["src/app.ts"]) to filter the report.
- run: force a fresh check instead of returning the cached report.`

/** Best-effort session workspace root from the calling agent, if any. */
function workspaceCwd(exec: ToolRunContext): string | undefined {
  const agent = exec.agent as unknown as { session?: { header?: { cwd?: string } } } | undefined
  const cwd = agent?.session?.header?.cwd
  return typeof cwd === 'string' && cwd.length > 0 ? cwd : undefined
}

/**
 * Apply the plugin to its Cordis context.
 * @param ctx - Scoped plugin context; registrations are owned by its effects.
 * @param config - Configuration resolved by Cordis from the exported schema.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved = resolveConfig(config)
  const runtime = createPluginRuntime(ctx, resolved)

  if (resolved.enabled) {
    ctx.on('fs/observed', (target: ObservedTarget, observation: ObservedObservation, actor: ObservedExec) => {
      if (!isRelevantMutation(target, observation, actor, resolved)) return
      const root = findProjectRoot(target.displayPath)
      if (root === undefined) return
      runtime.schedule(root)
    })
  }

  const disposeTool = ctx.tools.register(defineTool({
    name: 'code_check',
    description: TOOL_DESCRIPTION,
    parameters: {
      paths: {
        type: 'array',
        items: { type: 'string', description: 'Relative path filter, e.g. "src/app.ts".' },
        description: 'Optional relative paths to limit the report to.',
      },
      run: {
        type: 'boolean',
        description: 'Force a fresh tsc --noEmit run instead of the cached report.',
      },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value): ContentBlock[] => [{ type: 'text', text: value }],
    },
    isConcurrencySafe: () => true,
    execute: async (args, exec: ToolRunContext) => {
      if (!resolved.enabled) {
        return 'code_check is disabled in the plugin config (enabled: false).'
      }
      const roots = runtime.roots()
      const cachedRoot = roots[0]
      // Project discovery: cached edit-learned projects first; on first use,
      // scan the caller's workspace for a tsconfig.json and check on demand.
      const root = cachedRoot ?? (() => {
        const cwd = workspaceCwd(exec)
        if (cwd === undefined) return undefined
        return findProjectRoot(cwd)
      })()
      if (root === undefined) {
        const cwd = workspaceCwd(exec)
        if (cwd !== undefined) {
          return `No tsconfig.json found under ${cwd} (workspace scan). Projects are learned from file edits: ask the model to edit or create a source file first, then call code_check again.`
        }
        return 'No project has been checked yet. Projects are learned from file edits: ask the model to edit or create a source file in the workspace first, then call code_check again.'
      }
      let result = runtime.peek(root)
      if (result === undefined || args.run === true) {
        result = await runtime.check(root, exec.signal)
      }
      return formatReport(result, resolved.maxDiagnostics, args.paths ?? [])
    },
  }))

  ctx.effect(() => () => {
    disposeTool()
    runtime.dispose()
  })
}
