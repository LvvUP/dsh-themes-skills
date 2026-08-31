# alpha.1 Plugin migration map

Use this reference when an editorial candidate still targets an RC-era
`@deepseek-ai/dsh-client-runtime`, `@deepseek-ai/dsh-host-apiproxy`,
`ctx.apiProxy`, `connection.api`, `ctx.conversationEvents`, or
`ctx.conversationViews` surface. The authority is the exact official
`dsh-v0.1.2-alpha.1` source at commit
`cd5ef8148158c3a752a658978873241fdf8e2bbc`, tree
`a712eec535b48badc4fefb4df5176a7002e4280b`.

This is a review and implementation map, not installation or runtime
authority. A migrated artifact still needs exact source and artifact identity,
rights review, a closed capability disclosure, one reviewed probe contract,
and all six platform/Node runtime receipts.

## Hard refusals

- alpha.1 has no aggregate client/runtime package and no replacement central
  facade. Replacing the old package name without redesigning ownership is not
  a valid migration.
- alpha.1 has no replacement central APIProxy service. Unary and streaming
  business methods belong to their owning `TypertRemoteService` and generated
  `@Remote` contribution.
- A Web plugin must not register an unauthenticated raw `ctx.webServer` route.
  Prefer an owning Remote for business calls or an exact
  `ctx.connection.fetch` route for native GET/HEAD byte streams. An unavoidable
  raw route must branch on `ctx.connection.requestRejection(request)` before
  any side effect or success response. That helper returns a rejection status;
  it does not send or stop the request by itself. The complete minimum guard is:

  ```js
  const rejection = ctx.connection.requestRejection(request)
  if (rejection !== undefined) {
    response.writeHead(rejection)
    response.end(rejection === 401 ? 'unauthorized' : 'forbidden')
    return
  }
  ```

  No protected read, mutation, stream setup, or success header may appear
  before this branch, and execution must not continue after the rejection.
- A normal extension must not occupy the single-seat `root` or `sidebar`
  slots. Use declared additive children such as `sidebar.footer.action` or
  `shell.overlay` and retain every disposer.
- Session snapshots no longer own raw events, conversation views, chat nodes,
  pending approvals, or pending questions. Code that assumes the RC snapshot
  shape requires a semantic rewrite, not a type cast.

## Client ownership map

| RC-era surface | alpha.1 owner | Required boundary |
| --- | --- | --- |
| `ctx.sessions` | `@deepseek-ai/dsh-api-session-controller/client` | Session domain, projections, prompt and update queue only. |
| Session React sources | `@deepseek-ai/dsh-client-ui-session` | Consume or provide target-neutral sources through `ctx.uiSession`; do not recreate transport. |
| `ctx.workspaces` domain | `@deepseek-ai/dsh-api-workspace-controller/client` | Workspace snapshots and commands. |
| Workspace React/navigation | `@deepseek-ai/dsh-client-ui-workspace` | Root `useWorkspaces` and navigation belong here. |
| `ctx.conversationEvents` | `ctx.uiConversation.events` from `@deepseek-ai/dsh-client-ui-conversation` | Registry is assembled per Session; do not traverse raw Session events from ordinary UI. |
| `ctx.conversationViews` | `ctx.uiConversation.views` from `@deepseek-ai/dsh-client-ui-conversation` | Retain the caller-fiber disposer. |
| `useConversation` | `@deepseek-ai/dsh-client-ui-conversation` | Target-neutral conversation state. |
| `useChat` | `@deepseek-ai/dsh-client-ui-chat` | Chat-specific projection. |
| `useTrajectory` | `@deepseek-ai/dsh-client-ui-trajectory` | Trajectory-specific projection. |
| `ctx.slots` | `@deepseek-ai/dsh-client-ui-renderer/client` | This runtime service owns slot declaration and registration. |
| Slot contracts | `@deepseek-ai/dsh-client-ui-slots` | Types/core only; it is not the injectable `ctx.slots` owner. |
| Store engine | `@deepseek-ai/dsh-client-store` | React-free snapshot/subscribe/update/set engine; hook composition belongs to the renderer. |

`dsh.client.inject` is load and prefetch metadata, not service sequencing.
When a plugin depends on a slot declaration it must use
`ctx.slots.inject(slotName, callback)`. Every register, provide, decorate,
mount, language pack, Remote, and slot contribution must be disposed by the
calling fiber and must disappear on unload.

## Common service map

### Commands

- Host command ownership: `@deepseek-ai/dsh-commands`.
- Client Remote assembly: `@deepseek-ai/dsh-api-remotes/client`.
- Host directory calls: `ctx.remote.commands.list(sessionId)` and
  `ctx.remote.commands.execute(sessionId, line, images, signal?)`.
- Client-only slash-menu contributions: `ctx.commandUi` from
  `@deepseek-ai/dsh-client-ui-commands`.

`commandUi.register` does not define Host execution. A plugin that adds a Host
command must use a unique namespace, preserve the durable run/done pair,
support cancellation, fail loudly on collision, and dispose both Host and
client contributions.

### Plugin inventory

`ctx.remote.pluginInventory.list()` is provided by the Host
`@deepseek-ai/dsh-host-plugin-inventory` service and mounted through
`@deepseek-ai/dsh-api-remotes`. It is read-only Loader state. Its `entryId` is
not a DSH Themes Public ID, package coordinate, or installation pin and must
never be promoted into catalog authority.

### Locale

