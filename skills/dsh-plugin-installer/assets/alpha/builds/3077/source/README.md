# self-control-guard

English | [中文](README.zh.md)

A self-control guard for the DeepSeek Harness host process.

## Why

When developing DSH plugins, an agent frequently — by accident or by a misfired command — **kills its own host process** (`pkill dsh`, `kill -9 <host-pid>`, `kill $PPID`, `killall dsh`). The session dies mid-task, work is lost, and there is no audit trail. This plugin is designed to **prevent agent self-termination**: it intercepts high-confidence host-kill attempts from the `bash` tool, hard-denies them, teaches the model the controlled exit tool, and leaves an audit trail.

It does three things:

1. **Intercepts** high-confidence attempts to terminate the host from the `bash` tool (canonical `kill <host-pid>`, `kill $PPID`, `pkill dsh`, `killall dsh` forms) with a monotonic hard denial that no `pre-execute` listener can force-allow.
2. **Teaches** the model the controlled tools — `dsh_self_exit` always, and `dsh_self_restart` only when `restartEnabled: true` (hidden by default — TBD, see Known Limitations) — by injecting a pinned guidance message right after an interception. The tools are **registered up front but hidden**: they never appear in the model-facing tool list (`hidden: true` keeps them out of `schemas()`), so an unassisted model cannot discover them by enumeration — yet they stay callable by name, so a caller that learns them from outside the tool list (the guard's denial text, a user instruction, another tool) can invoke them immediately.
3. **Runs a token-confirmed graceful exit/restart** through the launcher's existing seams: the headless runner's `ctx.headlessIo.exit(code)` (code-exact) on one-shot runs, and the launcher's `SIGTERM` graceful shutdown on long-lived surfaces (web).

**Design stance: this is a UX/interception layer, not a security boundary.** The matcher recognizes canonical kill forms at the simple-command level inside a bounded shell command list (`; && || | |& &`, newlines, comments, quoting, `( list )` / `{ list; }` groups, redirections (target word opaque)); dynamic construction (`$VAR`, `$(...)`, backticks, globs, heredocs), shell functions, unsupported compound syntax, and parser-limit failures abstain. Variable splicing, encodings, interpreters, process-group signals, PTY, MCP, Code Runtime, `cordis_mount`, and direct syscalls are all documented out-of-scope (see [Interception coverage](#interception-coverage) and [Known Limitations](#known-limitations-and-deferred-work)). The OS can always kill the host; the guard's job is to make the model reach for the controlled tools instead, and to leave an audit trail when it does.

## Installation

Requirements: Node.js 22 or newer and `@deepseek-ai/dsh@0.1.0-rc.6`.
The plugin ships as a standalone bundle installable into any DSH profile.

Build, validate, and pack it from the plugin directory:

```bash
npm install
npm run check
npm pack
```

Install the generated tarball into a DSH profile, then restart `dsh web`.
Installing the source directory as a link is not supported because host peers
are supplied by the DSH profile:

```bash
npx @deepseek-ai/dsh@0.1.0-rc.6 plugin --profile web add ./self-control-guard-0.1.0.tgz
npx @deepseek-ai/dsh@0.1.0-rc.6 web
```

The plugin has no browser bundle. Verify it in the Web settings plugin list.
To update, build a tarball with a newer package version, remove the installed
bundle, add the new tarball, and restart. To uninstall:

```bash
npx @deepseek-ai/dsh@0.1.0-rc.6 plugin --profile web remove self-control-guard
```

## Config

```yaml
- id: self-control-guard
  name: self-control-guard
  config:
    enabled: true              # master switch
    confirmationCalls: 2       # total calls: first arms the token, final confirms
    confirmationTtlMs: 60000   # token validity window
    retryCooldownMs: 10000     # lockout after a failed attempt at the call ceiling
    interceptModes: [kill-host-pid, kill-parent, pkill-dsh, killall-dsh]
    exitCode: 0                # code requested by dsh_self_exit
    restartExitCode: 42        # code requested by dsh_self_restart; must differ from exitCode
    restartEnabled: false      # hidden by default (no supervisor on web); set true to offer the tool
    headlessRestart: deny      # headless one-shot restart policy: deny | exit-code
    allowedAgents: roots       # who may request host exit: roots | all
    # privilegedBash:          # explicit escape hatch for BLOCKED commands
    #   enabled: false         #   default off; the tool is not registered
    #   matchers: [kill-parent, pkill-dsh, killall-dsh]
    #                          #   advisory now (relaxed re-check); duplicates still fail
```

Fail-loud at load: duplicate or empty `interceptModes`, `exitCode === restartExitCode`, `confirmationCalls < 2`, non-positive TTL, negative cooldown, an invalid enum member, or a duplicate `privilegedBash.matchers` list throws — never a silent fall-back. `enabled: false` is the only way to fully disable interception.

## Interception coverage

### Intercepted (hard-denied)

The matcher (`src/matcher.ts`) is a pure function over the `bash` tool's `command` argument: it scans the command list under a bounded shell subset (resource caps: 64 KiB input, 4096 tokens, nesting depth 32) and applies the canonical allowlist to every extracted simple command:

| matcher id | canonical forms |
|---|---|
| `kill-host-pid` | `kill`/`/bin/kill`/`/usr/bin/kill`, optional `command`/`builtin`/`exec`/`env`/`nice` prefix (a state machine mirroring bash: `command -p` keeps the builtin, `exec`/`env`/`nice` switch to the external binary, invalid chains like `env exec kill` abstain), any Bash-accepted signal spelling (`-9\|-KILL\|-SIGKILL\|-TERM\|-15\|-HUP\|-INT\|-1\|-s <sig>\|-n <num>\|--`; names case-insensitive with optional `SIG`, builtin real-time `RTMIN+0..30`/`RTMAX-1..14`, external `RTMIN+n`, numbers 1..64; external kill paths also accept IOT/CLD/POLL aliases but not `-n`), and a pid LIST that contains the literal host pid (each pid canonicalized like Bash — `+4242`/`0004242` address host `4242`; `42424` never does). Builtin semantics: options end at the first operand, so `kill -TERM <host> -FOOBAR` still matches and bad operands are skipped. External procps semantics (verified against procps 3.3.17, TWO-PHASE): `skill_sig_option` takes the FIRST bare `-<sig>` (including `-0`) as the initial signal, then getopt `-s`/`--signal`/attached `--signal=`/`-s<sig>` overwrite it with the LAST one winning regardless of argv order (`-s 0 -9 PID` is a probe and abstains; `-s TERM -- -9 PID` matches; a second bare `-<sig>` makes procps abort, `-9 -TERM PID` abstains); `-l`/`-L`/`--list`/`-h`/`--help`/`-V`/`--version`/unknown flags never terminate (abstain); `-q`/`--queue` consume a validated C-long value (missing/non-numeric/overflow abstains; `-q 9007199254740992` matches on 64-bit); `-0` after `--` is positional (a second `-0` there is an operand — `-TERM PID -- -0` matches because PID was already sent, `-TERM -- -0 PID` abstains because the utility dies first; a first bare `-0` anywhere probes or is overwritten by `-s`, so `-s TERM -- -0 PID` matches), while a second `-0` BEFORE `--` is a getopt case-'?' that exits before any operand (`-TERM PID -0` abstains, target survives); The bash builtin's `-0` after `--` is a group-0 operand: it kills the UTILITY before any later pid is processed (`kill -s TERM -- -0 PID` abstains, `kill -s TERM -- PID -0` matches — its earlier pid was already sent; the external `/bin/kill` differs: there the first bare `-0` is overwritten by `-s TERM`, so `/bin/kill -s TERM -- -0 PID` matches); bad operands stop delivery (`/bin/kill bad 4242` does not match, `/bin/kill 4242 bad` matches); `--` ends getopt (only the FIRST `--` — a second is a bad operand) but a bare `-<sig>` after it still sets the signal (`-- -TERM PID` matches); a numeric negative token after `--` is a process-group operand (`-TERM PID -- -9` matches), a named negative token is a bad operand (`-TERM -- -TERM PID` abstains) |
| `kill-parent` | `kill` with the same optional prefixes/signal spellings and `$PPID`, alone or mixed into a numeric pid list (`kill $PPID <pid>`); a list containing BOTH the literal host pid and `$PPID` is `kill-host-pid` (host pid wins — the privileged channel permanently refuses that id) |
| `pkill-dsh` | `pkill [−9] [−f\|−x\|−P <n>] dsh`, optionally under `command`/`exec`/`env`/`nice` (not `builtin` — pkill is an external binary) |
| `killall-dsh` | `killall [−9\|−r] dsh`, same prefix rule |

Any simple command in the list matching an enabled canonical form denies the whole call — so compound forms like `kill -9 $PPID; echo x` are intercepted. `# comments` are stripped, quoting is honored (a quoted/escaped single plain token like `'kill'`/`"4242"`/`"/usr/bin/kill"`/`kill "+4242"`/`"bad_arg"` is literal; anything containing `$` or whitespace stays opaque), and `( list )` / `{ list; }` groups are recursed into; `$PPID` matches only unquoted.

### Not intercepted (abstain — passes through)

Unsupported constructs **abstain** rather than guess, so they run for real:

- **Dynamic construction**: `$VAR`, `"$HOST"`, `${HOST}`, `$(...)`, backticks, globs, heredocs — the matcher sees the **unexpanded** shell source at `pre-execute` time, so a variable target is indistinguishable from any other dynamic value.
- **Shell functions**: a function body (`run() { kill ...; }`) or a function call that wraps a kill — the matcher does not enter function bodies.
- **Compound/unsupported syntax**: `case`/`if`/`for` loops, arrays, positional parameters, arithmetic/process substitution, `eval`, `bash -c`, alias, glob, `xargs`, pipes to interpreters, background (`&`).
- **Signal probes / listings**: `kill -0 <pid>`, `kill -l` / `kill -L` — never terminate, so they abstain (a probe stays possible).
- **Assignment prefixes**: `X=1 kill ...`.
- **Non-canonical forms**: `kill -1` (HUP to the whole group), `pidfd_send_signal`, process-group signals (`kill -- -<pgid>`), unknown signal names, malformed operator sequences, parser-limit failures.
- **Out-of-process surfaces**: PTY (`node-pty` spawns outside `ctx.subprocess`), MCP, Code Runtime, `cordis_mount` (same-process, bash-equivalent trust), interpreters, direct syscalls.
- **Non-host targets**: killing any process whose PID is not the host pid is not intercepted.

### Left-over bypass paths (documented)

Because this is a UX layer, not a security boundary, the following remain **possible** ways to terminate the host:

1. **Any abstained form above** — most naturally a **variable-constructed kill**: `kill "$HOST"`, `pid=...; kill "$pid"`, a loop/function parameter. The matcher sees the unexpanded source and abstains; bash then expands and really kills the host — **without any guidance or audit**. The first signal the model sees is the session ending. See Known Limitations. (An optional `block-dynamic-kill` strict policy — reject any canonical kill whose target is a variable — is a possible future config, but it would also block legitimate kills of non-host processes and is therefore not a default.)
2. **`dsh_self_bash` (if enabled)** — the privileged escape hatch intentionally runs any command the root agent confirms (relaxed matcher re-check): compound forms, redirections, pipes, even a literal host pid, under the token + approval gates (danger-full-access / active-goal exempt). This is the documented escape for legitimate-termination cases, not a bypass of the ordinary guard for unintended kills.
3. **OS-level escapes** — `setsid`, interpreters, `pidfd_send_signal`, process-group signals, PTY/MCP/Code Runtime, `cordis_mount`, direct syscalls. Preventing these is OS isolation work (PID namespaces, seccomp, a supervisor), out of scope here.

## Controlled exit / restart

Both tools share one confirmation state machine: the first call returns an unpredictable `confirmation_token` (32 random bytes, stored only as a SHA-256 digest) and performs no shutdown; every later call must present the current token within its TTL; the final call consumes it and dispatches the exit on a fresh tick after the tool result is logged (`exec.concludeTurn()` first). Tokens are per-agent, per-action, time-bounded, and a wrong token at the call ceiling arms a short cooldown.

- **Headless one-shot:** `ctx.headlessIo.exit(code)` with the exact configured code. Restart is **refused by default** (`headlessRestart: deny`) because re-running the same task could repeat external side effects; opt in with `headlessRestart: exit-code`.
- **Long-lived surfaces (web):** the guard reuses the launcher's `SIGTERM` graceful shutdown (`process.kill(process.pid, 'SIGTERM')`). There is no custom exit-code channel on web, so a restart there exits with the launcher's signal code and the restart semantics are carried by the supervisor's "process vanished" policy — see Known Limitations.
- **Agent fence:** only top-level agents (`allowedAgents: roots`, the default) may request host exit; a subagent's request is rejected.

## Privileged bash (`dsh_self_bash`)

The escape hatch for the **legitimate-termination false positive**: a blocked command (`kill $PPID`, `pkill dsh`, `killall dsh`) that the model genuinely intended — killing another dsh instance, or a wrapper that changed `$PPID`'s meaning. It is an explicit, gated tool (sudo-like), **not** a guard bypass: the monotonic guard stays untouched for ordinary bash. Off by default (`privilegedBash.enabled: false`); when enabled it is registered up front (process-global and hidden from the model tool list, like the exit tools — the registry has no per-agent registration), and its execution is gated by the root-only fence.

The gate has three layers that must ALL hold before anything runs:

1. **Root-only fence** — the tool is ALWAYS limited to top-level agents, independent of `allowedAgents`: a subagent never obtains a channel that can re-execute a host-kill command.
2. **Command-bound confirmation token** — the first call returns a `confirmation_token` and executes nothing; the second call must present it **with the exact same command** (a SHA-256 fingerprint binds the token to the command, so a verified token cannot be replayed against a different command). The agent confirms the target itself — there is no matcher re-check, so any command (compound forms, redirections, pipes, even a literal host pid) arms, and the token + approval gates carry the control surface.
3. **One-time human approval** — through `ctx.approval`, `allowed-once` only; `never` / no approval service / cancel fail closed. **Exemption:** an agent already running under `danger-full-access`, or an agent with an **active goal** (`ctx.goals.get(agent).phase === 'active'` — an autonomous continuation), executes directly; both are explicit all-access/autonomous grants, so the approval adds no value. The token gate stays mandatory in every mode.

`privilegedBash.matchers` is now **advisory** (kept for documentation and telemetry; duplicates still fail at load), and `kill-host-pid` is no longer rejected at load — the relaxed stance trusts the root agent's own confirmation. The command runs through the `ctx.bash` executor seam under the **same resolved sandbox policy and session cwd** as the ordinary bash tool (same env scrubbing / timeout / cancel semantics), never through `ctx.tools.execute` (which would re-enter the guard). A confirmed execution appends a log-only `guard/self-control` `privileged-bash-executed` event carrying the gate used (`granted` | `full-access-exempt`), preceded by a `privileged-bash-dispatch` event written BEFORE the command runs — so a command that terminates the host mid-run still leaves a dispatch trace. The dispatch is flushed through `ctx.sessions.flush` before execution; without a persistence listener the dispatch stays in-memory only.

## Restart recovery (roster manifest)

When a restart is confirmed AND `manifestPath` is configured (opt-in; default empty = no roster), the guard atomically writes the live top-level session ids to that file (`{ version, restartId, createdAt, sessions: [{ sessionId }] }`, random-name exclusive tmp + rename, mode 0600, malformed input tolerated as "no roster"). The next host process can read it to know which persisted session logs were live at restart time.

The recovery side is a thin RPC: `session.resume` (host apiproxy) resumes a batch of persisted sessions as live agents through the existing `agentFor()` cold-resume transaction — the same path a browser opening a session already uses. Per-item outcomes: `resumed` / `already-live` / `failed` (each item settles independently). The browser reconnection pipeline (client runtime) calls it automatically: on `handleConnected`, the sessions manager resumes every in-memory session instance from the previous connection generation (generation-scoped and abortable — a disconnect invalidates the in-flight transaction); `failed` items surface as list removals driven by the scope-prune lifecycle. Roster authorization against the manifest is **deferred**: the RPC does not yet verify membership — the caller's in-memory knowledge is the roster. The batch is bounded (50) and duplicate ids are rejected.

## Audit trail

Every transition appends a log-only `guard/self-control` event (`shell-intercepted`, `confirmation-armed`, `confirmation-rejected`, `shutdown-requested`, `privileged-bash-dispatch`, `privileged-bash-executed`) with only matcher id, action, reason, rejection detail, exit code, and the gate used for a privileged execution — never the command text, the token, or free text. Events carry no surface metadata. The `./invariant` companion validates the protocol on the authoritative stream before commit: a terminal transition must follow a matching armed transition for the same action (and reason for the accepted shutdown); a `privileged-bash-executed` must follow a `self-bash` armed transition and carry the matcher and approval gate.

## Telemetry redaction

A `telemetry/record` redactor replaces intercepted `bash` command text, `dsh_self_bash` command text, and `dsh_self_*` `confirmation_token` values with a fixed placeholder in ledger exports. The canonical session log is untouched — the model must still read its own token.

## Model Experience

### Interception guidance (pinned, injected verbatim)

#### What the model sees

After a canonical host-kill command is blocked, that agent receives the guidance below. The controlled tools are registered up front but hidden, so they never appear in the tool list on their own — this guidance is how the model first learns their names and payloads.

```text
You are attempting to terminate the DeepSeek Harness host process. This command was blocked. Do not rewrite, encode, or route around the denial.

For a controlled exit, call dsh_self_exit with:
{"reason_code":"user-request"}

For a controlled restart request, call dsh_self_restart with:
{"reason_code":"apply-configuration"}
(shown only when restartEnabled: true)

The first call returns a confirmation_token and performs no shutdown. Read that result, then call the same tool again with the unchanged reason_code and the returned confirmation_token.
```

## Known Limitations and Deferred Work

- **Not a security boundary.** Obfuscation, base64, command substitution, shell functions, `setsid`, interpreters, `kill -1`, `pidfd_send_signal`, process-group signals, PTY (node-pty spawns outside `ctx.subprocess`), MCP, Code Runtime, and `cordis_mount` (same-process, bash-equivalent trust) all bypass the matcher. Preventing host termination is OS isolation work (PID namespaces, seccomp, supervisor), out of scope here.
- **Web restart has no distinct exit code.** The web surface exits via `SIGTERM` with the launcher's code; a supervisor cannot distinguish "restart requested" from a plain exit by code. A code-exact channel needs launcher cooperation and is deferred. The exit is dispatched only after the accepted tool's turn settles (`agent.whenIdle()`), with a 10s bounded fallback timer.
- **Restart tool is hidden by default (TBD).** `dsh_self_restart` is not registered unless `restartEnabled: true` — the web surface has no supervisor, so a confirmed restart only terminates the host without auto-reviving it. The code path is retained; revive the flow once a supervisor channel exists.
- **Hidden registration is process-global and not revoked.** The tools register on the plugin's global context at load: every agent/session can call them by name (execution stays gated by `allowedAgents`), but they stay out of the model tool list for the whole life of the plugin; HMR or plugin unload removes them with the effect. There is no disclosure event: the guard denies, teaches, and the model calls the already-registered tools.
- **Denied-command false positives.** A user legitimately terminating another dsh instance, or a wrapper changing the meaning of `$PPID`, is reported. The matcher is deliberately conservative to keep this bounded: it never uses substring matching, and dynamic construction (`$VAR`, `$(...)`, backticks, globs, heredocs), assignment prefixes (`X=1 kill ...`), and unsupported shell syntax all abstain. The legitimate case now has a documented exit: `dsh_self_bash` re-executes the blocked command under a token + approval gate (full-access exempt); `kill-host-pid` is excluded by design.
- **Ordinary variable usage is NOT covered.** The matcher sees the **unexpanded** shell source at `pre-execute` time: a command written as `kill "$HOST"`, `pid=...; kill "$pid"`, a loop or function parameter, or any form whose target comes from a variable is abstained and executes for real. Only a literal host PID (or `$PPID` / `pkill dsh` / `killall dsh`) is intercepted. This is the natural way a script or an agent writes a kill, so a variable-constructed host kill can terminate the host **without any guidance or audit** — the first signal the model sees is the session ending. This is a deliberate coverage boundary for the UX/interception stance (a `$VAR` is indistinguishable at parse time from any other dynamic value); deployments that must also stop variable-constructed kills need OS-level isolation (PID namespaces, seccomp, a supervisor), not matcher changes. An optional `block-dynamic-kill` strict policy (reject any canonical kill whose target is a variable) is a possible future config, but it would also block legitimate kills of non-host processes and is therefore not a default.
- **`pkill dsh` / `killall dsh` still match the host.** These forms cannot express "only another instance" — they match every dsh process including the host. They are permitted in `privilegedBash.matchers` (a subset of `interceptModes`), but they always carry the token gate, and under `danger-full-access` the human-approval exemption means a confirmed `pkill dsh` can terminate the host. Deployments that must not allow this should keep them out of the privileged set.
- **In-memory confirmation state.** A session resumed from persistence starts with no armed token; the protocol re-arms from scratch. Each agent holds a single confirmation slot at a time, keyed by action + reason + token; wrong tokens exhaust the remaining confirmation chances and arm a cooldown during which re-arming is refused.
- **Recovery authorization is deferred.** `session.resume` does not yet verify the `restartId`/manifest membership (the caller's in-memory knowledge is the roster), and pending inbox items do not auto-start after resume (the agent-loop has no `startPending`). A session not in the browser's memory is resumed when a user opens it, through the lazy `agentFor` path.
