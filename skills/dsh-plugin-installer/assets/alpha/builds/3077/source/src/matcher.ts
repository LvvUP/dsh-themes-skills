/**
 * High-confidence host-kill command matcher (pure functions).
 *
 * The matcher recognizes canonical literal host-kill forms at the
 * SIMPLE-COMMAND level within a bounded shell command list: it understands
 * supported control operators (`; && || | |& &` and newlines), comments,
 * quoting, grouping (`( list )`, `{ list; }`), and redirections, and applies
 * the canonical allowlist to every extracted simple command. It does NOT
 * perform shell expansion or general Bash interpretation — dynamic
 * construction (`$VAR`, `$(...)`, backticks, globs, heredocs), shell
 * functions, unsupported compound syntax, and parser-limit failures abstain.
 * False positives stay bounded by the literal allowlist; this layer improves
 * model behavior and auditability — it is not a security boundary.
 * @module @deepseek-ai/dsh-self-control-guard
 */

import type { SelfControlMatcherId } from './types.js'

/** Input byte cap before the scanner abstains (parser resource bound). */
export const MAX_COMMAND_BYTES = 64 * 1024
/** Token cap before the scanner abstains. */
export const MAX_TOKENS = 4096
/** Grouping nesting cap before the scanner abstains. */
export const MAX_NESTING = 32

/** One token of the bounded shell scan. */
type Token =
  | { readonly kind: 'word'; readonly raw: string; readonly quoted: boolean; readonly escaped: boolean; readonly expansion: boolean }
  | { readonly kind: 'control'; readonly raw: string }
  | { readonly kind: 'group'; readonly raw: '(' | ')' }
  | { readonly kind: 'brace'; readonly raw: '{' | '}' }
  | { readonly kind: 'redirect'; readonly raw: string }

/** One extracted simple command: source-ordered words. */
interface SimpleCommand {
  readonly words: readonly Token[]
}

type TokenizeResult =
  | { readonly ok: true; readonly tokens: readonly Token[] }
  | { readonly ok: false }

type ScanResult =
  | { readonly ok: true; readonly commands: readonly SimpleCommand[] }
  | { readonly ok: false }

const CONTROL_OPERATORS = [';;', '&&', '||', '|&', ';', '&', '|'] as const
// Longest-match first so `&>>`/`>>`/`<<<` win over their prefixes, and so a
// redirect scan runs before the control scan (`&>` must not split into `&`+`>`).
const REDIRECT_OPERATORS = ['<<<', '<<', '<>', '>&', '<&', '>>', '>|', '&>>', '&>', '>', '<'] as const

/** Bash blanks: only space and tab separate words (newline is a control). */
const isBlank = (c: string): boolean => c === ' ' || c === '\t'

/**
 * Balance-scan an opaque expansion from `start` to its matching closer,
 * returning the content and the index just past the closer. A frame stack
 * tracks every nested expansion kind (`$()`, `${}`, backticks) and quote
 * state, so a closer at any depth only closes its own frame and an inner
 * quoted closer never unbalances the outer scan. Depth is capped by
 * `MAX_EXPANSION_DEPTH` so pathological nesting abstains instead of
 * overflowing the stack. The content is opaque to matching.
 */
const MAX_EXPANSION_DEPTH = 64

type ScanMode = 'plain' | 'single' | 'double'
interface ScanFrame {
  readonly closer: string
  depth: number
  readonly openers: readonly string[]
  mode: ScanMode
}

function scanBalanced(
  command: string, start: number, openers: readonly string[], closer: string,
): { content: string; end: number } | undefined {
  const frames: ScanFrame[] = [{ closer, depth: 1, openers, mode: 'plain' }]
  let index = start
  let raw = ''
  while (index < command.length && frames.length > 0) {
    // oxlint-disable-next-line typescript/no-non-null-assertion -- frames.length > 0 is the loop guard
    const top = frames[frames.length - 1]!
    const c = command.charAt(index)
    if (top.mode === 'single') {
      raw += c
      if (c === "'") top.mode = 'plain'
      index += 1
      continue
    }
    if (top.mode === 'double') {
      if (c === '\\') {
        raw += c
        index += 1
        if (index < command.length) {
          raw += command.charAt(index)
          index += 1
        }
        continue
      }
      if (c === '"') {
        top.mode = 'plain'
        raw += c
        index += 1
        continue
      }
      // A nested expansion inside double quotes opens a fresh frame whose
      // own quotes and closers are opaque to this level. Arithmetic `$(( ))`
      // is documented unsupported and fails the scan.
      if (c === '$' && command.charAt(index + 1) === '(' && command.charAt(index + 2) === '(') {
        return undefined
      }
      const nested = openNested(command, index, top.closer === '`')
      if (nested !== undefined) {
        if (frames.length >= MAX_EXPANSION_DEPTH) return undefined
        frames.push({ closer: nested.closer, depth: 1, openers: nested.openers, mode: 'plain' })
        raw += nested.raw
        index = nested.end
        continue
      }
      raw += c
      index += 1
      continue
    }
    // plain mode
    if (c === "'") {
      top.mode = 'single'
      raw += c
      index += 1
      continue
    }
    if (c === '"') {
      top.mode = 'double'
      raw += c
      index += 1
      continue
    }
    if (c === '\\') {
      raw += c
      index += 1
      if (index < command.length) {
        raw += command.charAt(index)
        index += 1
      }
      continue
    }
    if (c === '$' && command.charAt(index + 1) === '(' && command.charAt(index + 2) === '(') {
      return undefined // arithmetic $(( )) is unsupported
    }
    const nested = openNested(command, index, top.closer === '`')
    if (nested !== undefined) {
      if (frames.length >= MAX_EXPANSION_DEPTH) return undefined
      frames.push({ closer: nested.closer, depth: 1, openers: nested.openers, mode: 'plain' })
      raw += nested.raw
      index = nested.end
      continue
    }
    let matchedOpener: string | undefined
    for (const opener of top.openers) {
      if (command.startsWith(opener, index)) {
        matchedOpener = opener
        break
      }
    }
    if (matchedOpener !== undefined) {
      top.depth += 1
      raw += matchedOpener
      index += matchedOpener.length
      continue
    }
    if (c === top.closer) {
      top.depth -= 1
      if (top.depth > 0) raw += c
      index += 1
      if (top.depth === 0) frames.pop()
      continue
    }
    raw += c
    index += 1
  }
  if (frames.length > 0) return undefined
  return { content: raw, end: index }
}

