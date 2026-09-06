import assert from 'node:assert/strict';
import test from 'node:test';
import presets from './presets.json' with { type: 'json' };
import { DEFAULT_STATE, normalizeState } from './state.mjs';
test('the adaptation keeps 21 unique preset seed palettes', () => {
  assert.equal(presets.length, 21);
  assert.equal(new Set(presets.map((preset) => preset.id)).size, 21);
  for (const preset of presets) assert.equal(normalizeState({ ...DEFAULT_STATE, id: preset.id, seeds: preset.seeds }).id, preset.id);
});
test('preferences reject unsafe content before persistence', () => {
  for (const patch of [{ id: '../../other' }, { image: 'https://example.com/a.png' }, { image: 'data:image/svg+xml;base64,AAA=' }, { opacity: 2 }, { seeds: { ...DEFAULT_STATE.seeds, accent: 'url(https://example.com)' } }]) assert.throws(() => normalizeState({ ...DEFAULT_STATE, ...patch }));
});

const { preserveSelection } = await import('./theme-persistence.mjs');
test('Alpha base adoption restores the saved palette but a user theme change disables it', async () => {
  let selected = true, preference = 'custom-palette', snapshot = { status: 'loading' };
  const listeners = [], baseListeners = [];
  const ctx = {
    settingsScope: { bind: () => ({ getSnapshot: () => snapshot, subscribe: (fn) => { baseListeners.push(fn); return () => {}; } }) },
    effect: (fn) => fn(), on: (_event, fn) => listeners.push(fn),
    theme: { getTheme: () => ({ preference }), setTheme: (value) => { preference = value; listeners.forEach((fn) => fn({ preference })); } },
  };
  preserveSelection(ctx, { themeId: 'custom-palette', isSelected: () => selected, disable: () => { selected = false; } });
  const flush = () => new Promise(setImmediate);
  const adopt = (value) => { snapshot = { status: 'ready', value: { preference: value } }; ctx.theme.setTheme(value); baseListeners.forEach((fn) => fn()); };
  adopt('system'); await flush();
  assert.equal(preference, 'custom-palette'); assert.equal(selected, true);
  adopt('system'); await flush();
  assert.equal(preference, 'custom-palette'); assert.equal(selected, true);
  ctx.theme.setTheme('dark'); await flush();
  assert.equal(preference, 'dark'); assert.equal(selected, false);
});
