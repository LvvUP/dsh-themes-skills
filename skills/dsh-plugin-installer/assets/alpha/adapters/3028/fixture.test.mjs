// Component fixture: real React element semantics, simulated hooks and document.
// This does not start DSH or prove delivery of actual DSH session events.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import test from 'node:test';
import vm from 'node:vm';

const requireReact = createRequire(resolve(process.env.DSH_FIXTURE_REACT_ROOT || process.cwd(), 'package.json'));
const React = requireReact('react');
const source = readFileSync(new URL('./source/lib/client.js', import.meta.url), 'utf8');

function fixture({ icon = '/original.svg', deferred = false } = {}) {
  function element(tag) {
    return {
      tag, attributes: {}, style: {}, children: [], parentNode: null,
      setAttribute(key, value) { this.attributes[key] = String(value); },
      getAttribute(key) { return Object.hasOwn(this.attributes, key) ? this.attributes[key] : null; },
      removeAttribute(key) { delete this.attributes[key]; },
      appendChild(child) { child.parentNode = this; this.children.push(child); },
      removeChild(child) { this.children.splice(this.children.indexOf(child), 1); child.parentNode = null; },
    };
  }
  const head = element('head');
  const body = element('body');
  let initialIcon;
  if (icon !== false) {
    initialIcon = element('link'); initialIcon.setAttribute('rel', 'icon');
    if (icon !== null) initialIcon.setAttribute('href', icon);
    head.appendChild(initialIcon);
  }
  const document = { head, body, title: 'Harness', createElement: element,
    querySelector() { return head.children.find(node => node.getAttribute('rel') === 'icon') || null; },
  };
  let factory, component, disposal, effectState, pendingEffect, effectCalls = 0, resolveFetch;
  const fetchPaths = [];
  const waitFetch = new Promise(resolvePromise => { resolveFetch = resolvePromise; });
  const sandbox = {
    window: { __ModuleLoader__: { load(value) { factory = value.factory; } } },
    document,
    getComputedStyle(node) { return { backgroundColor: node.style.background.includes('warn') ? 'rgb(247, 166, 0)' : 'rgb(47, 178, 107)' }; },
    fetch(path) {
      fetchPaths.push(path);
      return deferred ? waitFetch : Promise.resolve({ ok: true, text: async () => '<svg><path d="M0 0"/></svg>' });
    },
  };
  vm.runInNewContext(source, sandbox, { filename: 'attention-badge-fixture.js' });
  const plugin = factory(name => {
    assert.equal(name, 'react');
    return { ...React, useEffect(effect, deps) {
      if (!effectState || deps.some((dep, index) => !Object.is(dep, effectState.deps[index]))) {
        pendingEffect = { effect, deps };
      }
    } };
  });
  plugin.apply({
    effect(factory) { disposal = factory(); },
    slots: {
      inject(name, callback) { assert.equal(name, 'shell.overlay'); return callback(); },
      register(config, next) { assert.equal(config.id, 'attention-badge'); component = next; },
    },
  });
  function render(state, pending) {
    const tree = component({ useSessions: selector => selector(state), useSessionPendingInteraction: selector => selector(pending) });
    if (pendingEffect) {
      effectState?.cleanup?.();
      effectState = { deps: pendingEffect.deps, cleanup: pendingEffect.effect() };
      pendingEffect = undefined; effectCalls += 1;
    }
    return tree;
  }
  return {
    document, initialIcon, fetchPaths, render,
    get effectCalls() { return effectCalls; },
    unmount() { effectState?.cleanup?.(); effectState = undefined; },
    dispose() { disposal(); },
    resolveFetch() { resolveFetch({ ok: true, text: async () => '<svg><path d="M0 0"/></svg>' }); },
  };
}

const flush = async () => { for (let count = 0; count < 8; count++) await Promise.resolve(); };
const sessions = { ids: ['waiting', 'done'], byId: { waiting: { completed: false }, done: { completed: true } } };

test('two actual pill children, numeric text, title and favicon follow independent pending changes', async () => {
  const host = fixture();
  let tree = host.render(sessions, new Map());
  assert.equal(host.document.title, '(1) Harness');
  await flush();
  assert.match(decodeURIComponent(host.initialIcon.getAttribute('href')), /rgb\(47, 178, 107\)/);
  tree = host.render(sessions, new Map([['waiting', { kind: 'approval' }], ['orphan', {}]]));
  assert.equal(host.effectCalls, 2, 'same sessions object with new pending map reruns effect');
  assert.ok(React.isValidElement(tree));
  const pills = React.Children.toArray(tree.props.children).map(child => child.type(child.props));
  assert.equal(pills.length, 2);
  assert.deepEqual(pills.map(pill => pill.props.children), ['1', '1']);
  assert.ok(pills.every(pill => React.isValidElement(pill) && pill.type === 'span'));
  assert.equal(tree.props['aria-label'], '1 session(s) waiting for input, 1 session(s) completed');
  assert.equal(host.document.title, '(2) Harness');
  assert.match(decodeURIComponent(host.initialIcon.getAttribute('href')), /rgb\(247, 166, 0\)/);
  assert.deepEqual(host.fetchPaths, ['/favicon.svg']);
  host.unmount();
  assert.equal(host.document.title, 'Harness');
  assert.equal(host.initialIcon.getAttribute('href'), '/original.svg');
  assert.equal(host.document.body.children.length, 0, 'theme probe removed');
  host.dispose();
});

test('pending-only resolution hides zero badge and restores document; stale summary field is ignored', async () => {
  const host = fixture();
  const state = { ids: ['a'], byId: { a: { pendingInteraction: 'stale legacy field', completed: false } } };
  host.render(state, new Map([['a', {}]]));
  await flush();
  assert.equal(host.render(state, new Map()), null);
  assert.equal(host.document.title, 'Harness');
  assert.equal(host.initialIcon.getAttribute('href'), '/original.svg');
  assert.equal(host.document.body.children.length, 0);
  host.unmount();
});

test('late favicon fetch after disposal cannot mutate the page or recreate probes', async () => {
  const host = fixture({ deferred: true, icon: false });
  host.render(sessions, new Map());
  host.dispose();
  host.unmount();
  host.resolveFetch();
  await flush();
  assert.equal(host.document.title, 'Harness');
  assert.equal(host.document.head.children.length, 0);
  assert.equal(host.document.body.children.length, 0);
});

test('existing favicon without href is retained, while a plugin-created favicon is removed', async () => {
  for (const icon of [null, false]) {
    const host = fixture({ icon });
    host.render(sessions, new Map()); await flush();
    assert.equal(host.document.head.children.length, 1);
    host.unmount();
    assert.equal(host.document.head.children.length, icon === null ? 1 : 0);
    if (icon === null) {
      assert.equal(host.document.head.children[0], host.initialIcon);
      assert.equal(host.initialIcon.getAttribute('href'), null);
    }
    assert.equal(host.document.body.children.length, 0);
  }
});
