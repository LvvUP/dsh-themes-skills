/**
 * Self-control guard event vocabulary and shared types.
 *
 * The guard intercepts high-confidence attempts to terminate the DeepSeek
 * Harness host process from a bash tool call, teaches the model the two
 * controlled exit/restart tools (registered on demand, so they stay out of
 * the regular tool list until a host-kill attempt is intercepted), and runs a
 * token-confirmed shutdown/restart protocol through the launcher's existing
 * graceful-exit seams. Every `guard/self-control` event is log-only: it never
 * carries surface metadata and never enters the model transcript.
 * @module @deepseek-ai/dsh-self-control-guard
 */

import type {} from '@deepseek-ai/dsh-session'

/** The log-only event appended for every guard lifecycle transition. */
export const SELF_CONTROL_EVENT = 'guard/self-control'

/**
 * High-confidence host-kill matcher ids. A matcher is a literal, normalized
 * command form — never a substring or fuzzy match — so the set stays small
 * and the false-positive surface stays bounded. This is a UX/interception
 * layer, not a security boundary: obfuscated commands, shell functions,
 * interpreters, and same-process `cordis_mount` paths are out of scope.
 */
export type SelfControlMatcherId =
  | 'kill-host-pid'
  | 'kill-parent'
  | 'pkill-dsh'
  | 'killall-dsh'

/** Every matcher id, in stable order (mirrors {@link SelfControlMatcherId}). */
export const SELF_CONTROL_MATCHER_IDS: readonly SelfControlMatcherId[] = [
  'kill-host-pid',
  'kill-parent',
  'pkill-dsh',
  'killall-dsh',
]

/** The controlled action a confirmed tool call requests from the host. */
export type SelfControlAction = 'exit' | 'restart' | 'self-bash'

/** Fixed reason vocabulary; free text is rejected to keep `tool/call` and telemetry free of extra sensitive content. */
export type SelfControlReasonCode =
  | 'user-request'
  | 'task-complete'
  | 'apply-configuration'
  | 'recover-host'
  | 'privileged-command'

/** Every reason code, in stable order. */
export const SELF_CONTROL_REASON_CODES: readonly SelfControlReasonCode[] = [
  'user-request',
  'task-complete',
  'apply-configuration',
  'recover-host',
  'privileged-command',
]

/** Which transitions the guard records. */
export type SelfControlEventKind =
  | 'shell-intercepted'
  | 'confirmation-armed'
  | 'confirmation-rejected'
  | 'shutdown-requested'
  | 'privileged-bash-dispatch'
  | 'privileged-bash-executed'

/** Payload of the log-only `guard/self-control` event. */
export interface SelfControlEventData {
  /** The recorded transition. */
  readonly kind: SelfControlEventKind
  /** Matcher that intercepted the bash call (`shell-intercepted`) or was re-executed (`privileged-bash-dispatch`/`privileged-bash-executed`). */
  readonly matcherId?: SelfControlMatcherId
  /** The requested action; absent for `shell-intercepted`. */
  readonly action?: SelfControlAction
  /** The reason code carried by the tool call; absent for `shell-intercepted`. */
  readonly reason?: SelfControlReasonCode
  /** Rejection/denial detail for `confirmation-rejected`. */
  readonly rejection?: 'invalid-token' | 'expired-token' | 'wrong-action' | 'reason-mismatch' | 'cooldown' | 'agent-not-allowed' | 'headless-restart-denied' | 'not-blocked-command' | 'command-mismatch' | 'approval-denied' | 'bash-unavailable' | 'aborted' | 'timed-out'
  /** The exit code the confirmed request would use; present for `shutdown-requested`. */
  readonly exitCode?: number
  /** Whether the requested exit was dispatched (`requested`) or only recorded (`recorded`). */
  readonly outcome?: 'requested' | 'recorded'
  /** How a `privileged-bash-dispatch`/`privileged-bash-executed` transition cleared the gate: human approval or full-access exemption. */
  readonly approval?: 'granted' | 'full-access-exempt'
}

declare module '@deepseek-ai/dsh-session' {
  interface SessionEventMap {
    'guard/self-control': SelfControlEventData
  }
}
