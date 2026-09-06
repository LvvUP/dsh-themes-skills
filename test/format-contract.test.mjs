import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { inspectFormatBytes, validatePreservedSources } from '../scripts/check-format.mjs';

const file = 'skills/dsh-plugin-installer/assets/alpha/adapters/3025/original/package.json';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = bytes => validatePreservedSources({ schemaVersion: 1, files: { [file]: digest(bytes) } });

test('reviewed original whitespace requires the exact preserved bytes', () => {
  const original = Buffer.from('{"upstream": true}  \r\n');
  const preserved = manifest(original);
  assert.deepEqual(inspectFormatBytes(file, original, preserved), []);
  assert.match(inspectFormatBytes(file, Buffer.from('{"upstream": true}\n'), preserved).join(), /SHA-256 differs/);
});

test('new source files and first-party helpers keep the complete format contract', () => {
  const original = Buffer.from('{"upstream": true}  \r\n');
  assert.match(inspectFormatBytes(file.replace('3025', '9999'), original, manifest(original)).join(), /line endings must be LF/);
  assert.throws(() => validatePreservedSources({ schemaVersion: 1, files: { 'skills/dsh-plugin-installer/scripts/install-plugins.mjs': digest(original) } }), /Invalid preserved source identity/);
  assert.throws(() => validatePreservedSources({ schemaVersion: 1, files: { [file.replace('original/', 'original/../')]: digest(original) } }), /Invalid preserved source identity/);
});

test('preserved byte identity never bypasses UTF-8, NUL or JSON validity', () => {
  for (const [bytes, expected] of [[Buffer.from([0xff]), /UTF-8/], [Buffer.from('{"x":"\0"}\n'), /NUL byte/], [Buffer.from('{broken}\n'), /invalid JSON/]]) {
    assert.match(inspectFormatBytes(file, bytes, manifest(bytes)).join(), expected);
  }
});

test('the format CLI validates preserved SVG bytes even outside the text extension list', () => {
  const directory = realpathSync(mkdtempSync(path.join(tmpdir(), 'dsh-format-svg-test-')));
  try {
    const svg = 'skills/dsh-plugin-installer/assets/alpha/adapters/3025/original/assets/demo.svg';
    const original = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg">\r\n</svg>\r\n');
    const checker = path.join(directory, 'scripts/check-format.mjs');
    mkdirSync(path.dirname(checker), { recursive: true });
    mkdirSync(path.dirname(path.join(directory, svg)), { recursive: true });
    copyFileSync(new URL('../scripts/check-format.mjs', import.meta.url), checker);
    writeFileSync(path.join(directory, 'scripts/format-preserved-source.json'), JSON.stringify({ schemaVersion: 1, files: { [svg]: digest(original) } }) + '\n');
    writeFileSync(path.join(directory, '.gitattributes'), `* text=auto eol=lf\n/${svg} -text\n`);
    writeFileSync(path.join(directory, svg), original);
    execFileSync('git', ['init', '--quiet'], { cwd: directory, stdio: 'pipe' });
    const run = () => spawnSync(process.execPath, [checker], { cwd: directory, encoding: 'utf8' });
    const accepted = run();
    assert.equal(accepted.status, 0, accepted.stderr);
    assert.match(accepted.stdout, /1 preserved sources matched their exact SHA-256/);
    writeFileSync(path.join(directory, svg), original.toString().replaceAll('\r\n', '\n'));
    const mutated = run();
    assert.equal(mutated.status, 1, 'normalizing a preserved SVG must fail the actual CLI');
    assert.match(mutated.stderr, /demo\.svg: preserved source SHA-256 differs/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
