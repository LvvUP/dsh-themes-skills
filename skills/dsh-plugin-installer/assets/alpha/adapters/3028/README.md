# Attention Badge Alpha adaptation

This source adaptation retains catalog ID 3028, the upstream package identity,
and its MIT license. `original/` contains exact reviewed upstream bytes;
`source/` contains the packaged adaptation. `PROVENANCE.json` binds both sets.

Run `python3 build.py` to verify the file inventories and produce the same
`.tgz` bytes under `assets/alpha/artifacts/`. No dependency installation,
upstream lifecycle script, clock value, or network access is used by this build.

The component fixture uses a real locally installed React implementation for
element creation, with simulated hook updates and a minimal document fixture:

```sh
DSH_FIXTURE_REACT_ROOT=/path/to/deepseek-harness/packages/client/ui-layout node --test fixture.test.mjs
```

It covers pending-only updates, actual numeric children in both pills, zero
state, tab title and favicon changes, hidden-probe cleanup, existing favicon
restoration, and disposal while the local favicon request is unresolved.
These tests do not prove that real DSH sessions emit the tested states.
Official Alpha install/load/session-event/removal verification remains separate.

The badge needs no account or remote service of its own. It reads the active
DSH client's session and pending-interaction hooks and requests only the same
origin `/favicon.svg` to recolor the existing icon. It does not request operating
system notification permission. Counts are click-through reminders; opening or
answering a session uses the normal DSH interface.
