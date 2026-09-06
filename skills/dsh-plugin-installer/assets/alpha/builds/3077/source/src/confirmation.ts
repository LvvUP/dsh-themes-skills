/**
 * Token confirmation state machine for the two self-control tools.
 *
 * A confirmed host action needs N calls: the first call arms a fresh,
 * unpredictable token (returned to the model); every later call must present
 * that token with the SAME action and reason code, and the final correct
 * presentation consumes the slot. Tokens are per-agent, per-action, per-reason,
 * time-bounded, and never stored in plaintext (only a SHA-256 digest
 * survives). Failed attempts are counted separately from successful
 * presentations: only a correct token advances the confirmation, and reaching
 * the failed-attempt ceiling arms a cooldown during which neither a retry nor
 * a fresh arm is accepted.
 * @module @deepseek-ai/dsh-self-control-guard
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Agent } from '@deepseek-ai/dsh-agent'
import type { SelfControlAction, SelfControlReasonCode } from './types.js'

/** Time-bounded confirmation knobs, validated by the owning plugin's Config. */
export interface ConfirmationConfig {
  /** Total calls the protocol requires (first arm call included); >= 2. */
  readonly confirmationCalls: number
  /** Milliseconds a token stays valid after arming. */
  readonly confirmationTtlMs: number
  /** Milliseconds a failed attempt locks the agent's confirmation slot. */
  readonly retryCooldownMs: number
}

/** Outcome of one `verify` attempt. */
export type ConfirmationVerdict =
  | { readonly verdict: 'ok'; readonly remaining: number; readonly token: string; readonly expiresAt: number; readonly fingerprint?: string }
  | { readonly verdict: 'invalid' | 'expired' | 'wrong-action' | 'reason-mismatch' | 'cooldown' }

/** One armed confirmation slot, keyed by the requesting agent. */
interface ArmedConfirmation {
  readonly action: SelfControlAction
  readonly reason: SelfControlReasonCode
  /** SHA-256 digest of the current token; the token itself is never stored. */
  readonly digest: Buffer
  readonly expiresAt: number
  /** Correct token presentations so far (the arm call does not count). */
  readonly successfulCalls: number
  /** Wrong-token attempts; reaching `confirmationCalls` arms the cooldown. */
  readonly failedAttempts: number
  /** Timestamp until which the slot refuses further attempts and re-arms. */
  readonly cooldownUntil: number
  /**
   * Opaque command fingerprint bound to the armed slot (used by
   * `dsh_self_bash` so a verified token cannot be replayed against a
   * different command); absent for the exit/restart tools.
   */
  readonly fingerprint?: string
}

function sha256(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest()
}

/**
 * Per-agent confirmation slots. One slot per agent at a time; a new arm
 * replaces the previous slot (a changed reason/action starts a fresh flow),
 * but never while the slot is in cooldown.
 */
export class ConfirmationStore {
  private readonly slots = new WeakMap<Agent, ArmedConfirmation>()

  /**
   * Whether the agent's slot is currently in cooldown (no arm, no verify).
   * @param agent - the requesting agent.
   * @returns true while the cooldown window is open.
   */
  inCooldown(agent: Agent): boolean {
    const slot = this.slots.get(agent)
    return slot !== undefined && Date.now() < slot.cooldownUntil
  }

  /**
   * Arm a new confirmation slot and return its fresh token. Replaces any
   * existing (non-cooldown) slot.
   * @param agent - the requesting agent (the slot owner).
   * @param action - the action being confirmed.
   * @param reason - the reason code carried by the call.
   * @param config - time/call bounds.
   * @param fingerprint - optional opaque command fingerprint bound to the slot
   *   (returned by `verify` so a token cannot be replayed against a different
   *   command); absent for the exit/restart tools.
   * @returns the fresh token and its expiry; the token is returned exactly once.
   */
  arm(
    agent: Agent,
    action: SelfControlAction,
    reason: SelfControlReasonCode,
    config: ConfirmationConfig,
    fingerprint?: string,
  ): { token: string; expiresAt: number } {
    const token = randomBytes(32).toString('base64url')
    const expiresAt = Date.now() + config.confirmationTtlMs
    this.slots.set(agent, {
      action,
      reason,
      digest: sha256(token),
      expiresAt,
      successfulCalls: 0,
      failedAttempts: 0,
      cooldownUntil: 0,
      ...fingerprint === undefined ? {} : { fingerprint },
    })
    return { token, expiresAt }
  }

  /**
   * Verify one presented token against the agent's slot and advance the flow.
   * The presented token must match the slot's action AND reason AND digest;
   * only a correct presentation advances `successfulCalls`. An `ok` verdict
   * with `remaining === 0` consumes the slot; `remaining > 0` returns the
   * next token. A wrong token counts as a failed attempt and, at the ceiling,
   * arms the cooldown; `expired` consumes the slot.
   * @param agent - the requesting agent.
   * @param action - the action being confirmed (must match the armed slot).
   * @param reason - the reason code (must match the armed slot).
   * @param token - the presented token.
   * @param config - time/call bounds.
   * @returns the verdict; every non-`ok` verdict is terminal for this attempt.
   */
  verify(
    agent: Agent,
    action: SelfControlAction,
    reason: SelfControlReasonCode,
    token: string,
    config: ConfirmationConfig,
  ): ConfirmationVerdict {
    const slot = this.slots.get(agent)
    if (slot === undefined) return { verdict: 'invalid' }
    if (Date.now() < slot.cooldownUntil) return { verdict: 'cooldown' }
    if (slot.action !== action) return { verdict: 'wrong-action' }
    if (slot.reason !== reason) return { verdict: 'reason-mismatch' }
    if (Date.now() > slot.expiresAt) {
      this.slots.delete(agent)
      return { verdict: 'expired' }
    }
    const presented = sha256(token)
    if (!timingSafeEqual(presented, slot.digest)) {
      // A wrong token cannot consume the slot; a persistent guesser is met
      // with a cooldown instead of an infinite retry window.
      const failedAttempts = slot.failedAttempts + 1
      this.slots.set(agent, {
        ...slot,
        failedAttempts,
        // A wrong token is terminal for the remaining confirmation chances:
        // the lockout arms once failed attempts exhaust every correct
        // presentation the flow still owes.
        ...failedAttempts >= config.confirmationCalls - 1 ? { cooldownUntil: Date.now() + config.retryCooldownMs } : {},
      })
      return { verdict: 'invalid' }
    }
    if (slot.successfulCalls + 1 >= config.confirmationCalls - 1) {
      // Final correct presentation: consume the slot and report success.
      this.slots.delete(agent)
      return { verdict: 'ok', remaining: 0, token, expiresAt: slot.expiresAt, ...slot.fingerprint === undefined ? {} : { fingerprint: slot.fingerprint } }
    }
    // Intermediate correct presentation: advance and hand out the next token.
    const next = randomBytes(32).toString('base64url')
    const expiresAt = Date.now() + config.confirmationTtlMs
    this.slots.set(agent, {
      ...slot,
      successfulCalls: slot.successfulCalls + 1,
      digest: sha256(next),
      expiresAt,
    })
    return {
      verdict: 'ok',
      remaining: config.confirmationCalls - slot.successfulCalls - 2,
      token: next,
      expiresAt,
      ...slot.fingerprint === undefined ? {} : { fingerprint: slot.fingerprint },
    }
  }

  /**
   * Drop any pending slot for an agent (dispose/HMR cleanup).
   * @param agent - the agent whose slot to clear.
   */
  clear(agent: Agent): void {
    this.slots.delete(agent)
  }
}