/** Detect a nested expansion opener (`$(`/`${`/backtick) at `index`. */
function openNested(
  command: string, index: number, inBacktick: boolean,
): { closer: string; openers: readonly string[]; raw: string; end: number } | undefined {
  if (command.charAt(index) === '$' && command.charAt(index + 1) === '(') {
    /* v8 ignore next -- callers reject `$((` arithmetic before calling
    openNested, so this branch is dead by construction. */
    if (command.charAt(index + 2) === '(') return undefined // (( )) unsupported
    return { closer: ')', openers: ['$(', '('], raw: '$(', end: index + 2 }
  }
  if (command.charAt(index) === '$' && command.charAt(index + 1) === '{') {
    return { closer: '}', openers: ['${'], raw: '${', end: index + 2 }
  }
  if (command.charAt(index) === '`' && !inBacktick) {
    return { closer: '`', openers: [], raw: '`', end: index + 1 }
  }
  return undefined
}

/**
 * Tokenize a command string into shell tokens under the supported subset.
 * Opaque expansions (`$(...)`, `${...}`, backticks) are balance-scanned and
 * emitted as a single expansion-marked word so their contents never split or
 * match. Unsupported constructs (heredocs, `(( ))`, case syntax, function
 * definitions, and any `(`/`{` that Bash would not treat as a group) fail
 * the scan.
 */
function tokenize(command: string): TokenizeResult {
  const tokens: Token[] = []
  let index = 0
  const length = command.length

  let wordOpen = false
  // Open `(` group count, so `)` closes a group only while one is open.
  let parenDepth = 0
  // Token cap: one push per processed char, so a loop-top and a post-loop
  // check bound the total (allows exactly MAX_TOKENS, rejects the next).
  const pushWord = (raw: string, quoted: boolean, escaped: boolean, expansion: boolean): void => {
    const last = tokens.at(-1)
    if (wordOpen && last?.kind === 'word') {
      tokens[tokens.length - 1] = { kind: 'word', raw: last.raw + raw, quoted: last.quoted || quoted, escaped: last.escaped || escaped, expansion: last.expansion || expansion }
      return
    }
    tokens.push({ kind: 'word', raw, quoted, escaped, expansion })
    wordOpen = true
  }
  const closeWord = (): void => { wordOpen = false }
  const pushToken = (token: Token): void => {
    tokens.push(token)
  }

  const isWordBoundary = (i: number): boolean => {
    if (i <= 0) return true
    const prev = command.charAt(i - 1)
    if (prev === ' ' || prev === '\t' || prev === '\n') return true
    const last = tokens.at(-1)
    return last?.kind === 'control' || last?.kind === 'group' || last?.kind === 'brace'
  }

  while (index < length) {
    if (tokens.length > MAX_TOKENS) return { ok: false }
    const char = command.charAt(index)

    // Comments: '#' at a word boundary runs to end of line.
    if (char === '#' && isWordBoundary(index)) {
      closeWord()
      while (index < length && command.charAt(index) !== '\n') index += 1
      continue
    }

    // Newline: word separator AND a control operator (consecutive newlines
    // collapse to one; a newline after a group/brace close is a real separator).
    if (char === '\n') {
      closeWord()
      const last = tokens.at(-1)
      if (last?.kind !== 'control') {
        pushToken({ kind: 'control', raw: '\n' })
      }
      index += 1
      continue
    }
    // Bash blank: only space and tab separate words.
    if (isBlank(char)) {
      closeWord()
      index += 1
      continue
    }

    // Single quotes: fully literal until the closing quote.
    if (char === "'") {
      let raw = ''
      index += 1
      while (index < length && command.charAt(index) !== "'") {
        raw += command.charAt(index)
        index += 1
      }
      if (index >= length) return { ok: false } // unclosed single quote
      index += 1
      pushWord(raw, true, false, false)
      continue
    }

    // Double quotes: literal-ish until the closing quote, honoring escapes
    // and skipping nested expansions (`$()`, `${}`, backticks) whose internal
    // quotes must never end the outer string (`"$(echo "; x;")"` is opaque).
    if (char === '"') {
      let raw = ''
      index += 1
      while (index < length && command.charAt(index) !== '"') {
        const c = command.charAt(index)
        if (c === '$' && command.charAt(index + 1) === '(') {
          if (command.charAt(index + 2) === '(') return { ok: false } // (( )) inside quotes: unsupported
          const inner = scanBalanced(command, index + 2, ['$(', '('], ')')
          if (inner === undefined) return { ok: false }
          raw += `$(${inner.content})`
          index = inner.end
          continue
        }
        if (c === '$' && command.charAt(index + 1) === '{') {
          const inner = scanBalanced(command, index + 2, ['${'], '}')
          if (inner === undefined) return { ok: false }
          raw += '$' + '{' + inner.content + '}'
          index = inner.end
          continue
        }
        if (c === '`') {
          const inner = scanBalanced(command, index + 1, [], '`')
          if (inner === undefined) return { ok: false }
          raw += '`' + inner.content + '`'
          index = inner.end
          continue
        }
        if (c === '\\' && index + 1 < length && '\\"$`\n'.includes(command.charAt(index + 1))) {
          raw += command.charAt(index + 1)
          index += 2
          continue
        }
        raw += c
        index += 1
      }
      if (index >= length) return { ok: false } // unclosed double quote
      index += 1
      pushWord(raw, true, false, false)
      continue
    }

    // Backslash escape (including line continuation).
    if (char === '\\') {
      if (index + 1 >= length) return { ok: false } // trailing backslash
      if (command.charAt(index + 1) === '\n') {
        index += 2
        continue // line continuation: join
      }
      pushWord(command.charAt(index + 1), false, true, false)
      index += 2
      continue
    }

    // Opaque expansions: balance-scan, emit as one expansion-marked word.
    if (char === '$' && command.charAt(index + 1) === '(') {
      if (command.charAt(index + 2) === '(') return { ok: false } // (( arithmetic )) unsupported
      const inner = scanBalanced(command, index + 2, ['$(', '('], ')')
      if (inner === undefined) return { ok: false }
      pushWord(inner.content, false, false, true)
      index = inner.end
      continue
    }
    if (char === '$' && command.charAt(index + 1) === '{') {
      const inner = scanBalanced(command, index + 2, ['${'], '}')
      if (inner === undefined) return { ok: false }
      pushWord(inner.content, false, false, true)
      index = inner.end
      continue
    }
    if (char === '`') {
      // Backticks do not nest (inner backticks are escaped `\``, which the
      // escape branch already skips), so the opener is empty and the scan
      // stops at the first unescaped closer.
      const inner = scanBalanced(command, index + 1, [], '`')
      if (inner === undefined) return { ok: false }
      pushWord(inner.content, false, false, true)
      index = inner.end
      continue
    }

    // Longest-match redirections (heredocs fail the scan). Scanned BEFORE
    // controls so `&>`/`&>>` are single redirect tokens, not `&` + `>`.
    let matchedRedirect: string | undefined
    for (const op of REDIRECT_OPERATORS) {
      if (command.startsWith(op, index)) {
        matchedRedirect = op
        break
      }
    }
    if (matchedRedirect !== undefined) {
      if (matchedRedirect === '<<' || matchedRedirect === '<<<') return { ok: false }
      closeWord()
      pushToken({ kind: 'redirect', raw: matchedRedirect })
      index += matchedRedirect.length
      continue
    }

    // Longest-match control operators.
    let matchedControl: string | undefined
    for (const op of CONTROL_OPERATORS) {
      if (command.startsWith(op, index)) {
        matchedControl = op
        break
      }
    }
    if (matchedControl !== undefined) {
      /* v8 ignore next -- exercised by `case a;; ...`; v8 misses the
      single-line if-return branch. */
      if (matchedControl === ';;') return { ok: false } // case syntax: unsupported
      closeWord()
      pushToken({ kind: 'control', raw: matchedControl })
      index += matchedControl.length
      continue
    }

    // Grouping. `(` is a metacharacter only at a command-start position: a
    // `(` glued to or following a word is a function definition (`f() { ... }`)
    // or a Bash syntax error (`echo (x)`), both of which abstain. `)` closes a
    // group only while a paren group is open; a stray `)` with no open paren
    // is a Bash syntax error and fails the scan (abstain).
    if (char === '(') {
      const last = tokens.at(-1)
      if (last?.kind === 'word') return { ok: false }
      if (command.charAt(index + 1) === '(') return { ok: false } // (( arithmetic )) unsupported
      closeWord()
      pushToken({ kind: 'group', raw: '(' })
      parenDepth += 1
      index += 1
      continue
    }
    if (char === ')') {
      // An unquoted, unescaped `)` with no open `(` is a Bash syntax error
      // (`echo )`), never a word character — fail the scan (abstain).
      if (parenDepth <= 0) return { ok: false }
      parenDepth -= 1
      closeWord()
      pushToken({ kind: 'group', raw: ')' })
      index += 1
      continue
    }

    // `{`/`}` are reserved words only at a command-start position and, for
    // the opener, only when separated from the following word (Bash grammar).
    // `echo {x,y}` is brace expansion (a single word), not a group.
    if (char === '{') {
      const last = tokens.at(-1)
      const atCommandStart = last === undefined || last.kind === 'control' || last.kind === 'group' || last.kind === 'brace'
      const next = command.charAt(index + 1)
      if (atCommandStart && (isBlank(next) || next === '\n' || next === '')) {
        closeWord()
        pushToken({ kind: 'brace', raw: '{' })
        index += 1
        continue
      }
      pushWord(char, false, false, false)
      index += 1
      continue
    }
    if (char === '}') {
      const last = tokens.at(-1)
      const atCommandStart = last === undefined || last.kind === 'control' || last.kind === 'group' || last.kind === 'brace'
      if (atCommandStart) {
        closeWord()
        pushToken({ kind: 'brace', raw: '}' })
        index += 1
        continue
      }
      pushWord(char, false, false, false)
      index += 1
      continue
    }

    // IO-number prefix before a redirect (e.g. `2>`) — only when the digits
    // start a fresh word; digits glued to a word (`kill2>`) continue the word.
    if (/[0-9]/.test(char)) {
      let digits = ''
      while (index < length && /[0-9]/.test(command.charAt(index))) {
        digits += command.charAt(index)
        index += 1
      }
      let redirectOp: string | undefined
      for (const r of REDIRECT_OPERATORS) {
        if (command.startsWith(r, index)) {
          redirectOp = r
          break
        }
      }
      // wordOpen is mutated in closures, invisible to type-aware analysis;
      // the check is what makes `kill2>` continue the word while `2>err`
      // starts a redirect.
      // oxlint-disable-next-line typescript/no-unnecessary-condition
      if (redirectOp !== undefined && !wordOpen) {
        if (redirectOp === '<<' || redirectOp === '<<<') return { ok: false }
        closeWord()
        pushToken({ kind: 'redirect', raw: `${digits}${redirectOp}` })
        index += redirectOp.length
        continue
      }
      pushWord(digits, false, false, false)
      continue
    }

    // Ordinary word character.
    pushWord(char, false, false, false)
    index += 1
  }

  // The loop-top check runs before processing each char; a push in the final
  // iteration can still cross the cap, so verify once more at the end.
  if (tokens.length > MAX_TOKENS) return { ok: false }
  return { ok: true, tokens }
}

