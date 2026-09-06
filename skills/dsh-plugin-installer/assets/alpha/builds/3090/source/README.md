# dsh-lens-lite

Post-edit diagnostics for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness).

After a file-mutating tool succeeds, this plugin runs the checkers you configured for that file's extension and attaches their output to the **same tool result** as model-visible context. The next model request therefore already carries the type errors or lint findings the edit introduced, instead of the model discovering them a few turns later.

`dsh-lsp` covers semantic navigation (definition, references, hover). It does not surface diagnostics, and nothing in the shipped harness runs a type-checker after an edit. This plugin fills that gap.

## Install

```bash
dsh plugin --profile web add dsh-lens-lite
```

Then override the row in your profile's `cordis.patch.yml` with the checkers your toolchain actually has (the shipped row has none — see [Configuration](#configuration)).

## How it behaves

- Runs only after a **successful** call to a watched tool (`write`, `edit`, `str_replace_editor` by default).
- Takes the edited path from the tool's canonical `path` value — the path the filesystem backend actually resolved — and falls back to the `file_path` argument for tools that declare no such value.
- Runs every checker claiming that file's extension, concurrently.
- Attaches nothing when every checker exits with a configured clean code and prints nothing.
- **Never vetoes and never rewrites a call.** It delegates the `tools/post-execute` waterfall first and only folds context onto whatever decision came back, preserving every downstream context's own source and metadata.
- Skips linting entirely when a downstream listener blocked the call — that blocked call is already the feedback the model must react to.
- Honours the tool call's cancellation signal, and terminates a checker's whole process tree when its own timeout expires.

Findings arrive as a `notice`-form plugin context, so the transcript shows a collapsed one-line summary rather than a wall of compiler output.

## Configuration

Every deployment-varying value is a config field. The plugin ships **no built-in commands**: which checkers exist is a property of your toolchain, not of this package.

```yaml
- id: lens-lite
  name: dsh-lens-lite
  config:
    tools: [write, edit, str_replace_editor]
    maxDiagnosticChars: 4000
    checkers:
      - name: tsc
        extensions: ['.ts', '.tsx']
        argv: ['npx', '--no-install', 'tsc', '--noEmit']
        cwd: '.'
        timeoutMs: 60000

      - name: eslint
        extensions: ['.ts', '.tsx', '.js', '.jsx']
        argv: ['npx', '--no-install', 'eslint', '--format', 'compact', '{file}']
        cleanExitCodes: [0]

      - name: ruff
        extensions: ['.py']
        argv: ['ruff', 'check', '--output-format', 'concise', '{file}']

      - name: go-vet
        extensions: ['.go']
        argv: ['go', 'vet', '{dir}']
        streams: [stderr]
```

### Checker fields

| Field | Default | Meaning |
|---|---|---|
| `name` | — (required) | Label shown to the model above this checker's output |
| `extensions` | — (required) | Lowercase, leading-dot extensions this checker claims |
| `argv` | — (required) | Executable + arguments. `argv[0]` resolves against the subprocess provider's scrubbed PATH. **Never shell-interpreted** |
| `cwd` | `.` | Working directory, resolved against the harness process directory (your workspace root) |
| `timeoutMs` | `30000` | Wall-clock bound; the process tree is terminated when it expires |
| `graceMs` | `2000` | SIGTERM→SIGKILL grace for that termination |
| `maxOutputBytes` | `65536` | In-memory cap per collected stream; overflow keeps the tail |
| `cleanExitCodes` | `[0]` | Exit codes meaning "no findings" |
| `streams` | `[stdout, stderr]` | Which streams carry findings, in concatenation order |

`argv` entries support three placeholders, substituted per run:

| Placeholder | Value |
|---|---|
| `{file}` | Absolute path of the edited file |
| `{relFile}` | That path relative to `cwd` |
| `{dir}` | Its containing directory |

### Plugin fields

| Field | Default | Meaning |
|---|---|---|
| `tools` | `[write, edit, str_replace_editor]` | Tool names whose successful results are inspected |
| `checkers` | `[]` | Checkers, all consulted; empty means the plugin does nothing (it says so once at load) |
| `maxDiagnosticChars` | `4000` | Cap on model-visible diagnostic text per result; overflow keeps the **head**, because the first error is usually the cause of the rest |

## Cost

Whole-project checkers run on **every** edit. `npx tsc --noEmit` on a large repo can add seconds to each write. Prefer single-file invocations (`{file}`) where the tool supports them, and raise `timeoutMs` only for the checkers that genuinely need it.

## Failure behavior

Load-time misconfiguration fails loud: an empty `argv`, a checker claiming no extensions or reading no streams, a duplicate checker name, or a non-positive bound throws at plugin load.

Environment failures do not fail the edit — the call already succeeded — and become findings instead:

- An unresolvable executable is reported once as `checker unavailable: …`, then that checker stays quiet for the rest of the fiber's life.
- A timeout is reported as `checker timed out after Nms`.
- A spawn-level failure is reported as `checker failed to start: …`.

## Extension point

One listener on [`tools/post-execute`](https://github.com/deepseek-ai/deepseek-harness/blob/main/packages/core/tools/README.md#extension-points), plus `ctx.subprocess` for spawning. No core changes, no agent-loop changes.

## Development

```bash
pnpm install --ignore-workspace
pnpm run typecheck
pnpm test
pnpm run build
```

The test suite drives the real `tools/post-execute` waterfall against the real local subprocess provider, using `node -e` programs as checkers, so it covers actual spawning, exit-code classification, stream selection, and timeouts without requiring any toolchain.

## License

MIT

## Prior art

The post-edit-feedback idea comes from [pi-lens](https://github.com/apmantza/pi-lens) (MIT) in the Pi ecosystem. This is an independent implementation against Harness extension points and shares no code with it; it deliberately covers only the run-checkers-after-edit slice, not pi-lens's AST rules, dependency mapping, or triage system.
