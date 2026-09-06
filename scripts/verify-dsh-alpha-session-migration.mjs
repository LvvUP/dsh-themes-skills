#!/usr/bin/env node
/** Verify only copied official/synthetic session logs through the built Alpha backend. */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import { homedir, platform, release } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SOURCE_COMMIT = 'd347e703908d0406b7a7ef80e3a0e594d86b2215';
const SOURCE_VERSION = '0.1.3-alpha.1';
const FIXTURE =
  'packages/session/session-persistence-jsonl/tests/fixtures/released-v0-real-shapes.jsonl';
const repo = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--runtime')) {
  throw new Error(
    'Usage: node scripts/verify-dsh-alpha-session-migration.mjs [--runtime <built Alpha source>]'
  );
}
const runtime = await realpath(
  args[1] ?? path.join(homedir(), '.dsh-themes/runtimes', SOURCE_VERSION)
);
const git = (...argv) =>
  execFileSync('git', argv, { cwd: runtime, encoding: 'utf8' }).trim();
assert.equal(
  git('rev-parse', 'HEAD'),
  SOURCE_COMMIT,
  'Unexpected official source commit'
);
assert.equal(
  git('status', '--porcelain', '--untracked-files=no'),
  '',
  'Official tracked source must be clean'
);
const manifest = JSON.parse(
  await readFile(path.join(runtime, 'package.json'), 'utf8')
);
assert.equal(manifest.version, SOURCE_VERSION);

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function identity(file) {
  const st = await lstat(file, { bigint: true });
  assert(
    st.isFile() && !st.isSymbolicLink(),
    `Expected a regular file: ${file}`
  );
  return {
    sha256: sha256(await readFile(file)),
    bytes: Number(st.size),
    device: String(st.dev),
    inode: String(st.ino),
    modifiedNs: String(st.mtimeNs),
  };
}
const officialFixture = path.join(runtime, FIXTURE);
const fixtureBefore = await identity(officialFixture);
const requireBuilt = createRequire(
  path.join(runtime, 'packages/session/session-persistence-jsonl/package.json')
);
const entryFiles = [];
async function built(name, relativeEntry) {
  const file = await realpath(
    relativeEntry
      ? path.join(runtime, relativeEntry)
      : requireBuilt.resolve(name)
  );
  assert(
    file.startsWith(runtime + path.sep) &&
      file.includes(`${path.sep}lib${path.sep}`),
    `Expected a compiled module inside the fixed source: ${name}`
  );
  entryFiles.push({
    packageName: name,
    path: path.relative(runtime, file),
    ...(await identity(file)),
  });
  return import(pathToFileURL(file).href);
}
const { Context } = await built('@deepseek-ai/cordis');
const { default: JsonlSessionPersistence } = await built(
  '@deepseek-ai/dsh-session-persistence-jsonl'
);
const { SESSION_FORMAT_VERSION, Session } = await built(
  '@deepseek-ai/dsh-session'
);
const { releasedV1SessionFormatCodec } = await built(
  '@deepseek-ai/dsh-session-format-v0-to-v1'
);
await built(
  '@deepseek-ai/dsh-session-format-v1-to-v2',
  'packages/session/session-format-v1-to-v2/lib/index.js'
);
await built('@deepseek-ai/dsh-session-format-catalog');
await built('@deepseek-ai/dsh-session-persistence');
assert.equal(SESSION_FORMAT_VERSION, 2);

// The output is deliberately fixed below this checkout, never a Harness home.
const base = path.join(repo, '.cache/dsh-alpha/session-copy');
await mkdir(base, { recursive: true });
assert.equal(
  await realpath(base),
  base,
  'Evidence directory must not redirect through a symlink'
);
const runRoot = await mkdtemp(path.join(base, 'run-'));
const results = [];
const checks = [];
const startedAt = new Date().toISOString();
const line = (value) => JSON.stringify(value) + '\n';
const event = (type, seq, data, extra = {}) => ({
  type,
  seq,
  time: seq + 2,
  data,
  ...extra,
});
const currentHeader = (id) => ({
  version: 2,
  id,
  createdAt: 1,
  isSeeded: false,
  delegationDepth: 0,
});
const historicalHeader = (id, version) => ({
  type: 'session',
  version,
  id,
  createdAt: 1,
  delegationDepth: 0,
});

