/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-self-control-guard`.
 *
 * The guard owns one observable event stream (`guard/self-control`); the
 * companion checks the confirmation protocol on the authoritative stream
 * before commit (the same `internal/dispatch` stage the session package's own
 * invariant uses): a `confirmation-rejected`/`shutdown-requested` must follow
 * a matching `confirmation-armed` for the same action (and reason for the
 * accepted shutdown), and armed transitions must carry their identifying
 * fields. A violation throws {@link InvariantError} from the append path.
 * @module @deepseek-ai/dsh-self-control-guard/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantFailure, InvariantInstaller } from '@deepseek-ai/dsh-invariants'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import type { SelfControlAction, SelfControlMatcherId, SelfControlReasonCode } from './types.js'

const PACKAGE_NAME = '@deepseek-ai/dsh-self-control-guard'

/** Cordis companion plugin name. */
export const name = 'self-control-guard-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** One session's in-flight confirmation, if any. */
interface ArmedState {
  readonly action: SelfControlAction
  readonly reason: SelfControlReasonCode
  /** Whether the privileged-bash pre-dispatch audit has been written. */
  readonly dispatched?: boolean
  /** Matcher carried by the dispatch (linked to executed). */
  readonly matcherId?: SelfControlMatcherId
  /** Approval gate carried by the dispatch (linked to executed). */
  readonly approval?: 'granted' | 'full-access-exempt'
}

/**
 * Validate each `guard/self-control` event against the per-session protocol
 * before it commits. The listeners are `{ global: true }` because the
 * companion runs in the invariants service's child fiber while sessions
 * attach to the root context — the same pattern the session package's own
 * invariant uses.
 */
const install: InvariantInstaller = Object.assign((ctx: Context, fail: InvariantFailure) => {
  const armed = new WeakMap<Session, ArmedState>()
  ctx.on('internal/dispatch', (_mode, eventName, args) => {
    if (eventName !== 'session/event') return
    const [session, event] = args as [Session, SessionEvent]
    if (event.type !== 'guard/self-control') return
    const data = event.data
    switch (data.kind) {
      case 'shell-intercepted':
        if (data.matcherId === undefined) fail('shell-intercepted must carry matcherId')
        break
      case 'privileged-bash-dispatch': {
        // The pre-dispatch audit is written BEFORE the executor runs, so a
        // command that kills the host mid-run still leaves a trace. It follows
        // the armed transition, transitions the slot to dispatched, and does
        // NOT consume it (the executed event does). Exactly one dispatch per
        // armed slot.
        const state = armed.get(session)
        if (state === undefined || state.action !== 'self-bash' || state.reason !== 'privileged-command') {
          fail('privileged-bash-dispatch must follow a self-bash/privileged-command confirmation-armed transition')
        }
        if (data.action !== 'self-bash' || data.reason !== 'privileged-command') {
          fail('privileged-bash-dispatch must carry action self-bash and reason privileged-command')
        }
        // The matcher re-check was relaxed: the channel may run any command the
        // root agent confirms, so no matcher is bound (and kill-host-pid is no
        // longer excluded here — the token + approval gates carry the control).
        if (data.approval === undefined) fail('privileged-bash-dispatch must carry the approval gate')
        if (state.dispatched) fail('privileged-bash-dispatch must not repeat for one armed slot')
        armed.set(session, {
          action: state.action, reason: state.reason, dispatched: true, approval: data.approval,
          ...data.matcherId === undefined ? {} : { matcherId: data.matcherId },
        })
        break
      }
      case 'privileged-bash-executed': {
        // The privileged-bash flow arms, dispatches (the pre-execution audit),
        // then executes; executed must follow a matching dispatched slot and
        // carry the same approval gate. No matcher is bound (the channel runs
        // any command the root agent confirms), so matcherId may be absent.
        const state = armed.get(session)
        if (state === undefined || state.action !== 'self-bash' || state.reason !== 'privileged-command' || !state.dispatched) {
          fail('privileged-bash-executed must follow a self-bash dispatch (armed then dispatched)')
        }
        if (data.action !== 'self-bash' || data.reason !== 'privileged-command') {
          fail('privileged-bash-executed must carry action self-bash and reason privileged-command')
        }
        if (data.approval === undefined) fail('privileged-bash-executed must carry the approval gate')
        if (state.matcherId !== data.matcherId || state.approval !== data.approval) {
          fail('privileged-bash-executed must match the dispatched matcher and approval gate')
        }
        armed.delete(session)
        break
      }
      case 'confirmation-armed': {
        if (data.action === undefined || data.reason === undefined) {
          fail('confirmation-armed must carry action and reason')
        }
        // Once a slot is dispatched, the token phase is over: re-arming would
        // reset the slot and let a second dispatch bypass the exactly-once
        // rule for one armed slot.
        if (armed.get(session)?.dispatched) {
          fail('confirmation-armed must not follow a privileged-bash dispatch')
        }
        armed.set(session, { action: data.action, reason: data.reason })
        break
      }
      case 'confirmation-rejected':
      case 'shutdown-requested': {
        const state = armed.get(session)
        if (state?.dispatched) {
          // A dispatched slot is mid-execution: only the executor-phase
          // rejections can follow it (`aborted`/`timed-out` from the run
          // result, `bash-unavailable` from the catch that also wraps the
          // post-dispatch flush/run), and they must carry the dispatched
          // self-bash identity. Token-phase rejections, the pre-arm policy
          // rejections, and a host exit are impossible after the dispatch in
          // the runtime — reject them.
          if (data.kind !== 'confirmation-rejected'
            || (data.rejection !== 'bash-unavailable'
              && data.rejection !== 'aborted'
              && data.rejection !== 'timed-out')) {
            fail('a dispatched slot only accepts bash-unavailable/aborted/timed-out rejections')
          }
          if (data.action !== 'self-bash' || data.reason !== 'privileged-command') {
            fail('post-dispatch rejection must carry the dispatched self-bash/privileged-command identity')
          }
          armed.delete(session)
          break
        }
        // Authorization and policy rejections (`agent-not-allowed`,
        // `headless-restart-denied`, and the privileged-bash
        // `not-blocked-command`) happen BEFORE any confirmation is armed, so
        // they are legal without a preceding armed transition (and never
        // after a dispatch, which is handled above).
        if (data.kind === 'confirmation-rejected'
          && (data.rejection === 'agent-not-allowed'
            || data.rejection === 'headless-restart-denied'
            || data.rejection === 'not-blocked-command')) {
          break
        }
        if (state === undefined) {
          // An `invalid-token` rejection with no armed slot is legal: a token
          // presented after the flow already ended (replay after a terminal
          // transition, or a token submitted with no prior arm) simply has no
          // slot — the model must re-arm. Every other no-slot rejection is a
          // protocol violation.
          if (data.kind === 'confirmation-rejected' && data.rejection === 'invalid-token') break
          fail(`${data.kind} must follow a confirmation-armed transition`)
        }
        if (data.kind === 'confirmation-rejected') {
          // With a live slot, an `invalid-token` rejection must carry the
          // slot's action and reason (the runtime store never produces a
          // mismatched invalid-token). `wrong-action` / `reason-mismatch`
          // rejections legitimately carry the presented (differing) fields,
          // so they are not validated here.
          if (data.rejection === 'invalid-token' && (data.action !== state.action || data.reason !== state.reason)) {
            fail(`invalid-token rejection action/reason must match the armed slot`)
          }
          // `aborted`/`timed-out` only exist after the executor ran, which in
          // this flow requires a dispatch first; an undispatched slot never
          // reaches the executor, so these are protocol violations here.
          if (data.rejection === 'aborted' || data.rejection === 'timed-out') {
            fail('aborted/timed-out rejection must follow a privileged-bash dispatch')
          }
          // Token-flow rejections mirror the runtime store: a wrong token
          // (`invalid-token`, `cooldown`), a mismatched action
          // (`wrong-action`), or a mismatched reason (`reason-mismatch`) do
          // NOT consume the armed slot — the model may still present the
          // correct token afterwards. An `expired-token` rejection ends the
          // slot, exactly like the store's expiry path. The post-verify-ok
          // privileged-bash rejections (`command-mismatch`,
          // `approval-denied`, `bash-unavailable`) happen AFTER the token was
          // already consumed, so they end the slot too.
          if (data.rejection === 'expired-token'
            || data.rejection === 'command-mismatch'
            || data.rejection === 'approval-denied'
            || data.rejection === 'bash-unavailable') {
            armed.delete(session)
          }
          break
        }
        // The accepted shutdown must match the armed action and reason and
        // carry the exit code; it consumes the slot.
        if (data.action !== state.action) {
          fail(`${data.kind} action ${String(data.action)} does not match the armed action ${state.action}`)
        }
        if (data.reason !== state.reason) {
          fail(`shutdown-requested reason ${String(data.reason)} does not match the armed reason ${state.reason}`)
        }
        if (data.exitCode === undefined) {
          fail('shutdown-requested must carry exitCode')
        }
        armed.delete(session)
        break
      }
    }
  }, { global: true })
}, { inject: ['sessions'] })

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
