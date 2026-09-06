#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const TEXT_EXTENSIONS = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.txt',
  '.yaml',
  '.yml',
]);
const TEXT_FILENAMES = new Set([
  '.gitattributes',
  '.gitignore',
  'LICENSE',
  'NOTICE',
]);

function repositoryFiles() {
  const output = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
    { encoding: 'utf8' }
  );
  return output.split('\0').filter(Boolean).sort();
}

function isTextFile(file) {
  return (
    TEXT_EXTENSIONS.has(path.extname(file)) ||
    TEXT_FILENAMES.has(path.basename(file))
  );
}

const PRESERVED_SOURCE = /^(?:skills\/dsh-plugin-installer\/assets\/alpha\/adapters\/3102\/original-backend\/|skills\/(?:dsh-community-skin-installer\/assets\/alpha\/(?:community-packages\/|palettes\/(?:packages|upstream)\/)|dsh-plugin-installer\/assets\/alpha\/(?:adapters\/\d+\/(?:original\/|source\/|upstream-[^/]+\.js$)|builds\/\d+\/source\/)))/;

export function validatePreservedSources(record) {
  if (record?.schemaVersion !== 1 || !record.files || Array.isArray(record.files)) {
    throw new Error('Invalid preserved-source format manifest.');
  }
  for (const [file, digest] of Object.entries(record.files)) {
    if (!PRESERVED_SOURCE.test(file) || file.includes('\\') || file.split('/').some(part => part === '.' || part === '..') || !/^[a-f0-9]{64}$/.test(digest)) {
      throw new Error(`Invalid preserved source identity: ${file}`);
    }
  }
  return record.files;
}

function inspectText(file, source, preserveWhitespace = false) {
  const issues = [];
  if (source.charCodeAt(0) === 0xfeff) issues.push('UTF-8 BOM is not allowed');
  if (source.includes('\0')) issues.push('NUL byte is not allowed');
  if (!preserveWhitespace) {
    if (source.includes('\r')) issues.push('line endings must be LF');
    if (!source.endsWith('\n')) issues.push('file must end with one newline');
    for (const [index, line] of source.split('\n').entries()) {
      if (/[ \t]+$/.test(line)) {
        issues.push(`line ${index + 1} has trailing whitespace`);
      }
    }
  }

  if (path.extname(file) === '.json') {
    try {
      JSON.parse(source);
    } catch (error) {
      issues.push(`invalid JSON: ${error.message}`);
    }
  }
  return issues;
}

const decoder = new TextDecoder('utf-8', { fatal: true });
export function inspectFormatBytes(file, bytes, preserved = {}) {
  const failures = [];
  const expected = preserved[file];
  if (expected && createHash('sha256').update(bytes).digest('hex') !== expected) {
    failures.push('preserved source SHA-256 differs; re-review its source and runtime binding');
  }
  let source;
  try {
    source = decoder.decode(bytes);
  } catch {
    return [...failures, 'file is not valid UTF-8'];
  }
  return [...failures, ...inspectText(file, source, Boolean(expected))];
}

async function main() {
  const flags = process.argv.slice(2);
  if (flags.some(flag => flag !== '--check-index')) throw new Error('Use optional --check-index to verify staged preserved sources.');
  // These exact upstream/adapted bytes are retained for provenance. This does
  // not exempt the Alpha directory or its installers/builders from formatting.
  const preserved = validatePreservedSources(JSON.parse(await readFile(new URL('./format-preserved-source.json', import.meta.url), 'utf8')));
  const files = repositoryFiles();
  const failures = Object.keys(preserved).filter(file => !files.includes(file))
    .map(file => `${file}: preserved source is missing from the repository file set`);
  for (const [file, expected] of Object.entries(preserved)) {
    const attribute = execFileSync('git', ['check-attr', 'text', '--', file], { encoding: 'utf8' }).trim();
    if (!attribute.endsWith(': text: unset')) failures.push(`${file}: preserved source needs an exact -text attribute`);
    if (flags.includes('--check-index')) {
      try {
        const indexed = execFileSync('git', ['show', `:${file}`], { maxBuffer: 100 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
        if (createHash('sha256').update(indexed).digest('hex') !== expected) failures.push(`${file}: staged source SHA-256 differs`);
      } catch { failures.push(`${file}: preserved source is not staged`); }
    }
  }
  let checked = 0;
  for (const file of files) {
    if (!isTextFile(file) && !preserved[file]) continue;
    checked += 1;
    for (const issue of inspectFormatBytes(file, await readFile(file), preserved)) {
      failures.push(`${file}: ${issue}`);
    }
  }

  if (failures.length > 0) {
    process.stderr.write(`${failures.join('\n')}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write(`Format contract passed for ${checked} repository text files; ${Object.keys(preserved).length} preserved sources matched their exact SHA-256.\n`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