/**
 * Split tokens into simple commands at the top level, recursing into
 * `( list )` / `{ list; }` groups. Returns source-ordered simple commands.
 */
function splitCommands(tokens: readonly Token[], depth: number): ScanResult {
  if (depth > MAX_NESTING) return { ok: false }
  const commands: SimpleCommand[] = []
  let currentWords: Token[] = []
  let index = 0
  let expectRedirectTarget = false

  const flush = (): void => {
    if (currentWords.length > 0) {
      commands.push({ words: [...currentWords] })
    }
    currentWords = []
  }

  while (index < tokens.length) {
    // oxlint-disable-next-line typescript/no-non-null-assertion -- index < tokens.length is the loop guard
    const token = tokens[index]!
    // A redirect's target must be the VERY NEXT token and must be a word:
    // `kill > ; echo`, `kill >` newline `echo`, and `kill > >` are syntax errors.
    if (expectRedirectTarget) {
      if (token.kind !== 'word') return { ok: false }
      expectRedirectTarget = false
      index += 1
      continue
    }
    if (token.kind === 'redirect') {
      expectRedirectTarget = true
      index += 1
      continue
    }
    if (token.kind === 'group') {
      /* v8 ignore next -- tokenize emits `)` group tokens only while a `(`
      is open (parenDepth), and the `(` branch above consumes the pair, so a
      bare `)` group token never reaches the top level. */
      if (token.raw === '(') {
        // Find the matching close paren, recurse into the group. An empty
        // `()` is a syntax error in Bash, as is a word directly after `)`.
        let depth2 = 1
        let end = index + 1
        while (end < tokens.length && depth2 > 0) {
          // oxlint-disable-next-line typescript/no-non-null-assertion -- end < tokens.length is the loop guard
          const t = tokens[end]!
          if (t.kind === 'group' && t.raw === '(') depth2 += 1
          else if (t.kind === 'group' && t.raw === ')') depth2 -= 1
          end += 1
        }
        if (depth2 > 0) return { ok: false } // unbalanced paren
        const innerTokens = tokens.slice(index + 1, end - 1)
        const inner = splitCommands(innerTokens, depth + 1)
        if (!inner.ok) return inner
        // `()` / `(\n)` / `(# c\n)` contain no command — a Bash syntax error.
        if (inner.commands.length === 0) return { ok: false }
        for (const command of inner.commands) commands.push(command)
        index = end
        // After a `)` group, zero or more `redirect word` pairs may follow
        // (`(kill) > /dev/null`), then a control operator (or EOF); a bare
        // word (`(echo)kill`) is a syntax error and must abstain.
        let after = tokens[index]
        while (after !== undefined && after.kind === 'redirect') {
          const target = tokens[index + 1]
          if (target === undefined || target.kind !== 'word') return { ok: false }
          index += 2
          after = tokens[index]
        }
        if (after !== undefined && after.kind !== 'control') return { ok: false }
        continue
      }
      // After the '(' branch continues above, raw is provably ')'.
      /* v8 ignore next -- unreachable: tokenize emits `)` group tokens only
      while parenDepth > 0, and the '(' branch consumes every matched pair,
      so no bare ')' group token reaches the top-level loop. */
      return { ok: false } // unbalanced close paren
    }
    if (token.kind === 'brace') {
      if (token.raw === '{') {
        // `{ list; }` reserved-word group: find the closing brace at top level.
        let end = index + 1
        let braceDepth = 1
        while (end < tokens.length && braceDepth > 0) {
          // oxlint-disable-next-line typescript/no-non-null-assertion -- end < tokens.length is the loop guard
          const t = tokens[end]!
          if (t.kind === 'brace' && t.raw === '{') braceDepth += 1
          else if (t.kind === 'brace' && t.raw === '}') braceDepth -= 1
          end += 1
        }
        if (braceDepth > 0) return { ok: false } // unbalanced brace
        // `{ list; }` requires a terminator before the closing brace (Bash
        // grammar); `{ kill -9 4242 }` is a syntax error and must abstain.
        const beforeClose = tokens[end - 2]
        /* v8 ignore next -- exercised by `{ kill -9 4242 }`; v8 misses the
        single-line if-return branch. */
        if (beforeClose === undefined || beforeClose.kind !== 'control') return { ok: false }
        const inner = splitCommands(tokens.slice(index + 1, end - 1), depth + 1)
        if (!inner.ok) return inner
        // `{}` / `{\n}` contain no command — a Bash syntax error.
        if (inner.commands.length === 0) return { ok: false }
        for (const command of inner.commands) commands.push(command)
        index = end
        // After a `}` group, zero or more `redirect word` pairs may follow
        // (`{ kill; } > /dev/null`), then a control operator (or EOF); a
        // bare word is a syntax error and must abstain.
        let after = tokens[index]
        while (after !== undefined && after.kind === 'redirect') {
          const target = tokens[index + 1]
          if (target === undefined || target.kind !== 'word') return { ok: false }
          index += 2
          after = tokens[index]
        }
        if (after !== undefined && after.kind !== 'control') return { ok: false }
        continue
      }
      // After the '{' branch continues above, raw is provably '}'.
      return { ok: false } // unbalanced close brace
    }
    if (token.kind === 'control') {
      // `;`/`&`/newline may terminate the list (empty trailing command); a
      // non-newline operator must sit AFTER a command and, for pipes and
      // short-circuits, also BEFORE another command. Any two adjacent
      // non-newline operators (or an operator at the very start) are invalid.
      if (token.raw !== '\n') {
        if (index === 0) return { ok: false }
        const previous = tokens[index - 1]
        if (previous?.kind === 'control') return { ok: false }
      }
      if (token.raw === '|' || token.raw === '|&' || token.raw === '&&' || token.raw === '||') {
        const next = tokens[index + 1]
        if (next === undefined || next.kind === 'control') return { ok: false }
      }
      flush()
      index += 1
      continue
    }
    currentWords.push(token)
    index += 1
  }
  if (expectRedirectTarget) return { ok: false } // trailing `>` with no target
  flush()
  return { ok: true, commands }
}

