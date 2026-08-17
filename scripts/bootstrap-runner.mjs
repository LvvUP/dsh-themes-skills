#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skillDir = resolve(repositoryDir, 'skills/dsh-theme-manager');
const runtimeDir = resolve(skillDir, 'runtime');
const runtimePackagePath = resolve(runtimeDir, 'package.json');
const expectedPackageManager =
  'pnpm@11.7.0+sha512.19cc852c120c7125760f2443ee6be0ca5b40f9f50598de1a09a1f177503e010e57c23c77646e01e761de59bf874fb22a3398c33ab9691fc13eb946b6f0f4d620';

const runtimePackage = JSON.parse(await readFile(runtimePackagePath, 'utf8'));
if (runtimePackage.packageManager !== expectedPackageManager) {
  throw new Error('runtime packageManager differs from the certified pnpm baseline');
}

const corepack = process.platform === 'win32' ? 'corepack.cmd' : 'corepack';
const install = spawnSync(
  corepack,
  ['pnpm', 'install', '--frozen-lockfile', '--ignore-scripts'],
  {
    cwd: runtimeDir,
    env: {
      ...process.env,
      COREPACK_ENABLE_PROJECT_SPEC: '1',
      COREPACK_ENABLE_STRICT: '1',
    },
    stdio: 'inherit',
  }
);

if (install.error) throw install.error;
if (install.status !== 0) process.exit(install.status ?? 1);

const verification = spawnSync(
  process.execPath,
  [resolve(skillDir, 'scripts/verify-runner.mjs'), '--quiet'],
  { cwd: repositoryDir, stdio: 'inherit' }
);

if (verification.error) throw verification.error;
if (verification.status !== 0) process.exit(verification.status ?? 1);

process.stdout.write('Verified runner bootstrap complete.\n');
