import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

const source = await readFile(
  new URL('./palette-persistence.js', import.meta.url),
  'utf8'
);
const themes = [
  { id: 'dsh-alpha-theme-pack-nord' },
  { id: 'dsh-alpha-theme-pack-dracula' },
];
const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise(setImmediate);
};

function harness(durable, ready = false) {
  let snapshot = { preference: 'system' };
  let baseSnapshot = ready
    ? { status: 'ready', value: { preference: 'system', fontSize: 14 } }
    : { status: 'loading' };
  const changes = [];
  const listeners = new Set();
  const baseListeners = new Set();
  const disposers = [];
  const ctx = {
    logger: {
      warn(message) {
        throw new Error(message);
      },
    },
    effect(factory) {
      const dispose = factory();
      if (dispose) disposers.push(dispose);
    },
    on(_name, callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    settingsScope: {
      bind() {
        return {
          getSnapshot: () => baseSnapshot,
          subscribe(callback) {
            baseListeners.add(callback);
            return () => baseListeners.delete(callback);
          },
        };
      },
    },
    theme: {
      getTheme: () => snapshot,
      setTheme(preference) {
        snapshot = { preference };
        changes.push(preference);
        for (const listener of listeners) listener(snapshot);
      },
    },
  };
  const factory = vm.runInNewContext(`${source}\ninstallPalettePersistence`, {
    queueMicrotask,
    fetch: async (_route, options) => {
      if (options?.method === 'POST')
        Object.assign(durable, JSON.parse(options.body));
      return { ok: true, json: async () => ({ ...durable }) };
    },
  });
  const choose = factory(ctx, themes, 'theme-pack');
  return {
    choose,
    ctx,
    changes,
    get preference() {
      return snapshot.preference;
    },
    adopt(preference = 'system', fontSize = 14) {
      baseSnapshot = { status: 'ready', value: { preference, fontSize } };
      // ui-theme subscribes before the third-party palette plugin.
      ctx.theme.setTheme(preference);
      for (const callback of baseListeners) callback();
    },
    dispose() {
      for (const dispose of disposers.reverse()) dispose();
    },
  };
}

test('stored palette waits for Alpha base adoption and survives a cold client restart', async () => {
  const durable = { selection: themes[0].id, base: 'system' };
  const first = harness(durable);
  await flush();
  assert.equal(first.preference, 'system');
  first.adopt();
  await flush();
  assert.equal(first.preference, themes[0].id);
  first.choose(themes[1].id);
  await flush();
  assert.equal(durable.selection, themes[1].id);
  first.dispose();
  const restarted = harness(durable);
  restarted.adopt();
  await flush();
  assert.equal(restarted.preference, themes[1].id);
});

test('font-size adoption preserves the palette while a built-in choice clears its durable selection', async () => {
  const durable = { selection: themes[0].id, base: 'system' };
  const app = harness(durable, true);
  await flush();
  app.adopt('system', 16);
  await flush();
  assert.equal(app.preference, themes[0].id);
  app.ctx.theme.setTheme('light');
  await flush();
  assert.equal(app.preference, 'light');
  assert.equal(durable.selection, 'off');
  assert.equal(durable.base, 'light');
});

test('an unrelated settings write republishes the same base without clearing the palette', async () => {
  const durable = { selection: themes[0].id, base: 'system' };
  const app = harness(durable, true);
  await flush();
  for (let i = 0; i < 3; i++) {
    app.adopt('system', 14);
    await flush();
    assert.equal(app.preference, themes[0].id);
    assert.equal(durable.selection, themes[0].id);
  }
});

test('switching to another palette package prevents the previous package from restoring on restart', async () => {
  const durable = { selection: themes[0].id, base: 'dark' };
  const app = harness(durable, true);
  await flush();
  app.ctx.theme.setTheme('dsh-alpha-catppuccin-catppuccin-latte');
  await flush();
  assert.equal(durable.selection, 'off');
  app.dispose();
  const restarted = harness(durable, true);
  await flush();
  assert.equal(restarted.preference, 'system');
});

test('late network replies do not restore a disposed plugin', async () => {
  const app = harness({ selection: themes[0].id, base: 'system' }, true);
  app.dispose();
  await flush();
  assert.equal(app.preference, 'system');
});
