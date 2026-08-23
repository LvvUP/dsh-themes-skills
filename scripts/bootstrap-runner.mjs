#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadBaselinePolicy } from '../skills/dsh-theme-manager/scripts/baseline-authority.mjs';

const repositoryDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skillDir = resolve(repositoryDir, 'skills/dsh-theme-manager');
const expectedPackageManager =
  'pnpm@11.7.0+sha512.19cc852c120c7125760f2443ee6be0ca5b40f9f50598de1a09a1f177503e010e57c23c77646e01e761de59bf874fb22a3398c33ab9691fc13eb946b6f0f4d620';
const policy = await loadBaselinePolicy();
const runtimeDirs = [
  resolve(skillDir, policy.certified.runtimeDirectory),
  resolve(skillDir, policy.candidate.runtimeDirectory),
];

// Node 24 no longer spawns .cmd shims directly on Windows. Execute Corepack's
// bundled JavaScript entry with the already-running Node binary instead of
// enabling a command shell; every install argument therefore remains a
// distinct, non-interpolated value.
const corepack =
  process.platform === 'win32'
    ? resolve(
        dirname(process.execPath),
        'node_modules/corepack/dist/corepack.js'
      )
    : 'corepack';
const corepackArgs = [
  'pnpm',
  'install',
  '--frozen-lockfile',
  '--ignore-scripts',
];
for (const runtimeDir of runtimeDirs) {
  const runtimePackage = JSON.parse(
    await readFile(resolve(runtimeDir, 'package.json'), 'utf8')
  );
  if (runtimePackage.packageManager !== expectedPackageManager) {
    throw new Error(
      `${policy.defaultOperationalLane} or candidate runtime packageManager differs from the pinned pnpm baseline`
    );
  }
  const install = spawnSync(
    process.platform === 'win32' ? process.execPath : corepack,
    process.platform === 'win32' ? [corepack, ...corepackArgs] : corepackArgs,
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
}

const verification = spawnSync(
  process.execPath,
  [resolve(skillDir, 'scripts/verify-runner.mjs'), '--quiet'],
  { cwd: repositoryDir, stdio: 'inherit' }
);

if (verification.error) throw verification.error;
if (verification.status !== 0) process.exit(verification.status ?? 1);

const candidateVerification = spawnSync(
  process.execPath,
  [resolve(skillDir, 'scripts/validate-baseline-candidate.mjs')],
  { cwd: repositoryDir, stdio: 'inherit' }
);
if (candidateVerification.error) throw candidateVerification.error;
if (candidateVerification.status !== 0) {
  process.exit(candidateVerification.status ?? 1);
}

process.stdout.write(
  'Certified operational runner and pending candidate evidence bootstrap complete.\n'
);