/**
 * Bash reserved words that start an unsupported compound construct
 * (`if`/`while`/`for`/`case`/function definitions). A simple command whose
 * first word is one of these is compound syntax, which the scanner does not
 * interpret — it must abstain rather than extract the body's simple commands.
 */
const COMPOUND_KEYWORDS = new Set([
  'if', 'then', 'else', 'elif', 'fi',
  'for', 'while', 'until', 'do', 'done',
  'case', 'esac', 'function', 'select', 'in',
])

/** Whether a word is an environment assignment prefix (`NAME=...` at command start). */
function isAssignmentWord(word: Token): boolean {
  if (word.kind !== 'word' || word.quoted || word.escaped) return false
  const match = /^[A-Za-z_][A-Za-z0-9_]*=/.exec(word.raw)
  return match !== null
}

/**
 * Normalize one simple command to a canonical body string, or return
 * `undefined` when it cannot be matched under the high-confidence contract
 * (dynamic words, environment-assignment prefixes, or malformed words).
 */
function normalizeSimpleCommand(command: SimpleCommand): string | undefined {
  /* v8 ignore next -- splitCommands' flush only pushes commands with
  non-empty words, so this guard is dead by construction. */
  if (command.words.length === 0) return undefined
  // oxlint-disable-next-line typescript/no-non-null-assertion -- guarded by the length check above
  const first = command.words[0]!
  /* v8 ignore next -- exercised by `X=1 kill ...`; v8 misses the
  single-line if-return branch. */
  if (isAssignmentWord(first)) return undefined
  const bodyParts: string[] = []
  for (const word of command.words) {
    // Guard: splitCommands routes group/brace/control/redirect tokens away, so
    // words are always word-kind today; kept so a future token kind routed into
    // words makes the matcher abstain (return undefined) instead of mis-handling.
    /* v8 ignore next -- dead guard by construction today; see above. */
    if (word.kind !== 'word') return undefined
    // The complete unquoted `$PPID` is the only dynamic word allowed.
    /* v8 ignore next 4 -- exercised by `kill $PPID`; v8 misses the special
    case branch and its body. */
    if (word.raw === '$PPID' && !word.quoted && !word.escaped) {
      bodyParts.push('$PPID')
      continue
    }
    if (word.expansion) return undefined
    // A quoted or escaped word is equivalent to its literal text ONLY when it
    // is a single plain token: ordinary literal characters (`kill "4242"`,
    // `'kill' 4242`, `k\ill 4242`, `"/usr/bin/kill"`, `kill "+4242"`,
    // `kill "-TERM"`, `kill 4242 "bad_arg"` — the latter is a bad operand
    // that Bash reports while still killing the host). Anything containing
    // `$`, whitespace, or other shell metacharacters (`"$PPID"`,
    // `'kill -9 4242'`, `"a;b"`) stays opaque — it is not the single token it
    // spells, and matching it would create false positives.
    if ((word.quoted || word.escaped) && !/^[0-9A-Za-z_./:+=,@%~-]+$/.test(word.raw)) return undefined
    bodyParts.push(word.raw)
  }
  return bodyParts.join(' ')
}