async function withBackend(root, action) {
  const ctx = new Context();
  try {
    await ctx.plugin(JsonlSessionPersistence, { root, compression: 'none' });
    return await action(ctx.sessionPersistence);
  } finally {
    await ctx.fiber.dispose();
  }
}
async function readSession(root, id) {
  return withBackend(root, async (persistence) => {
    const handle = await persistence.open(id, 'read');
    try {
      return {
        header: structuredClone(handle.header),
        inheritedEventCount: handle.inheritedEventCount,
        events: structuredClone(await handle.read()),
      };
    } finally {
      await handle.close();
    }
  });
}
function restoredMessages(value) {
  const fresh = structuredClone(value);
  const session = Session.fromRestore(
    fresh.header.id,
    fresh.events,
    fresh.header,
    fresh.inheritedEventCount
  );
  return session.deriveMessages();
}
async function files(directory) {
  return (await readdir(directory))
    .filter((name) => name.startsWith('session'))
    .sort();
}
async function unchanged(file, before) {
  const after = await identity(file);
  assert.deepEqual(after, before, `Source file identity changed: ${file}`);
  return after;
}
async function run(name, action) {
  const root = path.join(runRoot, name);
  await mkdir(root);
  try {
    const detail = await action(root);
    results.push({ name, status: 'passed', ...detail });
    process.stdout.write(`PASS ${name}\n`);
  } catch (error) {
    results.push({
      name,
      status: 'failed',
      error: { name: error.name, message: error.message, stack: error.stack },
    });
    process.stderr.write(`FAIL ${name}: ${error.message}\n`);
  }
}
async function put(root, id, version, rows, { cwd, header } = {}) {
  // Only two fixed fixture cwd shapes are used; neither cwd is accessed.
  assert(cwd === undefined || cwd === '/work');
  assert(/^[a-z0-9-]+$/.test(id));
  const directory = path.join(root, cwd ? '--work--' : '_no-cwd', id);
  await mkdir(directory, { recursive: true });
  const file = path.join(
    directory,
    version === 0 ? 'session.jsonl' : `session.v${version}.jsonl`
  );
  const physical =
    header ??
    (version === 2
      ? { type: 'session', ...currentHeader(id) }
      : historicalHeader(id, version));
  await writeFile(file, line(physical) + rows.map(line).join(''), {
    flag: 'wx',
  });
  return { directory, file };
}
async function successfulMigration(root, id, source, expectedFiles, inspect) {
  const before = await identity(source.file);
  await withBackend(root, async (persistence) => {
    assert.equal((await persistence.stat(id)).header.version, 2);
    assert(
      (await persistence.list()).some(
        (item) => item.header.id === id && item.header.version === 2
      )
    );
  });
  await unchanged(source.file, before);
  assert(
    !(await files(source.directory)).includes('session.v2.jsonl'),
    'stat/list must not publish v2'
  );
  const restored = await readSession(root, id);
  assert.equal(restored.header.version, 2);
  restored.events.forEach((row, index) =>
    assert.equal(row.seq, index, 'Logical sequence must remain dense')
  );
  assert(
    !restored.events.some((row) => row.type === 'assistant/chunk'),
    'v2 must embed retired top-level chunks'
  );
  const messages = restoredMessages(restored);
  await inspect(restored, messages);
  assert.deepEqual(await files(source.directory), expectedFiles);
  const current = path.join(source.directory, 'session.v2.jsonl');
  const currentBefore = await identity(current);
  assert.deepEqual(
    await readSession(root, id),
    restored,
    'Fresh backend reopen must restore the same values'
  );
  await unchanged(current, currentBefore);
  await unchanged(source.file, before);
  return {
    source: {
      path: path.relative(runRoot, source.file),
      before,
      after: await identity(source.file),
    },
    current: { path: path.relative(runRoot, current), ...currentBefore },
    eventCount: restored.events.length,
    messageIds: messages.map((message) => message.id),
    header: restored.header,
    eventTypes: restored.events.map((row) => row.type),
    reopenedWithoutRewrite: true,
    metadataLookupWithoutMigration: true,
  };
}

