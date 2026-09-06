/** Model-facing `orr_*` tool definitions for the Open Record/Replay workflow. */

import type { Context } from '@deepseek-ai/cordis'
import type { ContentBlock } from '@deepseek-ai/dsh-llm'
import {
  defineTool,
  type JsonValue,
  type ToolDefinition,
  type ToolRunContext,
  type ValueSchemaSpec,
} from '@deepseek-ai/dsh-tools'
import { existsSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { runOrrJson } from './runner.ts'
import {
  generateSkillSkeleton,
  installSkill,
  resolveSkillTarget,
  summarizeEvidence,
  validateSkillDraft,
  validateSkillName,
} from './skillCreate.ts'

const PERMISSIONS_TIMEOUT_MS = 300_000 // first call compiles the Swift recorder
const RECORD_START_TIMEOUT_MS = 300_000
const DEFAULT_TIMEOUT_MS = 60_000

const OPEN_OBJECT_SCHEMA = { type: 'object', additionalProperties: true } as const satisfies ValueSchemaSpec

function renderJson(_args: unknown, value: unknown): ContentBlock[] {
  return [{ type: 'text', text: truncate(typeof value === 'string' ? value : JSON.stringify(value, null, 2)) }]
}

function truncate(text: string, maxChars = 24_000): string {
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}\n… (truncated: ${text.length - maxChars} more characters)`
}

/** The session workspace is the CLI's working directory, so recordings land where the agent's filesystem tools can read them. */
function workspaceOf(exec: ToolRunContext, fallback: string): string {
  const agent = exec.agent as { session?: { header?: { cwd?: string } } } | undefined
  return agent?.session?.header?.cwd ?? fallback
}

export interface RecordReplayToolOptions {
  cliPath: string
  runsOut: string
  skillInputsOut: string
}

/** Build the six model-facing tools that wrap `bin/orr.js`. */
export function createRecordReplayTools(ctx: Context, options: RecordReplayToolOptions): ToolDefinition[] {
  const { cliPath, runsOut, skillInputsOut } = options
  const cwdOf = (exec: ToolRunContext): string => workspaceOf(exec, process.cwd())

  const permissionsCheck = defineTool({
    name: 'orr_permissions_check',
    description:
      'Check macOS Accessibility and Input Monitoring permissions for the Open '
      + 'Record/Replay native recorder. Run this BEFORE starting a recording. '
      + 'Reports each permission and whether the recorder is ready. The first '
      + 'call may take a few minutes because it compiles the Swift recorder.',
    parameters: {},
    output: { schema: OPEN_OBJECT_SCHEMA, render: renderJson },
    timeoutMs: PERMISSIONS_TIMEOUT_MS,
    execute(_args, exec) {
      return runOrrJson(ctx, cliPath, cwdOf(exec), ['permissions', 'check'], exec.signal, PERMISSIONS_TIMEOUT_MS)
    },
    presentCall: () => ({ card: 'generic', title: 'Check recorder permissions', rawInput: {} }),
  })

  const recordStart = defineTool({
    name: 'orr_record_start',
    description:
      'Start an Open Record/Replay session that records the user\'s real macOS '
      + 'desktop actions (clicks, drags, typed text, window/selection changes, '
      + 'app attribution) into <workspace>/<out>/sessions/<session-id>/ '
      + '(session.json + events.jsonl). Use when the user wants the agent to '
      + 'learn a desktop workflow by demonstration. AFTER starting, STOP working '
      + 'and ask the user to perform the workflow and say when they are done; '
      + 'then call orr_record_stop. The first call may take a few minutes '
      + '(compiles the Swift recorder).',
    parameters: {
      name: { type: 'string', description: 'Short recording name, e.g. "send-file-demo". Defaults to "screen-activity".' },
      out: { type: 'string', description: `Directory (relative to the session workspace) to store recordings. Defaults to "${runsOut}".` },
      requestPermissions: {
        type: 'boolean',
        description: 'When true, also open the macOS permission dialogs if they are missing. Default false.',
      },
    },
    output: { schema: OPEN_OBJECT_SCHEMA, render: renderJson },
    timeoutMs: RECORD_START_TIMEOUT_MS,
    execute(args, exec) {
      const argv = ['record', 'start', '--name', args.name ?? 'screen-activity', '--out', args.out ?? runsOut]
      if (args.requestPermissions) argv.push('--request-permissions')
      return runOrrJson(ctx, cliPath, cwdOf(exec), argv, exec.signal, RECORD_START_TIMEOUT_MS)
    },
    presentCall: (args) => ({ card: 'generic', title: 'Start Open Record/Replay recording', rawInput: args }),
  })

  const recordStop = defineTool({
    name: 'orr_record_stop',
    description:
      'Stop the running Open Record/Replay recording and finalize the session '
      + 'artifacts. Call this after the user says the demonstration is complete. '
      + 'Then validate with orr_session_validate and package with '
      + 'orr_skill_prepare.',
    parameters: {
      session: { type: 'string', description: 'Session id, or "latest" for the most recent recording. Defaults to "latest".' },
      out: { type: 'string', description: `Recordings directory (relative to the session workspace). Defaults to "${runsOut}".` },
    },
    output: { schema: OPEN_OBJECT_SCHEMA, render: renderJson },
    timeoutMs: DEFAULT_TIMEOUT_MS,
    execute(args, exec) {
      return runOrrJson(ctx, cliPath, cwdOf(exec), ['record', 'stop', args.session ?? 'latest', '--out', args.out ?? runsOut], exec.signal, DEFAULT_TIMEOUT_MS)
    },
    presentCall: (args) => ({ card: 'generic', title: 'Stop Open Record/Replay recording', rawInput: args }),
  })

  const sessionEvents = defineTool({
    name: 'orr_session_events',
    description:
      'Read the recorded event stream (events.jsonl) for a session: the primary '
      + 'evidence of what the user actually did — app/window attribution, '
      + 'mouse.click, mouse.drag, keyboard.text_input, keyboard.submit, '
      + 'selection.changed, and accessibility tree context. Use this to '
      + 'understand the demonstrated workflow before preparing a skill. Only the '
      + 'first `limit` events are returned; read the events.jsonl file directly '
      + 'for the full stream.',
    parameters: {
      session: { type: 'string', description: 'Session id, or "latest". Defaults to "latest".' },
      out: { type: 'string', description: `Recordings directory (relative to the session workspace). Defaults to "${runsOut}".` },
      limit: { type: 'integer', description: 'Maximum number of events to return. Default 50, max 500.' },
    },
    output: { schema: OPEN_OBJECT_SCHEMA, render: renderJson },
    timeoutMs: DEFAULT_TIMEOUT_MS,
    async execute(args, exec) {
      const value = await runOrrJson(ctx, cliPath, cwdOf(exec), ['session', 'events', args.session ?? 'latest', '--out', args.out ?? runsOut], exec.signal, DEFAULT_TIMEOUT_MS)
      const record = value as { session_id?: JsonValue; events?: JsonValue }
      const events = Array.isArray(record.events) ? record.events : []
      const limit = Math.min(Math.max(Number(args.limit) || 50, 1), 500)
      return {
        session_id: record.session_id ?? null,
        total_events: events.length,
        shown: Math.min(limit, events.length),
        events: events.slice(0, limit),
      }
    },
    presentCall: (args) => ({ card: 'generic', title: 'Read recorded session events', rawInput: args }),
  })

  const sessionValidate = defineTool({
    name: 'orr_session_validate',
    description:
      'Validate the recording quality of a session against the official '
      + 'Record/Replay event contract. Run after orr_record_stop and before '
      + 'orr_skill_prepare to confirm the evidence is usable.',
    parameters: {
      session: { type: 'string', description: 'Session id, or "latest". Defaults to "latest".' },
      out: { type: 'string', description: `Recordings directory (relative to the session workspace). Defaults to "${runsOut}".` },
    },
    output: { schema: OPEN_OBJECT_SCHEMA, render: renderJson },
    timeoutMs: DEFAULT_TIMEOUT_MS,
    execute(args, exec) {
      return runOrrJson(ctx, cliPath, cwdOf(exec), ['session', 'validate-recording', args.session ?? 'latest', '--out', args.out ?? runsOut], exec.signal, DEFAULT_TIMEOUT_MS)
    },
    presentCall: (args) => ({ card: 'generic', title: 'Validate recording quality', rawInput: args }),
  })

  const skillPrepare = defineTool({
    name: 'orr_skill_prepare',
    description:
      'Package a recorded session into a skill input package '
      + '(README.md + events.jsonl + session.json) under <workspace>/<out>/<session-id>/ '
      + 'for the host agent\'s native skill creator. Hand the returned package '
      + 'directory to the skill creation flow; do not stop at a summary or '
      + 'Markdown runbook.',
    parameters: {
      session: { type: 'string', description: 'Session id, or "latest". Defaults to "latest".' },
      runs: { type: 'string', description: `Recordings directory (relative to the session workspace). Defaults to "${runsOut}".` },
      out: { type: 'string', description: `Skill input packages output directory (relative to the session workspace). Defaults to "${skillInputsOut}".` },
    },
    output: { schema: OPEN_OBJECT_SCHEMA, render: renderJson },
    timeoutMs: DEFAULT_TIMEOUT_MS,
    execute(args, exec) {
      return runOrrJson(ctx, cliPath, cwdOf(exec), ['skill', 'prepare', args.session ?? 'latest', '--runs', args.runs ?? runsOut, '--out', args.out ?? skillInputsOut], exec.signal, DEFAULT_TIMEOUT_MS)
    },
    presentCall: (args) => ({ card: 'generic', title: 'Prepare skill input package', rawInput: args }),
  })

  const skillCreate = defineTool({
    name: 'orr_skill_create',
    description:
      'Create a reusable skill from a recorded session, following the '
      + 'Anthropic skills spec (github.com/anthropics/skills — skill-creator): '
      + 'install to <target>/<name>/SKILL.md with YAML frontmatter (name + '
      + 'description) and a progressive-disclosure body. If the host agent has '
      + 'a native Skill Creator skill, prefer it; this tool is the built-in '
      + 'fallback. Call ONCE WITHOUT `draft` to generate a spec-shaped skeleton '
      + 'from the evidence (plus an evals/evals.json placeholder), review and '
      + 'rewrite it (final description, steps, verification, privacy), then call '
      + 'AGAIN with the finished SKILL.md as `draft` to validate and install it. '
      + 'The skill becomes discoverable in the DSH skill catalog on the next '
      + 'model step (filesystem provider watches skill roots).',
    parameters: {
      session: { type: 'string', description: 'Session id, or "latest". Defaults to "latest".' },
      name: { type: 'string', required: true, description: 'Skill name, lowercase kebab-case, e.g. "send-file-demo".' },
      description: { type: 'string', description: 'Optional skill description. When omitted (skeleton mode), a candidate is left as a TODO for the agent to finalize.' },
      draft: { type: 'string', description: 'Optional complete SKILL.md body (frontmatter included) to validate and install instead of the generated skeleton.' },
      runs: { type: 'string', description: `Recordings directory (relative to the session workspace). Defaults to "${runsOut}".` },
      target: { type: 'string', description: 'Optional install directory (absolute or workspace-relative). Defaults to ~/.agents/skills.' },
      overwrite: { type: 'boolean', description: 'When true, replace an existing skill with the same name. Default false.' },
    },
    output: { schema: OPEN_OBJECT_SCHEMA, render: renderJson },
    timeoutMs: DEFAULT_TIMEOUT_MS,
    async execute(args, exec) {
      const name = (args.name ?? '').trim()
      const nameError = validateSkillName(name)
      if (nameError !== null) throw new Error(nameError)
      const cwd = cwdOf(exec)
      const runsDir = path.join(cwd, args.runs ?? runsOut, 'sessions')
      const sessionId = (args.session ?? 'latest').trim()
      const resolvedSession = sessionId === 'latest' ? latestSessionId(runsDir) : sessionId
      if (resolvedSession === undefined) {
        throw new Error(`no recording session found under ${runsDir} (record one first with orr_record_start)`)
      }
      const eventsPath = path.join(runsDir, resolvedSession, 'events.jsonl')
      const summary = summarizeEvidence(eventsPath)
      const target = resolveSkillTarget(args.target, cwd)

      const problems: string[] = []
      let content: string
      let status: 'installed' | 'draft-installed'
      if (args.draft !== undefined && args.draft.trim() !== '') {
        problems.push(...validateSkillDraft(name, args.draft))
        if (problems.length > 0) {
          return {
            name,
            session_id: resolvedSession,
            status: 'validation-failed',
            problems,
            next: 'Fix the reported problems and call orr_skill_create again with the corrected draft.',
          }
        }
        content = args.draft
        status = 'installed'
      } else {
        content = generateSkillSkeleton(summary, name, args.description)
        status = 'draft-installed'
      }
      const installed = installSkill({ target, name, content, overwrite: args.overwrite === true })
      const actions: JsonValue[] = summary.actions.slice(0, 60).map(a => {
        const plain: Record<string, JsonValue> = { kind: a.kind }
        if (a.app !== undefined) plain.app = a.app
        if (a.semantic !== undefined) plain.semantic = a.semantic
        return plain
      })
      return {
        name,
        session_id: resolvedSession,
        status,
        skill_path: installed.skillPath,
        ...(installed.evalsPath !== undefined ? { evals_path: installed.evalsPath } : {}),
        existed: installed.existed,
        evidence: {
          apps: summary.apps,
          urls: summary.urls,
          window_titles: summary.windowTitles,
          action_counts: summary.actionCounts,
          actions,
        },
        next: status === 'draft-installed'
          ? 'Skeleton installed. Review and rewrite the SKILL.md (description with trigger contexts, steps, verification, privacy), then call orr_skill_create again with the final body as `draft`.'
          : `Skill installed. It appears in the skill catalog on the next model step. Optionally add evals (see evals/evals.json) per the Anthropic skill-creator spec.`,
      }
    },
    presentCall: (args) => ({ card: 'generic', title: 'Create skill from recording', rawInput: args }),
  })

  return [permissionsCheck, recordStart, recordStop, sessionEvents, sessionValidate, skillPrepare, skillCreate]
}

/** Resolve "latest" to the most recently modified session directory under `sessionsDir`. */
function latestSessionId(sessionsDir: string): string | undefined {
  if (!existsSync(sessionsDir)) return undefined
  let latest: { id: string; mtime: number } | undefined
  for (const entry of readdirSync(sessionsDir)) {
    const eventsPath = path.join(sessionsDir, entry, 'events.jsonl')
    if (!existsSync(eventsPath)) continue
    const mtime = statSync(eventsPath).mtimeMs
    if (latest === undefined || mtime > latest.mtime) latest = { id: entry, mtime }
  }
  return latest?.id
}