/**
 * Canonicalize a numeric pid token the way Bash accepts it: optional `+`
 * sign and leading zeros both address the same pid (`kill 0004242` and
 * `kill +4242` hit pid 4242). Returns the decimal STRING (no number
 * coercion, so arbitrarily long pid tokens never lose precision), or
 * `undefined` for a token that is not a plain decimal pid.
 */
function canonicalPidToken(raw: string): string | undefined {
  let value = raw
  if (value.startsWith('+')) value = value.slice(1)
  // Strip leading zeros (a pid of all zeros canonicalizes to "0").
  value = value.replace(/^0+(?=[0-9])/, '')
  if (value === '' || !/^[0-9]+$/.test(value)) return undefined
  return value
}

/** C `long` min/max on the 64-bit platforms procps targets. */
const LONG_MIN = -(2n ** 63n)
const LONG_MAX = 2n ** 63n - 1n

/**
 * Whether a decimal string (optionally `+`/`-` prefixed, matching the
 * attached `--queue=<n>` regex) fits a signed 64-bit C `long`. procps
 * parses the queue value with `strtol_or_err`, so the valid range is the
 * platform long range — wider than JS safe integers (verified:
 * `-q 9007199254740992 -s TERM PID` kills the target, while the 64-bit
 * overflow `-q 9223372036854775808` aborts). BigInt comparison avoids any
 * `Number` precision loss.
 */
function isCSharpLong(value: string): boolean {
  let digits = value
  let negative = false
  if (digits.startsWith('+')) digits = digits.slice(1)
  else if (digits.startsWith('-')) { negative = true; digits = digits.slice(1) }
  /* v8 ignore next -- callers regex-validate the value first (`^\+?[0-9]+$`
  for the separated form, `[+-]?[0-9]+$` for the attached form), so the
  digits are always non-empty here. */
  if (digits === '' || !/^[0-9]+$/.test(digits)) return false
  const n = BigInt(digits)
  return negative ? n <= -LONG_MIN && n >= 0n : n >= 0n && n <= LONG_MAX
}

/**
 * Whether a word is a Bash-accepted signal name (with or without `SIG`
 * prefix) for `-s`/`-n`/`-<sig>` purposes. Signal NUMBERS are valid only up
 * to the Linux real-time ceiling (64); anything larger makes Bash reject the
 * whole command without sending a signal, so it must not match.
 */
/**
 * Linux signal names accepted by `kill` (without the `SIG` prefix; the
 * prefix is optional). Values stay within the standard + real-time range
 * (1..64), so a name here is a signal Bash actually accepts. Signal names
 * are case-insensitive (`-term` ≡ `-TERM`). The external procps `kill`
 * (used by `/bin/kill`, `exec kill`, `env kill`, `nice kill`) additionally
 * accepts the IOT/CLD/POLL aliases; the bash builtin does not, so the
 * external aliases are gated on the command being the external binary.
 */
const SIGNAL_NAMES = new Set([
  'HUP', 'INT', 'QUIT', 'ILL', 'TRAP', 'ABRT', 'BUS', 'FPE', 'KILL', 'USR1',
  'SEGV', 'USR2', 'PIPE', 'ALRM', 'TERM', 'STKFLT', 'CHLD', 'CONT', 'STOP',
  'TSTP', 'TTIN', 'TTOU', 'URG', 'XCPU', 'XFSZ', 'VTALRM', 'PROF', 'WINCH',
  'IO', 'PWR', 'SYS', 'RTMIN', 'RTMAX',
])

/** procps `kill` aliases not accepted by the bash builtin. */
const EXTERNAL_SIGNAL_ALIASES = new Set(['IOT', 'CLD', 'POLL'])

/**
 * Whether a word is a signal spec accepted by the kill variant in play.
 * Builtin bash `kill`: numbers 1..64, known names (case-insensitive,
 * optional `SIG` prefix), `RTMIN+n` (n 0..30) and `RTMAX-n` (n 1..14).
 * External procps `kill`: same names, plus the IOT/CLD/POLL aliases, but
 * only `RTMIN+n` offsets (procps rejects `RTMAX-n`). Signal 0 (probe) is
 * never accepted — it does not terminate, so a command using it must not
 * match. Anything else makes the kill reject the command without sending a
 * signal, so it must not match either.
 */
function isSignalName(word: string, external: boolean): boolean {
  if (/^[0-9]+$/.test(word)) return Number.parseInt(word, 10) >= 1 && Number.parseInt(word, 10) <= 64
  const upper = word.toUpperCase()
  const bare = upper.startsWith('SIG') ? upper.slice(3) : upper
  if (SIGNAL_NAMES.has(bare)) return true
  if (external && EXTERNAL_SIGNAL_ALIASES.has(bare)) return true
  // Real-time offsets (the `SIG` prefix, if present, was already stripped).
  // Builtin accepts RTMIN+n (0..30) and RTMAX-n (1..14); procps accepts
  // RTMIN+n but rejects RTMAX-n.
  const rmin = /^RTMIN\+([0-9]+)$/.exec(bare)
  if (rmin !== null) {
    const n = Number.parseInt(rmin[1]!, 10)
    return n >= 0 && n <= 30
  }
  if (!external) {
    const rmax = /^RTMAX-([0-9]+)$/.exec(bare)
    if (rmax !== null) {
      const n = Number.parseInt(rmax[1]!, 10)
      return n >= 1 && n <= 14
    }
  }
  return false
}

/** How the command word after the prefix chain is resolved. */
type KillMode = 'builtin' | 'external'