// Exact upstream fixture covers retry, compaction, sequence provenance, and late title input.
await run('v0-released-real-shapes', async (root) => {
  const id = 'released-v0-real-shapes';
  const directory = path.join(root, '--work--', id);
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, 'session.jsonl');
  await copyFile(officialFixture, file);
  assert.equal((await identity(file)).sha256, fixtureBefore.sha256);
  return successfulMigration(
    root,
    id,
    { file, directory },
    ['session.jsonl', 'session.v2.jsonl'],
    (restored, messages) => {
      assert.equal(
        restored.events.find((e) => e.type === 'llm/retry').data.delayMs,
        1.5
      );
      const summary = restored.events.find(
        (e) => e.type === 'compaction/summary'
      ).data;
      assert.deepEqual(summary.shadowedRange, { start: 11, end: 4 });
      assert.deepEqual(summary.shadowedSeqs, [11, 2, 3, 4]);
      const compact = restored.events.find(
        (e) => e.type === 'user/message' && e.data.id === 'checkpoint-2'
      );
      assert.deepEqual(compact.sourceEventSeqs, [12, 13, 11, 2, 3, 4]);
      assert.deepEqual(compact.surfaceOp, { op: 'replace', start: 11, end: 4 });
      const title = restored.events.find(
        (e) => e.type === 'session/title-llm-request'
      ).data;
      assert.deepEqual(title.messageSeqs, [16]);
      assert(
        title.messages[0].content[0].text.includes('{"seq":21,"text":"late"}')
      );
      for (const id of ['checkpoint-2', 'assistant-1', 'late-user'])
        assert(messages.some((m) => m.id === id));
      assert.equal(
        messages.find((m) => m.id === 'assistant-1').content[0].text,
        'hello'
      );
    }
  );
});

function toolRows({ packed = false } = {}) {
  // Synthetic extension of the upstream canonical fixture, with a matching complete tool stream.
  const rows = [];
  const add = (type, data, extra) =>
    rows.push(event(type, rows.length, data, extra));
  add('turn/start', { turn: 1 });
  add(
    'user/message',
    {
      id: 'human',
      role: 'user',
      content: [{ type: 'text', text: 'hello' }],
      source: { kind: 'user' },
    },
    { surfaceOp: 'append' }
  );
  add('step/start', { turn: 1, step: 1 });
  const chunks = [];
  for (const text of packed ? ['hel', 'lo', ''] : ['hello']) {
    chunks.push(rows.length);
    add('assistant/chunk', {
      turn: 1,
      step: 1,
      chunk: { type: 'text-delta', index: 0, text },
    });
  }
  chunks.push(rows.length);
  add('assistant/chunk', {
    turn: 1,
    step: 1,
    chunk: {
      type: 'tool-call-delta',
      index: 1,
      id: 'call',
      name: 'read',
      argumentsDelta: '{}',
    },
  });
  chunks.push(rows.length);
  add('assistant/chunk', {
    turn: 1,
    step: 1,
    chunk: { type: 'finish', reason: { kind: 'tool_calls' } },
  });
  add(
    'assistant/message',
    {
      turn: 1,
      step: 1,
      message: {
        id: 'assistant',
        role: 'assistant',
        content: [
          { type: 'text', text: 'hello' },
          { type: 'tool-call', id: 'call', name: 'read', arguments: '{}' },
        ],
        source: { kind: 'model', provider: 'mock', model: 'mock' },
      },
    },
    { sourceEventSeqs: chunks, surfaceOp: 'append' }
  );
  const callSeq = rows.length;
  add('tool/call', {
    turn: 1,
    step: 1,
    callId: 'call',
    name: 'read',
    arguments: '{}',
  });
  add(
    'tool/result',
    {
      turn: 1,
      step: 1,
      message: {
        id: 'result',
        role: 'user',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call',
            content: [{ type: 'text', text: 'ok' }],
            isError: false,
          },
        ],
        source: { kind: 'tool', callId: 'call' },
      },
      meta: { opaque: { seq: 999 } },
    },
    { sourceEventSeqs: [callSeq], surfaceOp: 'append' }
  );
  add('step/end', { turn: 1, step: 1 });
  add('turn/end', { turn: 1, reason: { kind: 'completed' } });
  return rows;
}
for (const version of [0, 1])
  await run(`v${version}-tool-semantics`, async (root) => {
    const id = `tools-v${version}`;
    const rows = toolRows();
    const source = await put(root, id, version, rows);
    return successfulMigration(
      root,
      id,
      source,
      [version ? 'session.v1.jsonl' : 'session.jsonl', 'session.v2.jsonl'],
      (restored, messages) => {
        for (const type of ['tool/call', 'tool/result'])
          assert.deepEqual(
            restored.events.find((e) => e.type === type).data,
            rows.find((e) => e.type === type).data
          );
        assert.deepEqual(
          restored.events.find((e) => e.type === 'tool/result').sourceEventSeqs,
          [4]
        );
        assert.deepEqual(
          messages.map((m) => m.id),
          ['human', 'assistant', 'result']
        );
        assert.deepEqual(
          messages.find((m) => m.id === 'result').content[0],
          rows.find((row) => row.type === 'tool/result').data.message.content[0]
        );
        assert.equal(
          restored.events.find((e) => e.type === 'assistant/message').data
            .stream[0].texts[0],
          'hello'
        );
      }
    );
  });