`ctx.locale` belongs to `@deepseek-ai/dsh-client-locale`. A third-party
language first calls `addLanguage({ id, label, fallback })`, then registers
each namespace dictionary. The fallback chain must terminate at `en`.
Language packs must not directly mutate DOM state or local storage, and every
language/dictionary registration needs a disposer.

### Settings

Plugin preferences bind through `ctx.settingsScope.bind({ namespace })` from
`@deepseek-ai/dsh-client-ui-settings`. This preserves the official revision
fence, redaction, non-loopback memory mode, and caller-fiber cleanup. Do not
call the raw Settings Remote to recreate the mirror. Secret values are never
returned by `describe`; browser clients also do not receive Settings file
paths.

### Model selection

The owner is `@deepseek-ai/dsh-client-ui-model-selection`. It shares one
directory between `/model` and the `conversation.input.model` seat and commits
through `ctx.remote.session.selectModel`. The current value comes from the
durable `modelSelection` projection. A migrated plugin must not use a static
model array, write a cookie/local-storage substitute, optimistically claim a
selection, bypass provider/model/effort validation, or enable the selector for
an addressed subagent.

### Layout and sidebar

`@deepseek-ai/dsh-client-ui-layout` owns `root` and declares the single
`sidebar`, `conversation`, and `details` seats plus additive `shell.overlay`.
`@deepseek-ai/dsh-client-ui-sidebar` owns `sidebar` and declares its children.
Extensions should use declared additive children and leave the shell owners
intact after disposal.

### Open a workspace path

The old `host.openPath` maps to
`ctx.remote.session.canOpenWorkspacePath` followed by
`ctx.remote.session.openWorkspacePath`. Resolve a relative path against the
active Session cwd with `@deepseek-ai/dsh-util-workspace-path`; require an
explicit user action and reject empty, unrelated, or untrusted paths. Do not
use Settings document openers as a path-opening substitute.

## APIProxy migration

The generated `@deepseek-ai/dsh-api-remotes/client` assembly explicitly mounts
business contributions. Merely importing a type or having a Host package in
the graph does not create a client namespace.

| RC APIProxy operation | alpha.1 owner/method |
| --- | --- |
| `session.rename` | Session title/rename Remote |
| `command.list`, `command.execute` | `remote.commands.list`, `remote.commands.execute` |
| `llm.providers` | `remote.llm.listProviders` / `listConfigurableProviders` |
| `llm.discoverModels` | `remote.llm.discoverModels` |
| `llm.models` | `remote.session.modelCatalog` |
| `credentials.*` | Credentials Remote |
| `settings.*` | Settings Remote |
| `settings.openDocument` | `remote.settings.openSettingsDocument` |
| `agentPreset.read/copy/remove` | Agent Presets Remote |
| `agentPreset.openDocument` | `remote.settings.openAgentPresetDirectory` |
| `subagent.interrupt` | `remote.subagents.interruptByParent` |
| `workspace.*` | Workspace Remote |
| `skill.list` | Skills Remote |
| `fileReferences.list` | File References Remote |
| `host.openPath` | Session `openWorkspacePath` after capability check |
| `host.describe` | Ready frame plus domain-specific capability queries |
| `session.export` | exact GET/HEAD `/api/session.export` fetch route |

Use `ctx.connection.fetch.register({ path, methods: ['GET', 'HEAD'], fetch })`
only when browser-native byte streaming or a GET/HEAD response cannot use the
Remote envelope. The route is an exact pathname and method match and is behind
the Connection Host/Origin/BrowserAuth fence. Its disposer must remove the
route. Ordinary unary/stream methods use the owning Typert Remote.

For a client Remote contribution, disposal means the namespace/method is
withdrawn, cannot be invoked, and sends no stale request. Do not require every
Host business endpoint to become a physical 404: the Gateway may retain a
structured unavailable classification. An exact Connection fetch route,
however, must return 404 after disposal.

## Required migration probes

Every candidate first proves that its resolved manifest has neither removed
package, every official package resolves to `0.1.2-alpha.1`, its exact Cordis
entry is active, and no fiber is waiting or failed. Then run only the probes
matching its declared capabilities:

1. Session and conversation contributions survive reconnect replacement and a
   cold restart, then fully disappear on disposal without damaging core UI.
2. Commands produce one durable run/done pair, honor AbortSignal, fail loudly
   on collisions, and disappear from both directories after disposal.
3. Locale changes update translator output and `document.lang`, missing keys
   fall back to English, and the former preference is restored.
4. Settings set/mutate/unset operations respect revisions, never reveal secret
   values, survive restart, and restore the exact previous namespace.
5. Model changes wait for the durable projection; invalid models and addressed
   subagents never receive an optimistic selection.
6. Slot additions render at desktop and narrow widths, then dispose while the
   `root` and `sidebar` owners remain active.
7. Workspace path opening requires capability plus a user gesture, resolves
   against the active Session cwd, rejects empty input, and honors abort.
8. A Remote or exact fetch route proves bare 401, valid BrowserAuth 200, forged
   Host 403, and no token/cookie/related digest in logs or receipts. Exact
   fetch also proves GET/HEAD MIME/body, method/path 404, and post-dispose 404.
9. Installation, cold start, declared feature, removal, and full Profile plus
   dependency-closure rollback pass on macOS arm64, Linux x64, and Windows x64
   under Node 22.19.0 and 24.15.0.

Any remaining removed import, legacy service property, direct single-seat
shell replacement, unauthenticated raw route, missing disposer, or probe
failure keeps the item non-installable and ineligible for Top 10.
