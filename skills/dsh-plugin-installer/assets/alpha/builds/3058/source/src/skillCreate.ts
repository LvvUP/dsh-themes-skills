/**
 * Built-in skill creation for dsh-record-replay.
 *
 * Generates skills that follow the Anthropic skills spec
 * (https://github.com/anthropics/skills — skill-creator):
 *
 *   skill-name/
 *   ├── SKILL.md            (frontmatter: name + description required)
 *   ├── references/         (optional docs)
 *   ├── scripts/            (optional deterministic code)
 *   ├── assets/             (optional output templates)
 *   └── evals/evals.json    (optional test cases)
 *
 * The deterministic parts (evidence summarization, skeleton generation,
 * frontmatter validation, install) live here as host-side tool logic; the
 * semantic parts (final description, step wording) are written by the calling
 * agent from the evidence summary, mirroring how the Anthropic skill-creator
 * works. If the host has a native Skill Creator skill, use it instead of this
 * fallback.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/** kebab-case, matching both the Anthropic skills spec and the DSH SkillRegistry. */
const SKILL_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u

/** One semantic action extracted from the evidence stream. */
export interface EvidenceAction {
  kind: string
  app?: string
  semantic?: string
}

/** Compact, model-usable summary of one recording session. */
export interface SkillEvidenceSummary {
  sessionId: string
  startedAt?: string
  endedAt?: string
  durationMs?: number
  apps: string[]
  windowTitles: string[]
  urls: string[]
  actionCounts: Record<string, number>
  actions: EvidenceAction[]
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim() !== '') return value.trim()
  }
  return undefined
}

/** Extract a compact semantic summary from an events.jsonl stream (AX full trees are skipped). */
export function summarizeEvidence(eventsPath: string): SkillEvidenceSummary {
  const text = existsSync(eventsPath) ? readFileSync(eventsPath, 'utf8') : ''
  const apps = new Set<string>()
  const windowTitles = new Set<string>()
  const urls = new Set<string>()
  const actionCounts: Record<string, number> = {}
  const actions: EvidenceAction[] = []
  let startedAt: string | undefined
  let endedAt: string | undefined

  for (const raw of text.split('\n')) {
    if (raw.trim() === '') continue
    let event: Record<string, unknown>
    try {
      event = JSON.parse(raw) as Record<string, unknown>
    } catch {
      continue
    }
    const kind = typeof event.kind === 'string' ? event.kind : 'unknown'
    const timestamp = typeof event.timestamp === 'string' ? event.timestamp : undefined
    if (kind === 'session.started') startedAt = timestamp
    if (kind === 'session.ended') endedAt = timestamp
    actionCounts[kind] = (actionCounts[kind] ?? 0) + 1

    const app = (event.app as { name?: unknown } | undefined)?.name
    if (typeof app === 'string' && app.trim() !== '') apps.add(app.trim())

    const window = event.window as { title?: unknown; url?: unknown } | undefined
    const title = firstString(window?.title)
    if (title !== undefined) windowTitles.add(title.slice(0, 120))
    const url = firstString(window?.url)
    if (url !== undefined) urls.add(url.slice(0, 200))

    if (['window.changed', 'mouse.click', 'mouse.drag', 'keyboard.text_input', 'keyboard.submit', 'selection.changed'].includes(kind)) {
      let semantic: string | undefined
      if (kind === 'mouse.click') {
        const target = (event.mouse as { target?: Record<string, unknown> } | undefined)?.target
        semantic = firstString(target?.value, target?.label, target?.title, target?.description)
      } else if (kind === 'keyboard.text_input') {
        semantic = firstString(event.text, event.value)
      } else if (kind === 'selection.changed') {
        const selection = event.selection as { text?: unknown } | undefined
        semantic = firstString(selection?.text)
      } else if (kind === 'window.changed') {
        semantic = title
      }
      actions.push({
        kind,
        ...(typeof app === 'string' ? { app } : {}),
        ...(semantic !== undefined ? { semantic: semantic.slice(0, 200) } : {}),
      })
      if (actions.length > 400) break
    }
  }

  const durationMs = startedAt !== undefined && endedAt !== undefined
    ? Math.max(0, Date.parse(endedAt) - Date.parse(startedAt))
    : undefined

  return {
    sessionId: path.basename(path.dirname(eventsPath)),
    ...(startedAt !== undefined ? { startedAt } : {}),
    ...(endedAt !== undefined ? { endedAt } : {}),
    ...(durationMs !== undefined ? { durationMs } : {}),
    apps: [...apps].sort(),
    windowTitles: [...windowTitles].slice(0, 20),
    urls: [...urls].slice(0, 20),
    actionCounts,
    actions,
  }
}

/** Validate a skill name against the kebab-case rule; returns an error string or null. */
export function validateSkillName(name: string): string | null {
  if (typeof name !== 'string' || name.trim() === '') return 'skill name must be a non-empty kebab-case string'
  const trimmed = name.trim()
  if (!SKILL_NAME_PATTERN.test(trimmed)) {
    return `invalid skill name "${trimmed}": use lowercase kebab-case, e.g. "send-file-demo"`
  }
  return null
}