/**
 * Resolve the command name after optional invocation prefixes, returning the
 * index of the command word and how it runs (bash builtin vs external
 * binary). The prefix chain is a small state machine mirroring bash:
 *
 * - `plain` (no prefix, or under `command`): bash resolves builtins first,
 *   so `kill` stays the builtin and `/bin/kill`/`pkill`/`killall` are
 *   external. `command -p` only switches the PATH used for EXTERNAL lookup —
 *   it does NOT bypass the builtin (`command -p kill` is still the builtin;
 *   `command -p /bin/kill` is external). `command -v`/`-V` introspect and
 *   never run the command (abstain). Repeated `-p` is accepted.
 * - `builtin` (under `builtin`): the next word must be a builtin. `builtin
 *   kill` → builtin kill; `builtin pkill` → abstain (pkill is not a
 *   builtin); `builtin exec kill` → exec is a builtin that replaces the
 *   shell, so the chain continues as external.
 * - `external` (under `exec`/`env`/`nice`): the next word must be an
 *   external command. `exec command kill` / `env exec kill` / `nice command
 *   kill` / `builtin env kill` are all invalid in bash (`exec: command: not
 *   found`, `env: exec: No such file`) → abstain.
 *
 * Returns `undefined` for an invalid or introspecting chain.
 */
function resolveCommandPrefix(
  words: readonly string[],
): { readonly index: number; readonly mode: KillMode } | undefined {
  let index = 0
  let mode: 'plain' | 'builtin' | 'external' = 'plain'
  for (;;) {
    const word = words[index]!
    if (word === 'command') {
      // `command` is a builtin itself; valid under plain and builtin, not
      // under external (no external file named `command`).
      if (mode === 'external') return undefined
      let j = index + 1
      if (j >= words.length) return undefined
      if (words[j] === '-v' || words[j] === '-V') return undefined // introspection
      while (words[j] === '-p') {
        j += 1
        if (j >= words.length) return undefined
      }
      if (words[j]!.startsWith('-')) return undefined
      index = j
      mode = 'plain' // command resolves builtins first
      continue
    }
    if (word === 'builtin') {
      if (mode === 'external') return undefined
      const next = words[index + 1]
      if (next === undefined || next.startsWith('-')) return undefined
      index += 1
      mode = 'builtin'
      continue
    }
    if (word === 'exec') {
      // exec is a builtin (valid under plain/builtin) that replaces the
      // shell with an external command, so the chain becomes external.
      if (mode === 'external') return undefined
      const next = words[index + 1]
      if (next === undefined || next.startsWith('-')) return undefined
      index += 1
      mode = 'external'
      continue
    }
    if (word === 'env' || word === 'nice') {
      // env/nice are external commands; invalid under builtin (not builtins).
      if (mode === 'builtin') return undefined
      let i = index + 1
      while (i < words.length) {
        const w = words[i]!
        if (word === 'env') {
          if (w === '-i' || w === '--ignore-environment') { i += 1; continue }
          if (w === '-u' || w === '--unset') { i += 2; continue }
          if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(w)) { i += 1; continue } // NAME=VALUE
        } else {
          if (w === '-n' || w === '--adjustment') { i += 2; continue }
          if (w.startsWith('--adjustment=')) { i += 1; continue }
        }
        break
      }
      if (i >= words.length) return undefined
      index = i
      mode = 'external'
      continue
    }
    break // the command word itself
  }
  const command = words[index]!
  if (mode === 'builtin') {
    // Only builtins are reachable; the only builtin we match is `kill`.
    if (command !== 'kill') return undefined
    return { index, mode: 'builtin' }
  }
  if (command === '/bin/kill' || command === '/usr/bin/kill') return { index, mode: 'external' }
  // `kill` resolves as the builtin under plain/builtin, and as the external
  // binary under external (exec/env/nice run the PATH lookup).
  if (command === 'kill') return { index, mode: mode === 'external' ? 'external' : 'builtin' }
  // pkill/killall are external binaries; under `builtin` they are unreachable
  // (handled above), otherwise they run externally.
  if (command === 'pkill' || command === 'killall') return { index, mode: 'external' }
  return undefined
}

/**
 * The canonical allowlist, applied to one normalized simple-command body.
 * Body words are joined with single spaces. The kill command is parsed
 * token-wise (not regexed) so every Bash-accepted spelling of the same
 * literal pid list is recognized: optional `-s <sig>` / `-n <num>` /
 * `-<signal>` flags, a `--` option terminator, and optional
 * `command`/`builtin`/`exec`/`env`/`nice` invocation prefixes (with their
 * own options: `env -i kill`, `nice -n 10 kill`). A pid list that contains
 * the literal host pid anywhere matches `kill-host-pid`; `$PPID` alone or
 * mixed into the list matches `kill-parent` — but the host pid takes
 * precedence, so a list containing BOTH the literal host pid and `$PPID` is
 * still `kill-host-pid` (the privileged channel permanently refuses that id,
 * while `kill-parent` is allowed there).
 *
 * The builtin and the external procps `kill` differ in operand semantics:
 * the builtin stops parsing options at the first operand, so a `-<flag>`
 * AFTER a pid is a bad operand that it reports while still delivering the
 * signal (`kill -TERM <host> -FOOBAR` kills the host); it skips bad operands
 * and keeps scanning. procps resolves options ANYWHERE (getopt-style), so
 * `/bin/kill 4242 -0` is a signal-0 probe (never matches) and a bad operand
 * stops it outright (`/bin/kill bad 4242` delivers nothing). Both models are
 * implemented below.
 */
