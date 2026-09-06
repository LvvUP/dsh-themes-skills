import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, win32 } from 'node:path';
import test from 'node:test';
import { sourceCorepackInvocation, runSourceCommand } from '../skills/dsh-theme-manager/scripts/dsh-alpha.mjs';

test('Windows starts pinned Corepack JavaScript through Node without a cmd shell', () => {
  const args = ['pnpm', '--silent', 'dsh', 'plugin', '--profile', 'web', 'add', 'C:\\drafts with spaces\\one; two.tgz'];
  for (const nodeExecutable of ['C:\\Program Files\\nodejs\\node.exe', 'D:\\portable node\\node.exe']) {
    const result = sourceCorepackInvocation(args, { platform: 'win32', nodeExecutable });
    assert.equal(result.command, nodeExecutable);
    assert.equal(result.args[0], win32.join(win32.dirname(nodeExecutable), 'node_modules/corepack/dist/corepack.js'));
    assert.deepEqual(result.args.slice(1), args);
    assert.ok(!result.command.endsWith('.cmd'));
  }
});

test('Linux and macOS retain the original Corepack command and exact argument array', () => {
  const args = ['pnpm', 'install', '--frozen-lockfile'];
  for (const platform of ['linux', 'darwin']) assert.deepEqual(sourceCorepackInvocation(args, { platform }), { command: 'corepack', args });
});

test('actual Node spawn preserves spaces and shell syntax as ordinary argument bytes', async t => {
  const root = await mkdtemp(join(tmpdir(), 'alpha argv fixture '));
  t.after(() => rm(root, { recursive: true, force: true }));
  const file = join(root, 'received.json'), entry = join(root, 'corepack fixture.mjs');
  await writeFile(entry, `import {writeFileSync} from 'node:fs';writeFileSync(${JSON.stringify(file)},JSON.stringify(process.argv.slice(2)));`);
  const args = ['pnpm', '--silent', 'dsh', 'a path with spaces', 'literal; metacharacters', '$(not-executed)', '"quoted"'];
  assert.equal(await runSourceCommand(process.execPath, [entry, ...args], root), 0);
  assert.deepEqual(JSON.parse(await readFile(file)), args);
});