await run('v1-packed-and-write-resume', async (root) => {
  const id = 'packed-v1';
  const expanded = toolRows({ packed: true });
  const encoded = releasedV1SessionFormatCodec.encodeArtifact(
    {
      header: { ...currentHeader(id), version: 1 },
      inheritedEventCount: 0,
      events: expanded,
    },
    { packChunks: true }
  );
  assert(
    encoded.rows.some((row) => row.type === 'text-chunks'),
    'Fixture must exercise physical packed rows'
  );
  const source = await put(root, id, 1, encoded.rows, {
    header: encoded.header,
  });
  const lower = await put(root, id, 0, []);
  const lowerBefore = await identity(lower.file);
  const detail = await successfulMigration(
    root,
    id,
    source,
    ['session.jsonl', 'session.v1.jsonl', 'session.v2.jsonl'],
    (restored, messages) => {
      assert.equal(
        messages.find((m) => m.id === 'assistant').content[0].text,
        'hello'
      );
      assert.equal(
        restored.events
          .find((e) => e.type === 'assistant/message')
          .data.stream[0].texts.join(''),
        'hello'
      );
    }
  );
  const beforeAppend = await readSession(root, id);
  await withBackend(root, async (persistence) => {
    const handle = await persistence.open(id, 'write');
    try {
      await handle.append([
        event('turn/start', beforeAppend.events.length, { turn: 2 }),
        event('turn/end', beforeAppend.events.length + 1, {
          turn: 2,
          reason: { kind: 'completed' },
        }),
      ]);
      await handle.flush();
    } finally {
      await handle.close();
    }
  });
  const appended = await readSession(root, id);
  assert.deepEqual(
    appended.events.slice(0, beforeAppend.events.length),
    beforeAppend.events
  );
  assert.equal(appended.events.length, beforeAppend.events.length + 2);
  assert.equal(appended.events.at(-1).data.turn, 2);
  await unchanged(source.file, detail.source.before);
  await unchanged(lower.file, lowerBefore);
  return {
    ...detail,
    retainedLowerGeneration: lowerBefore,
    writeAppendFlushReopen: true,
    currentAfterAppend: await identity(
      path.join(source.directory, 'session.v2.jsonl')
    ),
  };
});

const unknown = {
  type: 'foreign/telemetry',
  seq: 0,
  time: 1,
  data: { fixtureOnly: true },
  ignorable: true,
};
await run('v2-ignorable-unknown', async (root) => {
  const id = 'ignorable-v2';
  const source = await put(root, id, 2, [unknown]);
  const before = await identity(source.file);
  const restored = await readSession(root, id);
  assert.deepEqual(restored.events, [unknown]);
  assert.deepEqual(restoredMessages(restored), []);
  assert.deepEqual(await readSession(root, id), restored);
  await unchanged(source.file, before);
  return {
    identity: before,
    eventRetained: true,
    reopenedWithoutRewrite: true,
  };
});

async function refusal(
  root,
  id,
  source,
  expectedMessage,
  expectedName = 'SessionFormatUnsupportedError'
) {
  const before = await identity(source.file);
  const names = await files(source.directory);
  const allBefore = Object.fromEntries(
    await Promise.all(
      names.map(async (name) => [
        name,
        await identity(path.join(source.directory, name)),
      ])
    )
  );
  let failure;
  try {
    await readSession(root, id);
  } catch (error) {
    failure = error;
  }
  assert(failure, 'Expected a refusal');
  assert.equal(failure.name, expectedName);
  assert.match(failure.message, expectedMessage);
  assert.deepEqual(
    await files(source.directory),
    names,
    'Refusal must not publish or remove a generation'
  );
  for (const name of names)
    await unchanged(path.join(source.directory, name), allBefore[name]);
  await unchanged(source.file, before);
  return {
    refusedWith: {
      name: failure.name,
      message: failure.message.replaceAll(runRoot, '<fixture-run>'),
    },
    source: {
      path: path.relative(runRoot, source.file),
      before,
      after: await identity(source.file),
    },
    unchangedGenerations: allBefore,
  };
}
for (const version of [0, 1])
  await run(`v${version}-unknown-refusal`, async (root) => {
    const id = `unknown-v${version}`;
    const source = await put(root, id, version, [unknown]);
    return refusal(root, id, source, /unknown (historical )?event type/);
  });