function matchCanonicalHostKill(body: string, hostPid: number): SelfControlMatcherId | undefined {
  const words = body.split(' ')
  const resolved = resolveCommandPrefix(words)
  if (resolved === undefined) return undefined
  const { index, mode } = resolved
  const command = words[index]!
  if (command === 'pkill' || command === 'killall') {
    // resolveCommandPrefix already rejected `builtin pkill`; the rest is
    // ` <flags> dsh` — join with a leading space to reuse the canonical shape.
    const rest = ' ' + words.slice(index + 1).join(' ')
    // pkill [-9] [-f|-x|-P <n>] dsh — the canonical spellings.
    if (command === 'pkill' && /^(?: -9)?(?: -f| -x| -P [0-9]+)? dsh$/.test(rest)) return 'pkill-dsh'
    // killall [-9|-r] dsh — the canonical spellings.
    if (command === 'killall' && /^(?: -9| -r)? dsh$/.test(rest)) return 'killall-dsh'
    return undefined
  }
  const external = mode === 'external'
  if (external) {
    // procps is TWO-PHASE (verified against the 3.3.17 source and live
    // probes): `skill_sig_option` first scans for the FIRST bare `-<sig>`
    // (including `-0`) anywhere in argv and sets the initial signal; the
    // getopt loop then applies `-s <sig>` / `--signal <sig>` / attached
    // forms, the LAST one WINNING and overwriting the bare signal regardless
    // of argv order (so `-s 0 -9 PID` ends as a signal-0 probe — alive).
    // Only ONE bare `-<sig>` is consumed; a second makes procps print usage
    // and abort without delivering. `-l`/`-L`/`--list`/`-h`/`--help`/`-V`/
    // `--version` never terminate; `-q`/`--queue` consume a validated C-long
    // value; an unknown option aborts.
    let bareSigno: string | undefined // from skill_sig_option (first bare -<sig>)
    let signo: string | undefined // from getopt -s/--signal (last wins)
    let bareSignalCount = 0
    let nonTerminating = false
    let afterDashDash = false
    const operands: string[] = []
    for (let i = index + 1; i < words.length; i += 1) {
      const word = words[i]!
      if (word === '--') {
        // getopt treats only the FIRST `--` as the option terminator; a
        // second `--` is a bad operand. `skill_sig_option` still sees bare
        // `-<sig>` words after the first `--`.
        if (afterDashDash) { operands.push(word); continue }
        afterDashDash = true
        continue
      }
      if (!afterDashDash && (word === '-s' || word === '--signal')) {
        // `-s <sig>` / `--signal <sig>`: getopt phase, last one wins and
        // overwrites the bare signal.
        const sig = words[i + 1]
        if (sig === undefined) { nonTerminating = true; continue }
        if (!isSignalName(sig, true) && !/^0+$/.test(sig)) { nonTerminating = true; continue }
        signo = sig
        i += 1
        continue
      }
      if (!afterDashDash && /^--signal=[A-Za-z0-9+.-]+$/.test(word)) {
        const sig = word.slice(9)
        if (!isSignalName(sig, true) && !/^0+$/.test(sig)) { nonTerminating = true; continue }
        signo = sig
        continue
      }
      if (!afterDashDash && /^-s[A-Za-z0-9+.-]+$/.test(word)) {
        const sig = word.slice(2)
        if (!isSignalName(sig, true) && !/^0+$/.test(sig)) { nonTerminating = true; continue }
        signo = sig
        continue
      }
      if (!afterDashDash && (word === '-l' || word === '-L' || word === '--list'
        || word === '-h' || word === '--help' || word === '-V' || word === '--version')) {
        nonTerminating = true
        continue
      }
      if (!afterDashDash && (word === '-q' || word === '--queue')) {
        const value = words[i + 1]
        if (value === undefined || !/^\+?[0-9]+$/.test(value) || !isCSharpLong(value)) {
          nonTerminating = true
          continue
        }
        i += 1
        continue
      }
      if (!afterDashDash && /^--queue=[+-]?[0-9]+$/.test(word)) {
        if (!isCSharpLong(word.slice(8))) {
          nonTerminating = true
          continue
        }
        continue
      }
      if (word === '-0') {
        // `-0` is a bare signal candidate for `skill_sig_option`: the FIRST
        // bare `-0` anywhere (including after `--`) is extracted as signal 0
        // (probe) and can be overwritten by a later `-s`/`--signal` — verified
        // `-s TERM -- -0 PID` and `-s TERM -- PID -0` BOTH kill the target
        // (the `-s TERM` overwrites the extracted `-0`, and the PID is sent).
        // A SECOND `-0` BEFORE `--` triggers procps's getopt `case '?'`
        // digit branch, which immediately does kill(0, signo) — the UTILITY
        // dies and procps exits BEFORE any operand is processed (strace:
        // `-TERM PID -0` issues ONLY kill(0, SIGTERM)) — abstain. A second
        // `-0` AFTER `--` is an operand processed in order (strace:
        // `-TERM PID -- -0` first kill(PID, SIGTERM) then kill(0)) — a host
        // pid before it was already delivered (match).
        if (bareSignalCount >= 1) {
          if (afterDashDash) { operands.push(word); continue }
          nonTerminating = true
          continue
        }
        bareSignalCount += 1
        bareSigno = '0'
        continue
      }
      if (/^-[0-9]+$/.test(word) || /^-[A-Za-z][A-Za-z0-9+.-]*$/.test(word)) {
        // Bare `-<sig>`: the FIRST one sets the initial signal (a later `-s`
        // overwrites it). A second bare signal makes procps abort (verified
        // `-9 -TERM PID` leaves the target alive) — abstain. After `--` with
        // an existing bare signal, a NUMERIC negative token is a process-
        // group operand procps delivers past (`-TERM PID -- -9` sends TERM to
        // PID then ESRCH for group 9), while a NAMED one is a bad operand.
        const sig = word.slice(1)
        if (isSignalName(sig, true) || sig === '0') {
          if (afterDashDash && bareSignalCount >= 1) {
            operands.push(word) // numeric: process group; named: bad operand
            continue
          }
          if (bareSignalCount >= 1) { nonTerminating = true; continue }
          bareSignalCount += 1
          bareSigno = sig
          continue
        }
        if (afterDashDash) { operands.push(word); continue }
        nonTerminating = true
        continue
      }
      if (word.startsWith('-')) {
        if (afterDashDash) { operands.push(word); continue }
        nonTerminating = true
        continue
      }
      operands.push(word)
    }
    if (nonTerminating) return undefined
    // The effective signal: getopt's `-s`/`--signal` overwrite the bare
    // signal (last `-s` wins); a bare `-0` or `-s 0` probes.
    const effective = signo ?? bareSigno
    if (effective !== undefined && /^0+$/.test(effective)) return undefined
    // Process operands in order; a bad operand stops procps outright. A
    // numeric negative token after `--` is a process-group operand procps
    // tries and continues past; `-0` as a group-0 operand kills the UTILITY
    // (`kill(0, signo)`) and exits — pids AFTER it never receive anything
    // (a host pid before it was already delivered); a named negative token
    // is a bad operand.
    let sawHostPid = false
    let sawPPID = false
    let sawPid = false
    for (const word of operands) {
      if (word === '$PPID') { sawPPID = true; sawPid = true; continue }
      const pid = canonicalPidToken(word)
      if (pid !== undefined) {
        sawPid = true
        if (pid === String(hostPid)) sawHostPid = true
        continue
      }
      if (word === '-0') break // group-0 operand: kills the utility, exits
      if (/^-[0-9]+$/.test(word)) continue // negative pid / process group
      break // bad operand: nothing after it is delivered
    }
    if (!sawPid) return undefined
    if (sawHostPid) return 'kill-host-pid'
    if (sawPPID) return 'kill-parent'
    return undefined
  }
  // Bash builtin: option parsing ends at the first operand; bad operands are
  // reported but the signal still reaches the valid pids and scanning
  // continues.
  let sawHostPid = false
  let sawPPID = false
  let sawPid = false
  let optionsEnded = false
  for (let i = index + 1; i < words.length; i += 1) {
    const word = words[i]!
    if (!optionsEnded && word === '--') {
      optionsEnded = true
      continue
    }
    if (!optionsEnded) {
      // `kill -l` / `kill -L` list signal names and never kill — abstain.
      if (word === '-l' || word === '-L') return undefined
      if (word === '-s' || word === '-n') {
        // `-s <sigspec>` / `-n <signum>`: the next word is the signal, not a
        // pid. A non-signal next word makes the kill reject the command —
        // abstain.
        const sig = words[i + 1]
        if (sig === undefined || !isSignalName(sig, false)) return undefined
        i += 1
        continue
      }
      // `-<signal>` flags: numeric (`-15`) or named (`-TERM`, `-HUP`,
      // `-SIGKILL`, case-insensitive, real-time offsets allowed). A
      // `-<name>`-shaped token that is not a valid signal makes the kill
      // reject the command — abstain.
      if (/^-[0-9]+$/.test(word)) {
        if (!isSignalName(word.slice(1), false)) return undefined
        continue
      }
      if (/^-[A-Za-z][A-Za-z0-9+.-]*$/.test(word)) {
        if (!isSignalName(word.slice(1), false)) return undefined
        continue
      }
    }
    if (word === '$PPID') {
      sawPPID = true
      sawPid = true
      optionsEnded = true // first operand ends option parsing
      continue
    }
    const pid = canonicalPidToken(word)
    if (pid !== undefined) {
      sawPid = true
      optionsEnded = true // first operand ends option parsing
      if (pid === String(hostPid)) sawHostPid = true
      continue
    }
    // A non-signal, non-pid operand. The builtin reports it but still
    // delivers the signal to the valid pids and keeps scanning (`kill -TERM
    // <host> bad` kills the host). Before any operand, an unrecognized
    // `-<flag>`-shaped token makes the builtin reject the whole command —
    // abstain. After `--`, a `-0` is a group-0 operand: bash does
    // kill(0, signo), killing the UTILITY itself before any later pid is
    // processed (verified `kill -s TERM -- -0 PID` rc=143 with the target
    // alive) — stop scanning, keeping pids already seen.
    if (optionsEnded && word === '-0') break
    if (!optionsEnded) {
      if (word.startsWith('-')) return undefined
      optionsEnded = true // first (non-option) operand ends option parsing
    }
  }
  if (!sawPid) return undefined
  if (sawHostPid) return 'kill-host-pid'
  if (sawPPID) return 'kill-parent'
  return undefined
}