/** Validate a full SKILL.md draft; returns a list of problems (empty = OK). */
export function validateSkillDraft(name: string, draft: string): string[] {
  const problems: string[] = []
  if (typeof draft !== 'string' || draft.trim() === '') {
    problems.push('draft must be a non-empty SKILL.md document')
    return problems
  }
  const match = /^---\n([\s\S]*?)\n---\n?/u.exec(draft.trimStart())
  if (match === null) {
    problems.push('draft must start with YAML frontmatter delimited by --- lines')
    return problems
  }
  const frontmatter = match[1] ?? ''
  const nameMatch = /^name:\s*(.+)$/mu.exec(frontmatter)
  const descMatch = /^description:\s*(.+)$/mu.exec(frontmatter)
  if (nameMatch === null || nameMatch[1] === undefined || nameMatch[1].trim() === '') {
    problems.push('frontmatter must declare `name`')
  } else {
    const declared = nameMatch[1].trim()
    if (declared !== name) problems.push(`frontmatter name "${declared}" does not match requested name "${name}"`)
    const invalid = validateSkillName(declared)
    if (invalid !== null) problems.push(invalid)
  }
  if (descMatch === null || descMatch[1] === undefined || descMatch[1].trim() === '') {
    problems.push('frontmatter must declare a non-empty `description` (include when to trigger and what it does)')
  }
  const body = draft.slice((match[0] ?? '').length)
  if (body.trim() === '') problems.push('SKILL.md body must not be empty')
  return problems
}

/**
 * Build a SKILL.md skeleton from evidence, following the Anthropic skills
 * anatomy: frontmatter (name/description) + progressive-disclosure body
 * (triggering, workflow, input/output, verification, privacy).
 */
export function generateSkillSkeleton(summary: SkillEvidenceSummary, name: string, description?: string): string {
  const title = name.replace(/-/gu, ' ').replace(/\b\w/gu, c => c.toUpperCase())
  const apps = summary.apps.length > 0 ? summary.apps.join('、') : '(未记录到明确的 App)'
  const stepLines = summary.actions
    .filter(a => a.kind !== 'window.changed')
    .slice(0, 12)
    .map((a, i) => {
      const target = a.semantic !== undefined ? `（${a.semantic}）` : ''
      const appPart = a.app !== undefined ? `在 ${a.app} 中` : ''
      const verb = a.kind === 'mouse.click' ? '点击'
        : a.kind === 'mouse.drag' ? '拖拽'
          : a.kind === 'keyboard.text_input' ? '输入'
            : a.kind === 'keyboard.submit' ? '提交'
              : a.kind === 'selection.changed' ? '选择'
                : a.kind
      return `${i + 1}. ${verb}${appPart}${target}`
    })

  return `---
name: ${name}
description: ${description ?? '（待补充）'}

---

# ${title}

> 由 dsh-record-replay 从一次真实演示录制生成（session ${summary.sessionId}）。
> 依据 Anthropic skills 规范（github.com/anthropics/skills）的 SKILL.md 结构与渐进式披露原则组织。

## 触发时机

（TODO：补充何时应使用本 skill —— 参考证据：在 ${apps} 中完成的操作。）

## 工作流

${stepLines.length > 0 ? stepLines.join('\n') : '（TODO：根据证据补充步骤）'}

## 输入与输出

（TODO：说明输入参数（如目标、文件路径、关键词）与预期输出格式。）

## 校验

（TODO：列出成功后应满足的检查点，例如发送/保存/发布成功、文件存在、结果可见。）

## 隐私

（TODO：列出录制证据中出现、不应写入摘要或技能内容的敏感值：账号、路径、文件名、密钥等。）

## 可复用性

- 用稳定语义目标（应用/窗口/按钮 label/URL/关键词）描述步骤，避免纯坐标。
- 关键动作（发送、上传、创建、保存）后附加校验步骤。
- 需要用户确认或参数化的输入，标注为参数。
`
}

export interface InstallSkillOptions {
  target: string
  name: string
  content: string
  overwrite: boolean
}

export interface InstallSkillResult {
  skillPath: string
  existed: boolean
  evalsPath?: string
}

/** Install one SKILL.md into `<target>/<name>/SKILL.md` (optionally creating an evals placeholder). */
export function installSkill(options: InstallSkillOptions): InstallSkillResult {
  const dir = path.join(options.target, options.name)
  const skillPath = path.join(dir, 'SKILL.md')
  const existed = existsSync(skillPath)
  if (existed && !options.overwrite) {
    throw new Error(`skill already exists at ${skillPath} (pass overwrite: true to replace it)`)
  }
  mkdirSync(dir, { recursive: true })
  writeFileSync(skillPath, options.content, 'utf8')
  const evalsPath = path.join(dir, 'evals', 'evals.json')
  if (!existsSync(evalsPath)) {
    mkdirSync(path.dirname(evalsPath), { recursive: true })
    writeFileSync(evalsPath, JSON.stringify({ skill_name: options.name, evals: [] }, null, 2) + '\n', 'utf8')
  }
  return { skillPath, existed, evalsPath }
}

/** Resolve the skill install directory: absolute, or relative to `cwd`. Defaults to `~/.agents/skills`. */
export function resolveSkillTarget(target: string | undefined, cwd: string): string {
  if (target !== undefined && target.trim() !== '') {
    const trimmed = target.trim()
    return path.isAbsolute(trimmed) ? trimmed : path.resolve(cwd, trimmed)
  }
  return path.join(os.homedir(), '.agents', 'skills')
}