await run('future-highest-refusal', async (root) => {
  const id = 'future-wins';
  await put(root, id, 0, []);
  await put(root, id, 2, []);
  const source = await put(root, id, 42, [{ futureOnly: true }], {
    header: { type: 'session', version: 42, id, futureOnly: true },
  });
  return refusal(root, id, source, /newer|future|42/);
});
await run('malformed-v0-refusal', async (root) => {
  const id = 'malformed-v0';
  const source = await put(root, id, 0, [], { header: { version: 0, id } });
  return refusal(
    root,
    id,
    source,
    /header|member/,
    'SessionPersistenceCorruptionError'
  );
});
await run('invalid-v1-body-refusal', async (root) => {
  const id = 'invalid-v1';
  const source = await put(root, id, 1, [
    event('turn/start', 0, { turn: 'invalid' }),
  ]);
  return refusal(root, id, source, /turn|integer|number/);
});
await run('v2-nonignorable-refusal', async (root) => {
  const id = 'required-unknown-v2';
  const source = await put(root, id, 2, [{ ...unknown, ignorable: false }]);
  return refusal(root, id, source, /unknown to this harness/);
});

const fixtureAfter = await identity(officialFixture);
assert.deepEqual(
  fixtureAfter,
  fixtureBefore,
  'Official source fixture was changed'
);
assert.equal(
  git('status', '--porcelain', '--untracked-files=no'),
  '',
  'Official source was changed'
);
for (const entry of entryFiles)
  assert.deepEqual(
    await identity(path.join(runtime, entry.path)),
    Object.fromEntries(
      Object.entries(entry).filter(
        ([key]) => !['packageName', 'path'].includes(key)
      )
    )
  );
checks.push(
  'official fixture bytes/inode/mtime unchanged',
  'official tracked source remained clean',
  'selected compiled module identities unchanged'
);
const failures = results.filter((result) => result.status !== 'passed');
const receipt = {
  schemaVersion: 1,
  verification: 'dsh-alpha-session-copy-migration',
  status: failures.length ? 'failed' : 'passed',
  startedAt,
  completedAt: new Date().toISOString(),
  scope: {
    input: 'copied upstream fixture and synthetic test-only JSONL',
    compression: 'none',
    currentFormat: 2,
    realUserSessions: false,
    modelOrApiCalls: false,
    officialSourceModified: false,
  },
  runtime: {
    version: SOURCE_VERSION,
    commit: SOURCE_COMMIT,
    node: process.version,
    platform: platform(),
    architecture: process.arch,
    osRelease: release(),
    lockfileSha256: sha256(
      await readFile(path.join(runtime, 'pnpm-lock.yaml'))
    ),
  },
  script: {
    path: path.relative(repo, fileURLToPath(import.meta.url)),
    sha256: sha256(await readFile(fileURLToPath(import.meta.url))),
  },
  fixture: { path: FIXTURE, before: fixtureBefore, after: fixtureAfter },
  compiledEntryFiles: entryFiles,
  checks,
  caseCount: results.length,
  passed: results.length - failures.length,
  failed: failures.length,
  results,
  limitations: [
    'Local OS/architecture and Node version only; no cross-platform certification.',
    'Uncompressed JSONL only; no Zstandard, torn-frame, crash, disk-full, or concurrent-writer fault injection.',
    'Persistence and Session.fromRestore/deriveMessages are exercised; no model turn, agent-loop live resume, UI, or external tool execution.',
    'No fork-seed boundary migration or extension-specific third-party payload suite.',
    'Selected compiled entry files are fingerprinted here; this is not a complete dependency-closure attestation.',
  ],
};
const receiptPath = path.join(runRoot, 'receipt.json');
await writeFile(receiptPath, JSON.stringify(receipt, null, 2) + '\n', {
  flag: 'wx',
});
process.stdout.write(
  JSON.stringify({
    status: receipt.status,
    cases: results.length,
    passed: receipt.passed,
    failed: failures.length,
    receipt: receiptPath,
    sha256: sha256(await readFile(receiptPath)),
  }) + '\n'
);
if (failures.length) process.exitCode = 1;
