# DSH Live Stats

External plugin for DSH Web. It owns the composer's `stats` slot cell, renders the complete session status row with live input, output, and unabridged total token counts, and adds a second row for generation throughput:

```text
Input ~7.9K tok · Output ~12 tok · Total ~7,912 tok
TPS 31.4 tok/s
```

`~` marks a value that still includes the current request's input estimate. Streamed DeepSeek output is counted with the official tokenizer; provider usage replaces all provisional values when it arrives. Exact cache accounting continues to come from DSH's durable token-usage projection. A retry replaces the prior estimate for that step, and an aborted turn removes its unsettled estimate.

TPS is the number of tokens added after the first output sample divided by the elapsed time between the first and latest token-bearing stream events. Final usage, block-end, and assistant-message events correct counts but do not extend that interval. A one-sample response therefore has no TPS value instead of an artificial terminal-event rate.

The plugin replaces the built-in `conversation.composer.dock` entry through the slot registry's documented same-id priority mechanism. It reads public `sessionStats` and `tokenUsage` projections, owns `liveTokenUsage`, and leaves the Harness checkout untouched. A Harness update therefore no longer needs to replay a `StatsLine` source patch.

The package is a profile bundle and mounts itself without a separate home-level patch:

```yaml
- insert:
    - id: live-stats
      name: '@proton1917/dsh-live-stats'
```

The bundled tokenizer comes from DeepSeek's official tokenizer download. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for its source, checksums, and license references.

## Requirements

- DeepSeek Harness `0.1.0-rc.7` or later.
- A local checkout when developing through `link:`, or a GitHub/npm package spec for a managed installation.
- Node.js and pnpm versions accepted by the harness repository.

## Build and test

```sh
pnpm install
pnpm run typecheck
pnpm test
pnpm run build
```

## Load in DSH Web

Build the plugin and add its bundle to the Web profile once:

```sh
dsh plugin --profile web add @proton1917/dsh-live-stats@link:$HOME/Projects/dsh-live-stats
dsh web
```

The profile records the bundle in `dsh.profile.bundles`; normal Harness installations and upgrades keep the profile and its plugin dependency outside the Harness source checkout.

For client and server hot updates, run the Web app in development mode and keep the plugin watcher in a second terminal:

```sh
dsh web --dev
```

```sh
cd ~/Projects/dsh-live-stats
pnpm run dev
```

The plugin watcher rebuilds `lib/index.js` and `lib/client.js`; DSH Web reloads the client contribution through HMR without replacing the page.

## Compatibility updates

The repository builds against published DSH release packages rather than relative links into one Harness checkout. Dependabot groups new `@deepseek-ai/*` releases into one compatibility pull request, and GitHub Actions runs typecheck, unit tests, and both client and host builds on every update. A new Harness release therefore produces a concrete compatibility result without relying on a manual reminder.

For a locally linked checkout, merge the generated compatibility pull request, fast-forward this checkout, and rebuild it. The Web profile keeps the same link and bundle registration.

## License

BSD-3-Clause. See [LICENSE](LICENSE).
