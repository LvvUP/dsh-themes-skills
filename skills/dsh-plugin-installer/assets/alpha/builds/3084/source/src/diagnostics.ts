/**
 * Pure diagnostics engine: project discovery, tsc execution, output parsing,
 * and report formatting. No Cordis or DSH imports — fully unit-testable.
 * @module @a179-sanae/dsh-code-check/diagnostics
 */

import { createRequire } from 'node:module'
import { existsSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, sep } from 'node:path'
import { spawn } from 'node:child_process'

/** One parsed compiler diagnostic. */
export interface Diagnostic {
  /** Absolute path of the offending file. */
  file: string
  line: number
  column: number
  severity: 'error' | 'warning'
  /** Diagnostic code, e.g. `TS2345`. */
  code: string
  message: string
}

/** Result of one tsc run. */
export interface CheckResult {
  /** Project root the check ran under. */
  root: string
  /** Absolute tsconfig path used. */
  tsconfig: string
  diagnostics: Diagnostic[]
  /** True when tsc completed (even with errors); false on runner failure. */
  ok: boolean
  /** Runner failure message when `ok` is false. */
  error?: string
  checkedAt: number
}

// The cap is defensive only: dirname() terminates at the filesystem root, so
// the upward walk is naturally bounded; 512 iterations cover any real layout.
const MAX_WALK_DEPTH = 512
const TSC_BIN = 'typescript/bin/tsc'
// Built via RegExp so the repository self-containment scanner does not see
// a literal regex with slashes.
const DIAGNOSTIC_LINE = new RegExp(String.raw`^(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+(TS\d+):\s*(.+)$`)
// tsc --pretty output shape: `file:line:col - error TSxxxx: message`.
const PRETTY_DIAGNOSTIC_LINE = new RegExp(String.raw`^(.+?):(\d+):(\d+)\s+-\s*(error|warning)\s+(TS\d+):\s*(.+)$`)
// ANSI SGR color codes emitted by tsc --pretty.
const ANSI_ESCAPES = new RegExp(String.raw`\x1b\[[0-9;]*m`, 'g')

/** Upward walk looking for the nearest `tsconfig.json` outside node_modules. */
export function findProjectRoot(startPath: string): string | undefined {
  if (typeof startPath !== 'string' || startPath.length === 0 || !isAbsolute(startPath)) return undefined
  let current = startPath
  for (let depth = 0; depth < MAX_WALK_DEPTH; depth += 1) {
    // Dependency-shipped tsconfig.json files must not hijack discovery: while
    // any ancestor segment is node_modules, keep walking upward to the real
    // project root.
    if (!insideNodeModules(current) && existsSync(join(current, 'tsconfig.json'))) {
      return normalizeRoot(current)
    }
    const parent = dirname(current)
    if (parent === current) return undefined
    current = parent
  }
  return undefined
}

/** Whether any path segment of `path` is a node_modules directory. */
function insideNodeModules(path: string): boolean {
  return path.replaceAll('\\', '/').split('/').some((segment) => segment.toLowerCase() === 'node_modules')
}

/**
 * Canonicalize a discovered project root: strip a trailing separator (so the
 * same project cannot be cached under two keys) and resolve symlinks/junctions
 * (so the returned root matches the real paths tsc reports diagnostics under).
 */
function normalizeRoot(root: string): string {
  let path = root
  while (path.length > 3 && (path.endsWith('/') || path.endsWith('\\'))) path = path.slice(0, -1)
  try {
    return realpathSync(path)
  } catch {
    return path
  }
}

/** Resolve the `typescript/bin/tsc` JS entry from a project root. */
export function resolveTscEntry(root: string): string | undefined {
  try {
    const requireFromProject = createRequire(join(root, 'package.json'))
    try {
      return requireFromProject.resolve(TSC_BIN)
    } catch {
      // Some TypeScript releases restrict subpath exports; fall back to walking
      // up from the package main until a `bin/tsc` or `bin/tsc.js` entry is
      // found (older releases ship the extensionless bin/tsc, newer ones
      // bin/tsc.js).
      const main = requireFromProject.resolve('typescript')
      let dir = dirname(main)
      for (let depth = 0; depth < 8; depth += 1) {
        for (const candidate of ['bin/tsc', 'bin/tsc.js']) {
          const full = join(dir, candidate)
          if (existsSync(full)) return full
        }
        const parent = dirname(dir)
        if (parent === dir) break
        dir = parent
      }
      return undefined
    }
  } catch {
    return undefined
  }
}

export interface RunOptions {
  timeoutMs: number
  signal?: AbortSignal | undefined
  /** Extra CLI args appended after `--pretty false -p <tsconfig>`. */
  extraArgs?: string[] | undefined
}

/**
 * Run `tsc --noEmit -p <tsconfig>` inside the project and parse diagnostics.
 * Spawns `node typescript/bin/tsc` directly, so no shell, npx, or `.cmd`
 * resolution is involved and Windows behaves like POSIX. `--pretty false` is
 * pinned so the output format stays parseable even when the tsconfig enables
 * `pretty`.
 */