/**
 * Match a bash command string against the canonical host-kill forms at the
 * simple-command level within a bounded shell command list.
 * @param command - the `bash` tool's `command` argument, verbatim.
 * @param hostPid - the host process pid (`process.pid` of the harness), embedded literally.
 * @param enabled - optional set of matcher ids to consider; when provided, the
 *   first enabled hit in source order wins.
 * @returns the matched matcher id, or `undefined` when nothing canonical and enabled matches.
 */
export function matchHostKill(
  command: string,
  hostPid: number,
  enabled?: ReadonlySet<SelfControlMatcherId>,
): SelfControlMatcherId | undefined {
  if (Buffer.byteLength(command, 'utf8') > MAX_COMMAND_BYTES) return undefined
  if (command.includes('\0')) return undefined // NUL is not a Bash word character
  const scanned = tokenize(command)
  if (!scanned.ok) return undefined
  const split = splitCommands(scanned.tokens, 0)
  if (!split.ok) return undefined
  // A simple command whose first word is a compound keyword means the list
  // is an unsupported compound construct (`function f {...}`, `if ... then
  // ... fi`, `while ... do ... done`) whose inner commands may never run —
  // abstain the whole scan instead of matching inside the body.
  for (const simple of split.commands) {
    // splitCommands' flush only pushes commands with non-empty words, so the
    // length check's false path is dead by construction.
    /* v8 ignore next -- dead guard by construction; see above. */
    if (simple.words.length > 0) {
      // oxlint-disable-next-line typescript/no-non-null-assertion -- guarded by the length check
      const firstWord = simple.words[0]!
      if (firstWord.kind === 'word' && !firstWord.quoted && !firstWord.escaped && COMPOUND_KEYWORDS.has(firstWord.raw)) {
        return undefined
      }
    }
  }
  for (const simple of split.commands) {
    const body = normalizeSimpleCommand(simple)
    if (body === undefined) continue
    const id = matchCanonicalHostKill(body, hostPid)
    if (id !== undefined && (enabled === undefined || enabled.has(id))) return id
  }
  return undefined
}

/**
 * Whether the whole input is EXACTLY one simple command: no control
 * operators, no groups, no braces, no redirections — nothing that could hide
 * a second command or make the single matched form conditional (`false &&
 * pkill dsh; echo payload` must NOT count as `pkill dsh`). Used by the
 * privileged-bash escape hatch so a blocked matcher hit cannot smuggle
 * arbitrary shell alongside it.
 * @param command - the `bash` tool's `command` argument, verbatim.
 * @returns true when the input tokenizes to exactly one bare simple command.
 */
export function isSingleSimpleCommand(command: string): boolean {
  if (Buffer.byteLength(command, 'utf8') > MAX_COMMAND_BYTES) return false
  if (command.includes('\0')) return false
  const scanned = tokenize(command)
  if (!scanned.ok) return false
  // Any control/group/brace/redirect token means the input is not a lone
  // simple command (a redirect could be attached to a single command in real
  // Bash, but for the escape hatch's high-confidence contract we require a
  // bare command with no shell structure at all).
  for (const token of scanned.tokens) {
    if (token.kind !== 'word') return false
  }
  const split = splitCommands(scanned.tokens, 0)
  /* v8 ignore next -- unreachable: after the word-only gate above, the token
  stream has no group/brace/control/redirect tokens, and splitCommands only
  fails on those (or on empty groups), so it cannot reject an all-word list. */
  if (!split.ok) return false
  return split.commands.length === 1
}
