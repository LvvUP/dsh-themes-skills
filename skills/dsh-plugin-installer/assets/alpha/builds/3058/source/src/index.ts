/** dsh-record-replay: DeepSeek Harness bundle for the Open Record/Replay macOS workflow recorder. */

import type { Context } from '@deepseek-ai/cordis'
import { resolveConfig, type RecordReplayConfig } from './config.ts'
import { resolveCliPath, validateCli } from './runner.ts'
import { RECORD_REPLAY_SKILL } from './skill.ts'
import { createRecordReplayTools } from './tools.ts'

export { Config } from './config.ts'
export type { RecordReplayConfig, ResolvedRecordReplayConfig } from './config.ts'
export { resolveCliPath } from './runner.ts'
export { RECORD_REPLAY_SKILL, RECORD_REPLAY_SKILL_CONTENT, RECORD_REPLAY_SKILL_NAME } from './skill.ts'
export { createRecordReplayTools } from './tools.ts'

/** Plugin display name used in diagnostics. */
export const name = 'record-replay'

/**
 * Required services: the tool registry, the skill registry, and the subprocess
 * service that runs the ORR CLI. All three ship in the dsh-base bundle.
 */
export const inject = ['tools', 'skills', 'subprocess'] as const

/**
 * Register the `open-record-replay` skill and the six `orr_*` tools. Synchronous:
 * every registration is a reversible effect on the calling fiber, so a later
 * failure (or a hot reload) unwinds them.
 */
export function apply(ctx: Context, config: RecordReplayConfig = {}): void {
  const resolved = resolveConfig(config)
  const cliPath = validateCli(resolveCliPath(resolved))

  ctx.skills.register(RECORD_REPLAY_SKILL)
  for (const tool of createRecordReplayTools(ctx, {
    cliPath,
    runsOut: resolved.runsOut,
    skillInputsOut: resolved.skillInputsOut,
  })) {
    ctx.tools.register(tool)
  }
}