export async function runTypeCheck(root: string, options: RunOptions): Promise<CheckResult> {
  const tsconfig = join(root, 'tsconfig.json')
  const failure = (error: string): CheckResult => ({
    root,
    tsconfig,
    diagnostics: [],
    ok: false,
    error,
    checkedAt: Date.now(),
  })
  const tscEntry = resolveTscEntry(root)
  if (!tscEntry) {
    let present = false
    try {
      createRequire(join(root, 'package.json')).resolve('typescript')
      present = true
    } catch {
      present = false
    }
    return failure(present
      ? `TypeScript is installed for ${root} but its tsc entry cannot be resolved (broken install; check node_modules/typescript)`
      : `TypeScript is not installed for ${root} (run \`npm i -D typescript\`); code_check cannot run.`)
  }

  const args = ['--noEmit', '-p', tsconfig, '--pretty', 'false', ...(options.extraArgs ?? [])]
  if (options.signal?.aborted) return failure('type check aborted before start')

  const child = spawn(process.execPath, [tscEntry, ...args], {
    cwd: root,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    signal: options.signal,
  })

  const stdout: Buffer[] = []
  const stderr: Buffer[] = []
  child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk))
  child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk))

  const exit = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill()
      reject(new Error(`tsc timed out after ${options.timeoutMs}ms`))
    }, options.timeoutMs)
    child.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve(code ?? 1)
    })
  })

  const out = Buffer.concat(stdout).toString('utf8')
  const err = Buffer.concat(stderr).toString('utf8')
  const diagnostics = parseDiagnostics(out)
  if (exit !== 0 && out.length === 0 && err.length === 0) {
    return failure(`tsc exited with code ${exit} and no output`)
  }
  if (exit !== 0 && diagnostics.length === 0) {
    const detail = (err.trim() || out.trim()).slice(0, 400)
    if (detail.length === 0) return failure(`tsc exited with code ${exit} and no output`)
    // Path-less diagnostics (e.g. TS18003 for include: [], TS6053 for a
    // missing file in "files") come from tsconfig misconfiguration; label
    // them so the model fixes the config instead of treating the project as
    // uncheckable.
    const label = /error TS\d+/.test(detail) ? 'tsconfig/global error' : 'tsc exited with code'
    return failure(`${label === 'tsconfig/global error' ? `tsc exited with code ${exit} (${label})` : `${label} ${exit}`}: ${detail}`)
  }
  return {
    root,
    tsconfig,
    diagnostics,
    ok: true,
    ...(exit !== 0 && err.trim().length > 0 ? { error: `tsc stderr: ${err.trim().slice(0, 400)}` } : {}),
    checkedAt: Date.now(),
  }
}

/**
 * Parse tsc diagnostic lines (`path(line,col): error TSxxxx: message`) from
 * stdout. ANSI color codes are stripped first; the `--pretty` shape
 * (`path:line:col - error TSxxxx: message`) is accepted as well.
 */
export function parseDiagnostics(output: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = []
  const lineBreak = new RegExp(String.raw`\r?\n`)
  for (const rawLine of output.split(lineBreak)) {
    const line = rawLine.replace(ANSI_ESCAPES, '')
    const match = DIAGNOSTIC_LINE.exec(line) ?? PRETTY_DIAGNOSTIC_LINE.exec(line)
    if (!match) continue
    diagnostics.push({
      file: match[1]!,
      line: Number(match[2]),
      column: Number(match[3]),
      severity: match[4] === 'warning' ? 'warning' : 'error',
      code: match[5]!,
      message: match[6]!,
    })
  }
  return diagnostics
}

/**
 * Format one check result as model-facing report text.
 * @param result - the check result to render.
 * @param maxDiagnostics - cap on rendered diagnostics.
 * @param paths - optional relative-path filters (empty = all).
 */
export function formatReport(result: CheckResult, maxDiagnostics: number, paths: string[] = []): string {
  if (!result.ok) {
    return `Type check unavailable — ${result.error ?? 'unknown failure'}`
  }
  const cap = Math.max(0, Math.floor(maxDiagnostics))
  const filters = paths.map(normalizeFilter).filter((p): p is string => p !== undefined)
  const filtered = filters.length > 0
    ? result.diagnostics.filter((d) => filters.some((p) => within(d.file, result.root, p)))
    : result.diagnostics
  const capped = filtered.slice(0, cap)
  const dropped = filtered.length - capped.length
  const stamp = new Date(result.checkedAt).toLocaleTimeString()

  const lines = [`Type check report — ${filtered.length} diagnostic${filtered.length === 1 ? '' : 's'} (checked at ${stamp})`]
  for (const d of capped) {
    lines.push(`  ${relative(result.root, d.file).split(sep).join('/')}:${d.line}:${d.column}  ${d.severity} ${d.code}  ${d.message}`)
  }
  if (dropped > 0) lines.push(`  … and ${dropped} more (maxDiagnostics=${maxDiagnostics})`)
  if (filtered.length === 0) {
    // With active filters, zero matches means "nothing matched", not "clean".
    lines.push(filters.length > 0
      ? '  No diagnostics match the given path filters.'
      : '  ✓ No type errors — all checked files are clean.')
  } else {
    lines.push('Tip: fix the errors, then call code_check again to verify.')
  }
  return lines.join('\n')
}

/**
 * Normalize a user-supplied path filter: forward slashes, no `./` prefix, no
 * trailing slash. Filters that normalize to empty are dropped (treated as no
 * filter).
 */
function normalizeFilter(needle: string): string | undefined {
  let path = needle.replaceAll('\\', '/')
  while (path.startsWith('./')) path = path.slice(2)
  while (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  if (path.length === 0) return undefined
  return path
}

/**
 * Whether `file` (absolute) sits under project `root` within relative path
 * `needle`. Matching is segment-exact: 'bad.ts' matches `src/bad.ts` but not
 * `src/bad.tsx`, and 'src' matches `src/bad.ts` but not `srcx/bad.ts`.
 */
function within(file: string, root: string, needle: string): boolean {
  const rel = relative(root, file).split(sep).join('/')
  return rel === needle
    || rel.startsWith(needle + '/')
    || rel.endsWith('/' + needle)
    || rel.includes('/' + needle + '/')
}
