#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

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

function inspectText(file, source) {
  const issues = [];
  if (source.charCodeAt(0) === 0xfeff) issues.push('UTF-8 BOM is not allowed');
  if (source.includes('\r')) issues.push('line endings must be LF');
  if (source.includes('\0')) issues.push('NUL byte is not allowed');
  if (!source.endsWith('\n')) issues.push('file must end with one newline');

  for (const [index, line] of source.split('\n').entries()) {
    if (/[ \t]+$/.test(line)) {
      issues.push(`line ${index + 1} has trailing whitespace`);
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
const failures = [];
let checked = 0;

for (const file of repositoryFiles()) {
  if (!isTextFile(file)) continue;
  let bytes;
  try {
    bytes = await readFile(file);
  } catch (error) {
    // `git ls-files --cached` still lists tracked files deleted by a rename
    // until the index is staged. Formatting must remain runnable against the
    // working tree while such a rename is in progress.
    if (error?.code === 'ENOENT') continue;
    throw error;
  }
  checked += 1;
  let source;
  try {
    source = decoder.decode(bytes);
  } catch {
    failures.push(`${file}: file is not valid UTF-8`);
    continue;
  }
  for (const issue of inspectText(file, source)) {
    failures.push(`${file}: ${issue}`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(
    `Format contract passed for ${checked} repository text files.\n`
  );
}
