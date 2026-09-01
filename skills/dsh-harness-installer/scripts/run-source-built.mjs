#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, readFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadAuthority, validateBuildReceipt } from './authority.mjs';
import { verifySourceCheckout } from './verify-source.mjs';

function fail(message) {
  throw new Error(message);
}

export function parseRunArgs(argv) {
  const separator = argv.indexOf('--');
  if (separator < 0) fail('usage: run-source-built.mjs --source <absolute-checkout> --receipt <absolute-json> -- <dsh-args>');
  const options = {};
  for (let index = 0; index < separator; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!value || !['--source', '--receipt'].includes(key)) fail('invalid runner option');
    options[key.slice(2)] = value;
  }
  const dshArgs = argv.slice(separator + 1);
  if (!options.source || !options.receipt || dshArgs.length === 0) fail('source, receipt, and DSH arguments are required');
  if (dshArgs[0] === '--version') {
    if (dshArgs.length !== 1) fail('--version accepts no additional arguments');
  } else if (dshArgs[0] === 'web') {
    if (JSON.stringify(dshArgs) !== JSON.stringify(['web', '--no-open'])) {
      fail('Harness installer permits only the exact loopback launch: web --no-open');
    }
  } else {
    fail('Harness installer runner allows only --version or web --no-open; use the dedicated plugin installer for profile mutation');
  }
  return { ...options, dshArgs };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseRunArgs(process.argv.slice(2));
    if (!isAbsolute(options.receipt)) fail('--receipt must be absolute');
    const authority = await loadAuthority();
    const verified = await verifySourceCheckout(options.source, authority);
    const receipt = validateBuildReceipt(JSON.parse(await readFile(resolve(options.receipt), 'utf8')), authority);
    const builtCli = join(verified.source, authority.source.builtCliPath);
    const stat = await lstat(builtCli);
    if (!stat.isFile() || stat.isSymbolicLink()) fail('built CLI is missing or not a regular file');
    const builtCliSha256 = createHash('sha256').update(await readFile(builtCli)).digest('hex');
    if (builtCliSha256 !== receipt.result.builtCliSha256) {
      fail('built CLI digest does not match the private source-build receipt');
    }
    const child = spawnSync(process.execPath, [builtCli, ...options.dshArgs], {
      cwd: verified.source,
      stdio: 'inherit',
      shell: false,
    });
    if (child.error) throw child.error;
    process.exitCode = child.status ?? 1;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
