#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { lstat, mkdir, realpath, rm } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadAuthority } from './authority.mjs';
import { verifySourceCheckout } from './verify-source.mjs';

function fail(message) {
  throw new Error(message);
}

async function destination(input) {
  if (!isAbsolute(input)) fail('--output must be an absolute path');
  const requested = resolve(input);
  if (requested === parse(requested).root) fail('--output cannot be a filesystem root');
  try {
    await lstat(requested);
    fail('--output must not already exist');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const parent = dirname(requested);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  return join(await realpath(parent), basename(requested));
}

export async function prepareSource(input, authority) {
  const output = await destination(input);
  let created = false;
  try {
    const clone = spawnSync('git', [
      'clone', '--no-checkout', '--filter=blob:none', '--single-branch',
      '--branch', authority.release.tag, authority.officialRepository, output,
    ], { encoding: 'utf8', shell: false });
    created = true;
    if (clone.status !== 0) fail(`git clone failed: ${(clone.stderr || clone.stdout).trim()}`);
    const checkout = spawnSync('git', ['-C', output, 'checkout', '--detach', authority.release.commit], {
      encoding: 'utf8',
      shell: false,
    });
    if (checkout.status !== 0) fail(`git checkout failed: ${(checkout.stderr || checkout.stdout).trim()}`);
    const verified = await verifySourceCheckout(output, authority);
    return { ...verified, source: '<local-source-root>', officialBinary: false, pathInstalled: false };
  } catch (error) {
    if (created) await rm(output, { recursive: true, force: true });
    throw error;
  }
}

function parseArgs(argv) {
  if (argv.length !== 2 || argv[0] !== '--output') fail('usage: prepare-source.mjs --output <new-absolute-directory>');
  return argv[1];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = await prepareSource(parseArgs(process.argv.slice(2)), await loadAuthority());
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
