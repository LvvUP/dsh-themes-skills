/**
 * Self-control guard plugin: intercept high-confidence attempts to terminate
 * the DeepSeek Harness host process from the bash tool, teach the model the
 * two controlled exit/restart tools (registered up front but hidden — never
 * in the model tool list, yet callable by name from outside it), and run a
 * token-confirmed graceful exit/restart through the launcher's existing seams.
 *
 * Design stance: this is a UX/interception layer, not a security boundary.
 * The matcher covers only canonical literal command forms; obfuscation,
 * interpreters, PTY, `cordis_mount`, and direct syscalls are documented
 * out-of-scope. The host process can always be killed by the OS; the guard's
 * job is to make the model reach for the controlled tools instead.
 * @module @deepseek-ai/dsh-self-control-guard
 */

import type { Context } from '@deepseek-ai/cordis'
import z from 'schemastery'
import { createHash } from 'node:crypto'
import { realpathSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { TelemetryRecord } from '@deepseek-ai/dsh-session-telemetry'
import type { UserMessage } from '@deepseek-ai/dsh-session'
import { defineTool } from '@deepseek-ai/dsh-tools'
import type { PostToolDecision, ToolExecution } from '@deepseek-ai/dsh-tools'
import { ConfirmationStore, type ConfirmationConfig } from './confirmation.js'
import { matchHostKill } from './matcher.js'
import { writeRestartManifest } from './recovery.js'
import {
  SELF_CONTROL_MATCHER_IDS,
  SELF_CONTROL_REASON_CODES,
  type SelfControlAction,
  type SelfControlEventData,
  type SelfControlMatcherId,
  type SelfControlReasonCode,
} from './types.js'

export const name = 'self-control-guard'
export const inject = ['tools', 'agents'] as const

/** Controlled-exit tool name, registered hidden (callable but never in the model tool list). */
export const SELF_EXIT_TOOL = 'dsh_self_exit'
/** Controlled-restart tool name, registered hidden (callable but never in the model tool list). */
export const SELF_RESTART_TOOL = 'dsh_self_restart'
/** Privileged-bash tool name, registered hidden (callable but never in the model tool list). */
export const SELF_BASH_TOOL = 'dsh_self_bash'

/**
 * Build the model-visible guidance pinned verbatim into the post-execute
 * context. Unavailable actions are not taught: the restart tool is omitted
 * when `restartEnabled` is false or the headless surface denies restart.
 * @param config - the guard's restart capability flags (`restartEnabled`),
 *   surface policy (`headlessRestart`), and current surface (`headless`).
 * @returns the pinned guidance text for the model transcript.
 */
export function guidanceText(config: {
  readonly restartEnabled: boolean
  readonly headlessRestart: 'deny' | 'exit-code'
  readonly headless: boolean
}): string {
  const lines = [
    'You are attempting to terminate the DeepSeek Harness host process. This command was blocked. Do not rewrite, encode, or route around the denial.',
    '',
    'For a controlled exit, call dsh_self_exit with:',
    '{"reason_code":"user-request"}',
  ]
  if (config.restartEnabled && !(config.headlessRestart === 'deny' && config.headless)) {
    lines.push(
      '',
      'For a controlled restart request, call dsh_self_restart with:',
      '{"reason_code":"apply-configuration"}',
    )
  }
  lines.push(
    '',
    'The first call returns a confirmation_token and performs no shutdown. Read that result, then call the same tool again with the unchanged reason_code and the returned confirmation_token.',
  )
  return lines.join('\n')
}

/** The default guidance for the default configuration (pinned for tests). */
export const GUIDANCE_TEXT = guidanceText({ restartEnabled: false, headlessRestart: 'deny', headless: false })

/**
 * Plugin config, validated by the schemastery schema plus load-time checks in
 * `apply` (misconfiguration fails loud: duplicate matchers, an empty matcher
 * list, a confirmation count below 2, a non-positive TTL, a negative cooldown,
 * or a restart code equal to the exit code throws at load, never silently).
 */
export interface Config {
  /** Master switch; when off every listener is inert. */
  enabled?: boolean
  /** Total tool calls the confirmation protocol requires (first arm call included); >= 2. */
  confirmationCalls?: number
  /** Milliseconds a confirmation token stays valid. */
  confirmationTtlMs?: number
  /** Milliseconds a failed confirmation attempt locks the agent's slot. */
  retryCooldownMs?: number
  /**
   * Host-kill matchers to intercept. An empty list is a misconfiguration and
   * fails loud at load; disable interception entirely with `enabled: false`.
   */
  interceptModes?: SelfControlMatcherId[]
  /** Exit code requested by `dsh_self_exit`. */
  exitCode?: number
  /**
   * Exit code requested by `dsh_self_restart`; must differ from {@link exitCode}.
   * TBD: the restart tool is hidden by default (`restartEnabled: false`); the
   * code path is retained for a future supervisor-backed restart.
   */
  restartExitCode?: number
  /**
   * Whether the restart tool is offered at all. Defaults to `false` (hidden):
   * the web surface has no supervisor, so a confirmed restart only terminates
   * the host without auto-reviving it. Set to `true` to re-enable the tool.
   * TBD: revive the restart flow once a supervisor channel exists.
   */
  restartEnabled?: boolean
  /** Headless one-shot policy for restart requests: deny or honor the exit-code protocol. */
  headlessRestart?: 'deny' | 'exit-code'
  /** Which agents may request host exit/restart: top-level only, or any live agent. */
  allowedAgents?: 'roots' | 'all'
  /**
   * Where the restart recovery manifest is written. A confirmed restart
   * records the live top-level sessions here so the next host process can
   * resume them; empty (the default) disables manifest writing — the exit
   * still happens, without a recovery roster.
   */
  manifestPath?: string
  /**
   * Privileged-bash escape hatch: an explicit, gated tool that can execute a
   * command the matcher would have blocked, for the legitimate-termination
   * false-positive case (killing another dsh instance, `$PPID` wrappers).
   * Disabled by default; when enabled it is registered up front like the exit
   * tools (hidden from the model tool list — the execution fence, not
   * disclosure timing, gates it).
   * `kill-host-pid` is excluded by design: a literal host pid has no
   * "wrong instance" ambiguity. Execution requires a command-bound
   * confirmation token plus a one-time human approval — UNLESS the calling
   * agent already runs under `danger-full-access`, which is itself an
   * explicit all-access grant. This is a UX layer, not a security boundary.
   */
  privilegedBash?: {
    /** Master switch for the escape hatch; the tool is inert when off. */
    enabled?: boolean
    /**
     * Matchers whose blocked commands may be re-executed through the tool.
     * `kill-host-pid` is rejected at load (permanent hard denial).
     */
    matchers?: SelfControlMatcherId[]
  }
}

export const Config: z<Config> = z.object({
  enabled: z.boolean().default(true),
  confirmationCalls: z.number().step(1).min(2).default(2),
  confirmationTtlMs: z.number().step(1).min(1).default(60_000),
  retryCooldownMs: z.number().step(1).min(0).default(10_000),
  interceptModes: z.array(z.union(SELF_CONTROL_MATCHER_IDS.map(id => z.const(id)))).default([...SELF_CONTROL_MATCHER_IDS]),
  exitCode: z.number().step(1).min(0).max(255).default(0),
  restartExitCode: z.number().step(1).min(1).max(255).default(42),
  restartEnabled: z.boolean().default(false),
  headlessRestart: z.union([z.const('deny'), z.const('exit-code')]).default('deny'),
  allowedAgents: z.union([z.const('roots'), z.const('all')]).default('roots'),
  manifestPath: z.string().default(''),
  privilegedBash: z.object({
    enabled: z.boolean().default(false),
    matchers: z.array(z.union(SELF_CONTROL_MATCHER_IDS.map(id => z.const(id)))).default([]),
  }),
})

/** The fully-defaulted config after schemastery validation. */
type ResolvedConfig = Required<Config> & ConfirmationConfig & {
  readonly privilegedBash: {
    readonly enabled: boolean
    readonly matchers: SelfControlMatcherId[]
  }
}

/** Fail-loud cross-field validation; every violation throws at plugin load. */
function resolveConfig(config: Config): ResolvedConfig {
  const resolved = config as ResolvedConfig
  // The recovery manifest is opt-in: the schema defaults `manifestPath` to
  // the empty string, so a default installation never writes on-disk files.
  if (resolved.exitCode === resolved.restartExitCode) {
    throw new Error(`self-control-guard: exitCode (${resolved.exitCode}) and restartExitCode (${resolved.restartExitCode}) must differ`)
  }
  if (new Set(resolved.interceptModes).size !== resolved.interceptModes.length) {
    throw new Error('self-control-guard: interceptModes must not contain duplicates')
  }
  if (resolved.interceptModes.length === 0) {
    throw new Error('self-control-guard: interceptModes must not be empty (disabling interception is done with enabled: false)')
  }
  const privileged = resolved.privilegedBash
  const privilegedMatchers = privileged.matchers
  if (new Set(privilegedMatchers).size !== privilegedMatchers.length) {
    throw new Error('self-control-guard: privilegedBash.matchers must not contain duplicates')
  }
  // The matcher re-check was relaxed: the channel runs any command the root
  // agent confirms, so the matchers list is now advisory (kept for
  // documentation and telemetry), and `kill-host-pid` is no longer excluded
  // at load — the token + approval gates carry the control surface.
  return resolved
}

/** The `{kind:'plugin'}` source stamped on every injected guidance. */
const PLUGIN_SOURCE = { kind: 'plugin', plugin: 'self-control-guard' } as const

/** Read the bash tool's `command` argument, or `undefined` when absent/non-string. */
function bashCommand(exec: ToolExecution): string | undefined {
  const value = (exec.arguments as { command?: unknown } | null)?.command
  return typeof value === 'string' ? value : undefined
}

/** The matched and configured matcher id for one bash execution, or `undefined`. */
function intercepted(
  exec: ToolExecution, hostPid: number, matchers: ReadonlySet<SelfControlMatcherId>,
): SelfControlMatcherId | undefined {
  if (exec.name !== 'bash') return undefined
  const command = bashCommand(exec)
  if (command === undefined) return undefined
  return matchHostKill(command, hostPid, matchers)
}

/** Telemetry redaction marker for a removed sensitive argument value. */
export const REDACTED_PLACEHOLDER = '[redacted by self-control-guard]'

/**
 * Redact host-kill bash commands and self-control confirmation tokens from
 * ledger telemetry records (the canonical session log is untouched — the
 * model must still read its own token). Returns the record unchanged when
 * nothing matches.
 */
/**
 * Recursively redact every sensitive copy of the guard's values in a ledger
 * record's body. The model-generated values appear in several event shapes —
 * `tool/call` (`{name, arguments}` at the top level), `assistant/message`
 * (`content[].arguments` on tool-call blocks), and (after token rendering)
 * `tool/result` — so the walk replaces any `bash` command that matches the
 * configured matchers and any `dsh_self_*` confirmation token wherever they
 * occur, without mutating the input.
 */
function redactValue(
  value: unknown,
  hostPid: number,
  matchers: ReadonlySet<SelfControlMatcherId>,
): { value: unknown; changed: boolean } {
  if (typeof value === 'string') {
    // The rendered confirmation-required text embeds the token as a stable
    // JSON fragment; the tool/result block's text carries it verbatim, so a
    // plain string walk must scrub the fragment, not just `{name, arguments}`
    // shells.
    const scrubbed = value.replace(/\{\"confirmation_token\":\"[^\"]*\"\}/g, `{\"confirmation_token\":\"${REDACTED_PLACEHOLDER}\"}`)
    return scrubbed === value ? { value, changed: false } : { value: scrubbed, changed: true }
  }
  if (Array.isArray(value)) {
    const results = value.map(item => redactValue(item, hostPid, matchers))
    if (results.some(out => out.changed)) {
      return { value: results.map(out => out.value), changed: true }
    }
    return { value, changed: false }
  }
  if (typeof value === 'object' && value !== null) {
    const record = value as Record<string, unknown>
    const name = record['name']
    const rawArguments = record['arguments']
    let changed = false
    const next: Record<string, unknown> = { ...record }
    if (typeof name === 'string' && typeof rawArguments === 'string') {
      // A `{name, arguments}` pair: redact the parsed arguments in place.
      let parsed: unknown
      try {
        parsed = JSON.parse(rawArguments)
      } catch {
        parsed = undefined
      }
      if (parsed !== undefined && typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        const args = parsed as Record<string, unknown>
        const argsNext = { ...args }
        let argsChanged = false
        if (name === 'bash' && typeof argsNext['command'] === 'string') {
          const matcherId = matchHostKill(argsNext['command'], hostPid, matchers)
          if (matcherId !== undefined) {
            argsNext['command'] = REDACTED_PLACEHOLDER
            argsChanged = true
          }
        }
        if (name === SELF_BASH_TOOL && typeof argsNext['command'] === 'string') {
          // The privileged channel only ever carries blocked commands, so its
          // command text is always sensitive.
          argsNext['command'] = REDACTED_PLACEHOLDER
          argsChanged = true
        }
        if ((name === SELF_EXIT_TOOL || name === SELF_RESTART_TOOL || name === SELF_BASH_TOOL) && typeof argsNext['confirmation_token'] === 'string') {
          argsNext['confirmation_token'] = REDACTED_PLACEHOLDER
          argsChanged = true
        }
        if (argsChanged) {
          next['arguments'] = JSON.stringify(argsNext)
          changed = true
        }
      }
    }
    for (const key of Object.keys(next)) {
      if (key === 'arguments') continue // already handled above
      const out = redactValue(next[key], hostPid, matchers)
      if (out.changed) {
        next[key] = out.value
        changed = true
      }
    }
    return changed ? { value: next, changed: true } : { value, changed: false }
  }
  return { value, changed: false }
}

function redactRecord(record: TelemetryRecord, hostPid: number, matchers: ReadonlySet<SelfControlMatcherId>): TelemetryRecord {
  if (record.channel !== 'ledger') return record
  const out = redactValue(record.body, hostPid, matchers)
  if (!out.changed) return record
  return { ...record, body: out.value }
}

/** The model-visible confirmation-required/rejected branches shared by all self-control tools. */
type SelfControlCommonResult =
  | { status: 'confirmation-required'; confirmation_token: string; remaining_calls: number; expires_at: number }
  | { status: 'rejected'; reason: string }

/** Exit/restart tool result: an accepted request dispatches a host action. */
type SelfControlResult = SelfControlCommonResult
  | { status: 'accepted'; action: SelfControlAction; exit_code: number }

/** Privileged-bash tool result: an executed command reports its exit code. */
type PrivilegedBashResult = SelfControlCommonResult
  | { status: 'executed'; exit_code: number | null }

function renderSelfControlResult(value: SelfControlResult | PrivilegedBashResult): string {
  switch (value.status) {
    case 'confirmation-required':
      // The token must reach the model: the agent loop persists only
      // `result.content` into `tool/result`, so the token rides this text as
      // a stable JSON fragment the model can parse and echo back verbatim.
      return [
        'Confirmation required. Call the same tool again with the unchanged command and the returned confirmation_token.',
        '',
        `{"confirmation_token":"${value.confirmation_token}"}`,
        `remaining_calls=${value.remaining_calls}; expires_at=${value.expires_at}`,
      ].join('\n')
    case 'accepted':
      return `Accepted: requesting a controlled ${value.action} of the DeepSeek Harness host (exit code ${value.exit_code}).`
    case 'executed':
      return value.exit_code === null
        ? 'Executed the command through the privileged bash channel.'
        : `Executed the command through the privileged bash channel (exit code ${value.exit_code}).`
    case 'rejected':
      return `Rejected: ${value.reason}.`
  }
}

/**
 * Dispatch the confirmed host exit/restart through the launcher's existing
 * seams: the headless one-shot runner exposes `ctx.headlessIo` with a
 * code-exact `exit(code)`; long-lived surfaces (web) have no custom exit-code
 * channel, so the guard reuses the launcher's SIGTERM graceful shutdown. On
 * web, a restart therefore exits with the launcher's signal code and the
 * restart semantics are carried by the supervisor's "process vanished"
 * policy — documented in the README.
 */
function requestHostExit(ctx: Context, exitCode: number): void {
  const headlessIo = ctx.get('headlessIo') as { exit(code: number): void } | undefined
  if (headlessIo !== undefined) {
    headlessIo.exit(exitCode)
    return
  }
  process.kill(process.pid, 'SIGTERM')
}

/** Bounded fallback before a forced exit dispatch. */
export const EXIT_DISPATCH_TIMEOUT_MS = 10_000

/**
 * Dispatch the confirmed exit once the agent is idle (after the accepted
 * tool result and its turn/end are committed), with a bounded fallback timer
 * so a wedged agent cannot hold the process hostage after confirmation.
 */
function scheduleHostExit(ctx: Context, agent: Agent, exitCode: number): void {
  /* v8 ignore next -- bounded fallback: forced dispatch when the agent never
  idles; the normal whenIdle path is covered by the loop test. */
  const timer = delay(() => { requestHostExit(ctx, exitCode) }, EXIT_DISPATCH_TIMEOUT_MS)
  /* v8 ignore next 2 -- the whenIdle callback runs and dispatches the exit in
  the real-loop test (io.exit is asserted); v8 misses arrow callbacks on void
  promise chains. */
  void agent.whenIdle().then(() => {
    clearTimeout(timer)
    requestHostExit(ctx, exitCode)
  })
}

/**
 * Build one controlled tool definition. `allowed` and `record` are injected
 * so the two tools share one confirmation store and one audit channel.
 */
function defineSelfControlTool(
  ctx: Context,
  toolName: string,
  action: SelfControlAction,
  config: ResolvedConfig,
  confirmations: ConfirmationStore,
  allowed: (agent: Agent | undefined) => boolean,
  record: (agent: Agent, data: SelfControlEventData) => void,
) {
  return defineTool({
    name: toolName,
    hidden: true,
    description: `Request a controlled ${action} of the DeepSeek Harness host process. The first call returns a confirmation_token and performs no shutdown; call again with the unchanged reason_code and the returned confirmation_token to confirm.`,
    parameters: {
      reason_code: {
        type: 'string',
        required: true,
        enum: [...SELF_CONTROL_REASON_CODES],
        description: 'Stable reason code; free text is not accepted.',
      },
      confirmation_token: {
        type: 'string',
        description: 'Token returned by the previous call; omit on the first call.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          status: { type: 'string', required: true, enum: ['confirmation-required', 'accepted', 'rejected'] },
          confirmation_token: { type: 'string' },
          remaining_calls: { type: 'number' },
          expires_at: { type: 'number' },
          action: { type: 'string' },
          exit_code: { type: 'number' },
          reason: { type: 'string' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: renderSelfControlResult(value as SelfControlResult) }],
    },
    execute(args: { reason_code: string; confirmation_token?: string }, exec) {
      // The standalone shim types reason_code as string; the harness schema
      // already validated it against the closed enum at the registry boundary.
      const reason = args.reason_code as SelfControlReasonCode
      const agent = exec.agent
      if (agent === undefined) {
        // No live agent: no session to authorize or audit against.
        return Promise.resolve<SelfControlResult>({ status: 'rejected', reason: 'agent-not-allowed' })
      }
      /* v8 ignore next 3 -- the non-root (subagent) fence needs a full
      subagent-provider composition to reach a live non-root agent;
      unit-level harnesses only ever create roots. The fence itself is
      exercised for undefined callers and covered for roots by every other
      case here. */
      if (!allowed(agent)) {
        record(agent, { kind: 'confirmation-rejected', action, reason, rejection: 'agent-not-allowed' })
        return Promise.resolve<SelfControlResult>({ status: 'rejected', reason: 'agent-not-allowed' })
      }
      // Headless one-shot restart is refused by default (re-running the task
      // could repeat external side effects); the code-exact exit protocol is
      // opt-in via `headlessRestart: exit-code`.
      if (action === 'restart' && config.headlessRestart === 'deny' && ctx.get('headlessIo') !== undefined) {
        record(agent, { kind: 'confirmation-rejected', action, reason, rejection: 'headless-restart-denied' })
        return Promise.resolve<SelfControlResult>({ status: 'rejected', reason: 'headless-restart-denied' })
      }
      if (args.confirmation_token === undefined) {
        // A fresh arm must not launder an active cooldown: the model cannot
        // reset the lockout by re-arming with a new token.
        if (confirmations.inCooldown(agent)) {
          record(agent, { kind: 'confirmation-rejected', action, reason, rejection: 'cooldown' })
          return Promise.resolve<SelfControlResult>({ status: 'rejected', reason: 'cooldown' })
        }
        const { token, expiresAt } = confirmations.arm(agent, action, reason, config)
        record(agent, { kind: 'confirmation-armed', action, reason })
        return Promise.resolve<SelfControlResult>({
          status: 'confirmation-required',
          confirmation_token: token,
          remaining_calls: config.confirmationCalls - 1,
          expires_at: expiresAt,
        })
      }
      const verdict = confirmations.verify(agent, action, reason, args.confirmation_token, config)
      if (verdict.verdict !== 'ok') {
        // Map the store verdict onto the audit rejection vocabulary.
        const rejection = verdict.verdict === 'invalid' ? 'invalid-token'
          : verdict.verdict === 'expired' ? 'expired-token'
            : verdict.verdict
        record(agent, { kind: 'confirmation-rejected', action, reason, rejection })
        return Promise.resolve<SelfControlResult>({ status: 'rejected', reason: verdict.verdict })
      }
      if (verdict.remaining > 0) {
        record(agent, { kind: 'confirmation-armed', action, reason })
        return Promise.resolve<SelfControlResult>({
          status: 'confirmation-required',
          confirmation_token: verdict.token,
          remaining_calls: verdict.remaining,
          expires_at: verdict.expiresAt,
        })
      }
      const exitCode = action === 'restart' ? config.restartExitCode : config.exitCode
      if (action === 'restart' && config.manifestPath !== '') {
        // Durable recovery roster: the live top-level sessions this restart
        // leaves behind, written atomically before the exit is dispatched.
        writeRestartManifest(config.manifestPath, ctx.agents.roots().map(root => ({ sessionId: root.id })))
      }
      record(agent, { kind: 'shutdown-requested', action, reason, exitCode, outcome: 'requested' })
      // The process may only exit after the accepted tool result is durable:
      // conclude the turn, then dispatch on the agent's idle (post-turn/end)
      // with a bounded fallback timer in case the agent never idles.
      exec.concludeTurn()
      scheduleHostExit(ctx, agent, exitCode)
      return Promise.resolve<SelfControlResult>({ status: 'accepted', action, exit_code: exitCode })
    },
    presentCall: (args: { reason_code: string }) => ({
      card: 'generic',
      title: `Request controlled ${action} of the host`,
      kind: 'execute',
      rawInput: args.reason_code,
    }),
  })
}

/** SHA-256 hex fingerprint of a command string (binds a token to its command). */
function commandFingerprint(command: string): string {
  return createHash('sha256').update(command, 'utf8').digest('hex')
}

/**
 * Canonicalize a filesystem path the same way the ordinary bash tool does
 * (realpath, native; fall back to the spelling on resolution failure). Kept
 * local to avoid a dependency on `@deepseek-ai/dsh-sandbox` for one helper.
 */
function canonicalPath(path: string): string {
  try {
    return realpathSync.native(path)
  } catch {
    return path
  }
}

/** Minimal structural view of the bash executor seam (`ctx.bash`). */
interface BashSeam {
  resolve(request: { command: string; signal?: AbortSignal; dshEnv?: unknown; sandboxPolicy?: unknown; workdir?: string }): unknown
  run(spec: unknown): Promise<{ exitCode: number | null; aborted?: boolean; timedOut?: boolean; signal?: string | null }>
}

/**
 * Build the `dsh_self_bash` tool: an explicit, gated escape hatch that can
 * execute a command the matcher would have blocked. The gate has three layers
 * that must ALL hold before anything runs: the agent fence, a command-bound
 * confirmation token (armed by the first call, which executes nothing), and —
 * unless the calling agent already runs under `danger-full-access` — a one-time
 * `allowed-once` human approval through `ctx.approval`. The command is
 * executed through the `ctx.bash` executor seam (same sandbox/env/cancel
 * semantics as the ordinary bash tool) but NOT through `ctx.tools.execute`,
 * which would re-enter the guard and deadlock. `kill-host-pid` is excluded at
 * load, so the tool can never re-execute a literal host pid.
 */
function definePrivilegedBashTool(
  ctx: Context,
  config: ResolvedConfig,
  confirmations: ConfirmationStore,
  rootOnly: (agent: Agent | undefined) => boolean,
  record: (agent: Agent, data: SelfControlEventData) => void,
) {
  return defineTool({
    name: SELF_BASH_TOOL,
    hidden: true,
    description: 'Execute a bash command that the self-control guard blocked, when terminating another process was the legitimate intent. '
      + 'The first call returns a confirmation_token and executes nothing; call again with the unchanged command and the returned token. '
      + 'Under a fully unrestricted sandbox the confirmed command executes directly; otherwise a one-time human approval is required.',
    parameters: {
      command: {
        type: 'string',
        required: true,
        description: 'The blocked bash command to execute, verbatim (must match the first call exactly).',
      },
      confirmation_token: {
        type: 'string',
        description: 'Token returned by the previous call; omit on the first call to arm the confirmation.',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          status: { type: 'string', required: true, enum: ['confirmation-required', 'executed', 'rejected'] },
          confirmation_token: { type: 'string' },
          remaining_calls: { type: 'number' },
          expires_at: { type: 'number' },
          exit_code: { oneOf: [{ type: 'integer' }, { type: 'null' }] },
          reason: { type: 'string' },
        },
      },
      render: (_args, value) => [{ type: 'text', text: renderSelfControlResult(value as PrivilegedBashResult) }],
    },
    execute(args: { command: string; confirmation_token?: string }, exec) {
      const agent = exec.agent
      if (agent === undefined) {
        return Promise.resolve<PrivilegedBashResult>({ status: 'rejected', reason: 'agent-not-allowed' })
      }
      /* v8 ignore next 3 -- the non-root (subagent) fence needs a full
      subagent-provider composition to reach a live non-root agent;
      unit-level harnesses only ever create roots. The fence itself is
      exercised for undefined callers and covered for roots by every other
      case here. */
      if (!rootOnly(agent)) {
        record(agent, { kind: 'confirmation-rejected', action: 'self-bash', reason: 'privileged-command', rejection: 'agent-not-allowed' })
        return Promise.resolve<PrivilegedBashResult>({ status: 'rejected', reason: 'agent-not-allowed' })
      }
      // The escape hatch runs the command as the root agent intends, without
      // re-checking that the matcher would have blocked it (the agent decides
      // the target and confirms it with the token); the root-only fence and
      // the token + approval gates remain the control surface.
      if (args.confirmation_token === undefined) {
        // First call: arm a fresh command-bound slot; a re-arm must not
        // launder an active cooldown.
        if (confirmations.inCooldown(agent)) {
          record(agent, { kind: 'confirmation-rejected', action: 'self-bash', reason: 'privileged-command', rejection: 'cooldown' })
          return Promise.resolve<PrivilegedBashResult>({ status: 'rejected', reason: 'cooldown' })
        }
        const { token, expiresAt } = confirmations.arm(
          agent, 'self-bash', 'privileged-command', config, commandFingerprint(args.command),
        )
        record(agent, { kind: 'confirmation-armed', action: 'self-bash', reason: 'privileged-command' })
        return Promise.resolve<PrivilegedBashResult>({
          status: 'confirmation-required',
          confirmation_token: token,
          remaining_calls: config.confirmationCalls - 1,
          expires_at: expiresAt,
        })
      }
      // Second+ call: verify the token, then require the command to still
      // match what was armed (fingerprint AND same matcher form).
      const verdict = confirmations.verify(agent, 'self-bash', 'privileged-command', args.confirmation_token, config)
      if (verdict.verdict !== 'ok') {
        const rejection = verdict.verdict === 'invalid' ? 'invalid-token'
          : verdict.verdict === 'expired' ? 'expired-token'
            /* v8 ignore next -- unreachable for self-bash: action/reason are
            constant, and cooldown is pre-checked before the arm above. */
            : verdict.verdict
        record(agent, { kind: 'confirmation-rejected', action: 'self-bash', reason: 'privileged-command', rejection })
        return Promise.resolve<PrivilegedBashResult>({ status: 'rejected', reason: verdict.verdict })
      }
      if (verdict.fingerprint !== commandFingerprint(args.command)) {
        // verify() may have already rotated to a next token when
        // confirmationCalls > 2; the mismatch must end the flow entirely, so
        // clear the slot to match the invariant's consumption of it.
        confirmations.clear(agent)
        record(agent, { kind: 'confirmation-rejected', action: 'self-bash', reason: 'privileged-command', rejection: 'command-mismatch' })
        return Promise.resolve<PrivilegedBashResult>({ status: 'rejected', reason: 'command-mismatch' })
      }
      if (verdict.remaining > 0) {
        record(agent, { kind: 'confirmation-armed', action: 'self-bash', reason: 'privileged-command' })
        return Promise.resolve<PrivilegedBashResult>({
          status: 'confirmation-required',
          confirmation_token: verdict.token,
          remaining_calls: verdict.remaining,
          expires_at: verdict.expiresAt,
        })
      }
      return executePrivilegedBash(ctx, agent, args.command, exec.signal, record)
    },
    presentCall: (args: { command: string }) => ({
      card: 'generic',
      title: 'Execute blocked command through the privileged bash channel',
      kind: 'execute',
      rawInput: args.command,
    }),
  })
}

/** Run the confirmed command through the bash seam, gated by approval unless full-access. */
async function executePrivilegedBash(
  ctx: Context,
  agent: Agent,
  command: string,
  signal: AbortSignal,
  record: (agent: Agent, data: SelfControlEventData) => void,
): Promise<PrivilegedBashResult> {
  // The whole post-verify phase is transactional: the token is already
  // consumed, so every exit path (policy resolve, approval, executor
  // availability, execution, abort, infra failure) must emit a terminal
  // event that consumes the armed slot in the invariant.
  try {
    // Resolve the session's sandbox policy ONCE: the same policy that decides
    // the approval requirement must be the policy the execution runs under,
    // exactly like the ordinary bash tool (a deployment default of
    // danger-full-access must not leak into a read-only session's execution).
    const sandboxPolicy = ctx.get('sandboxPolicy') as { resolve(input: { session?: unknown }): { mode?: string; workspaceRoot?: string } | undefined } | undefined
    const policy = sandboxPolicy?.resolve({ session: agent.session })
    const fullAccess = policy?.mode === 'danger-full-access'
    // The goal service (ctx.goals) is optional; an active goal marks an
    // autonomous continuation that must not be blocked on human approval,
    // matching the danger-full-access exemption.
    const goals = ctx.get('goals') as { get(agent: Agent): { phase?: string } | undefined } | undefined
    const activeGoal = goals?.get(agent)?.phase === 'active'
    let approval: 'granted' | 'full-access-exempt' = 'full-access-exempt'
    if (!fullAccess && !activeGoal) {
      // Mandatory one-time human approval; fail-closed on never/no service/cancel.
      const approver = ctx.get('approval') as { request(req: { agent: Agent; toolName: string; reason?: string; signal?: AbortSignal }): Promise<string> } | undefined
      const outcome = approver === undefined
        ? 'unavailable'
        : await approver.request({
          agent,
          toolName: SELF_BASH_TOOL,
          // Fixed, command-free reason: the command is telemetry-redacted
          // from the tool/call record, and embedding it here would create a
          // second unredacted copy in approval/asked.
          reason: `Request approval to execute a command blocked by ${SELF_BASH_TOOL}`,
          /* v8 ignore next 2 -- the registry aborts an already-aborted call
          before dispatch, so the tool body never observes signal.aborted. */
          ...signal.aborted ? {} : { signal },
        })
      if (outcome !== 'allowed-once') {
        record(agent, { kind: 'confirmation-rejected', action: 'self-bash', reason: 'privileged-command', rejection: 'approval-denied' })
        return { status: 'rejected', reason: 'approval-denied' }
      }
      approval = 'granted'
    }
    const bash = ctx.get('bash') as BashSeam | undefined
    if (bash === undefined) {
      record(agent, { kind: 'confirmation-rejected', action: 'self-bash', reason: 'privileged-command', rejection: 'bash-unavailable' })
      return { status: 'rejected', reason: 'bash-unavailable' }
    }
    // The execution inherits the session's confinement AND working directory,
    // mirroring the ordinary bash tool's per-call resolution: a resolved
    // sandbox-policy workspace root wins, else the canonical session cwd.
    const headerCwd = agent.session.header?.cwd
    const workdir = policy?.workspaceRoot ?? (headerCwd === undefined ? undefined : canonicalPath(headerCwd))
    const dshEnv = (ctx.get('bashEnv') as { collect(input: unknown): unknown } | undefined)?.collect({ agent })
    // Pre-dispatch audit: the command may terminate the host before
    // bash.run() settles, so the dispatch must be on the log FIRST — the
    // terminal `privileged-bash-executed` may never be appended.
    record(agent, {
      kind: 'privileged-bash-dispatch',
      action: 'self-bash',
      reason: 'privileged-command',
      approval,
    })
    // Durability checkpoint BEFORE the command runs: `pkill dsh`/`killall dsh`
    // can terminate the host inside the executor, so the dispatch must reach
    // durable storage first. Without a persistence listener, flush returns
    // false and the dispatch remains in-memory only — documented in README.
    const sessions = ctx.get('sessions') as { flush(session: unknown): Promise<boolean> } | undefined
    if (sessions !== undefined) {
      await sessions.flush(agent.session)
    }
    const result = await bash.run(bash.resolve({
      command,
      ...policy === undefined ? {} : { sandboxPolicy: policy },
      ...workdir === undefined ? {} : { workdir },
      ...dshEnv === undefined ? {} : { dshEnv },
      // The registry aborts an already-aborted call before dispatch, so the
      // signal is always live here; pass it straight through.
      signal,
    }))
    // An aborted or timed-out run is NOT a successful execution: mirror the
    // ordinary bash tool's abort semantics (the registry would surface it as
    // an abort anyway) instead of auditing a success. A normal signal death
    // (exitCode null, aborted false) is a completed run and audits with no
    // exit code.
    if (result.aborted === true) {
      record(agent, { kind: 'confirmation-rejected', action: 'self-bash', reason: 'privileged-command', rejection: 'aborted' })
      return { status: 'rejected', reason: 'aborted' }
    }
    if (result.timedOut === true) {
      record(agent, { kind: 'confirmation-rejected', action: 'self-bash', reason: 'privileged-command', rejection: 'timed-out' })
      return { status: 'rejected', reason: 'timed-out' }
    }
    const data: SelfControlEventData = {
      kind: 'privileged-bash-executed',
      action: 'self-bash',
      reason: 'privileged-command',
      approval,
      ...result.exitCode === null ? {} : { exitCode: result.exitCode },
    }
    record(agent, data)
    return { status: 'executed', exit_code: result.exitCode }
  } catch (error) {
    // Any post-verify failure (policy resolve, approval, bashEnv collect,
    // executor seam) is terminal: the token is consumed, so emit the
    // bash-unavailable rejection to end the slot in the invariant.
    record(agent, { kind: 'confirmation-rejected', action: 'self-bash', reason: 'privileged-command', rejection: 'bash-unavailable' })
    // Fixed message: the raw exception text can carry the (redacted) command
    // and must never reach the model or the ledger.
    return { status: 'rejected', reason: 'bash-execution-failed' }
  }
}

/**
 * Install the guard listeners. All registrations are effects (tools, guard,
 * post-execute listener, telemetry redactor) and unwind on dispose/HMR.
 * @param ctx - the plugin context; requires `tools` and `agents` services.
 * @param config - validated {@link Config}; cross-field rules are re-checked fail-loud here.
 */
export function apply(ctx: Context, config: Config): void {
  const resolved = resolveConfig(config)
  const hostPid = process.pid
  const confirmations = new ConfirmationStore()
  const matchers = new Set<SelfControlMatcherId>(resolved.interceptModes)

  const allowed = (agent: Agent | undefined): boolean => {
    if (agent === undefined || resolved.allowedAgents === 'all') return agent !== undefined
    return ctx.agents.roots().includes(agent)
  }

  const record = (agent: Agent, data: SelfControlEventData): void => {
    agent.session.append('guard/self-control', data)
  }

  // The controlled tools are registered up front — hidden from the model's
  // tool list (`hidden: true` keeps them out of `schemas()`), so an
  // unassisted model never learns they exist — but they stay callable by
  // name, so a caller that learns them from outside the tool list (the
  // guard's denial text, a user instruction, another tool) can invoke them
  // immediately. Registration is an effect, so HMR unwinds the tools with
  // the fiber. `enabled: false` keeps the whole plugin inert, tools
  // included. The privileged bash channel is registered with the same
  // always-hidden schedule, but its execution fence is ALWAYS root-only,
  // independent of `allowedAgents`: a subagent must never obtain a channel
  // that can re-execute a host-kill command.
  if (resolved.enabled) {
    ctx.tools.register(defineSelfControlTool(ctx, SELF_EXIT_TOOL, 'exit', resolved, confirmations, allowed, record))
    if (resolved.restartEnabled) {
      ctx.tools.register(defineSelfControlTool(ctx, SELF_RESTART_TOOL, 'restart', resolved, confirmations, allowed, record))
    }
    if (resolved.privilegedBash.enabled) {
      ctx.tools.register(definePrivilegedBashTool(
        ctx, resolved, confirmations,
        agent => agent !== undefined && ctx.agents.roots().includes(agent),
        record,
      ))
    }
  }

  // Monotonic hard denial: a canonical host-kill command can never be
  // force-allowed by a later pre-execute listener.
  ctx.tools.guard((exec) => {
    if (!resolved.enabled) return undefined
    const matcherId = intercepted(exec, hostPid, matchers)
    if (matcherId === undefined) return undefined
    return `self-control-guard: blocked a command that targets the DeepSeek Harness host process (matcher ${matcherId}). For a controlled exit, use dsh_self_exit instead.`
  })

  // Post-execute: teach the model the controlled tools and record the
  // interception. Denied calls also flow through this waterfall, so the
  // guidance lands even for blocked attempts.
  ctx.on('tools/post-execute', async (exec, _result, next): Promise<PostToolDecision> => {
    const downstream = await next()
    if (!resolved.enabled || exec.agent === undefined) return downstream
    const matcherId = intercepted(exec, hostPid, matchers)
    if (matcherId === undefined) return downstream
    record(exec.agent, { kind: 'shell-intercepted', matcherId })
    const guidance = createUserMessage({
      content: [{ type: 'text', text: guidanceText({
        restartEnabled: resolved.restartEnabled,
        headlessRestart: resolved.headlessRestart,
        headless: ctx.get('headlessIo') !== undefined,
      }) }],
      source: { ...PLUGIN_SOURCE, form: 'notice', summary: 'host-kill intercepted — use the controlled exit/restart tools' },
    })
    return {
      ...downstream,
      additionalContexts: prependGuidance(guidance, downstream.additionalContexts),
    }
  })

  // Telemetry redaction: the canonical log keeps the real values, the
  // exported records lose the command text and the confirmation token. The
  // waterfall's `next()` runs the remaining chain on the ORIGINAL record, so
  // the guard delegates first and redacts the downstream result. `enabled:
  // false` keeps the whole plugin inert, redaction included.
  ctx.on('telemetry/record', (_record, next) => {
    const downstream = next()
    if (!resolved.enabled) return downstream
    return redactRecord(downstream, hostPid, matchers)
  })

  // Clear pending confirmation slots on teardown so HMR never leaves a
  // half-armed exit behind.
  ctx.effect(() => () => {
    for (const agent of ctx.agents.list()) confirmations.clear(agent)
  }, 'self-control-guard: confirmation cleanup')
}

/** Prepend the guard's guidance while preserving downstream contexts. */
function prependGuidance(ours: UserMessage, theirs: UserMessage[] | undefined): UserMessage[] {
  return [ours, ...theirs ?? []]
}
