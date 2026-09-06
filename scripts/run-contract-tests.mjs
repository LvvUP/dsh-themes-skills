#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
export function contractTestFiles(directory = root) {
  return readdirSync(resolve(directory, 'test'))
    .filter(name => name.endsWith('.test.mjs'))
    .sort().map(name => resolve(directory, 'test', name));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  // Upstream source fixtures have their own runtime/dependency prerequisites.
  // Discover every repository contract without recursively executing that data.
  const files = contractTestFiles();
  if (!files.length) throw new Error('No repository contract tests were found.');
  const result = spawnSync(process.execPath, ['--test', ...process.argv.slice(2), ...files], { cwd: root, stdio: 'inherit', shell: false });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
