#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { dirname, delimiter, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeDir = resolve(skillDir, 'runtime');
const dshBin = resolve(runtimeDir, 'node_modules/@deepseek-ai/dsh/lib/bin.js');
const localBin = resolve(runtimeDir, 'node_modules/.bin');
const args = process.argv.slice(2);
const THEME = /^@dsh-themes\/[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function isAllowedCommand(values) {
  if (values.length === 1 && ['--version', '-V'].includes(values[0])) return true;
  if (
    values.length === 3 &&
    values[0] === '--profile' &&
    values[1] === 'web' &&
    ['--dump-config', '--dump-default-config'].includes(values[2])
  ) {
    return true;
  }
  if (values[0] === 'plugin' && values[1] === '--profile' && values[2] === 'web') {
    const action = values[3];
    if (action === 'list') return values.length === 5 && values[4] === '--json';
    if (action === 'remove') return values.length === 5 && THEME.test(values[4]);
    if (action === 'add') {
      return (
        values.length === 6 &&
        resolve(values[4]) === values[4] &&
        values[4].endsWith('.tgz') &&
        values[5] === '--save-exact'
      );
    }
    return false;
  }
  if (values[0] === 'web') {
    const withoutPort = values.slice(1);
    if (withoutPort.length === 0) return true;
    return (
      withoutPort.length === 2 &&
      withoutPort[0] === '--port' &&
      /^(?:0|[1-9]\d{0,4})$/.test(withoutPort[1]) &&
      Number(withoutPort[1]) <= 65535
    );
  }
  return false;
}

if (!isAllowedCommand(args)) {
  fail(
    'unsupported runner command; only version, web, web dump, and exact web-profile plugin list/add/remove are allowed'
  );
}

const nodeMajor = Number(process.versions.node.split('.')[0]);
const nodeMinor = Number(process.versions.node.split('.')[1]);
if (!((nodeMajor === 22 && nodeMinor >= 19) || nodeMajor >= 24)) {
  fail('verified runner requires Node 22.19+ in Node 22, or Node 24+');
}

const verification = spawn(
  process.execPath,
  [resolve(skillDir, 'scripts/verify-runner.mjs'), '--quiet'],
  { cwd: process.cwd(), stdio: 'inherit' }
);
const verificationStatus = await new Promise((done) =>
  verification.once('exit', (code, signal) => done({ code, signal }))
);
if (verificationStatus.code !== 0 || verificationStatus.signal) {
  process.exit(verificationStatus.code ?? 1);
}

const childArgs = args[0] === 'web' ? ['web', '--host', '127.0.0.1', ...args.slice(1)] : args;
const child = spawn(process.execPath, [dshBin, ...childArgs], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    DSH_TELEMETRY_DISABLED: '1',
    PATH: `${localBin}${delimiter}${process.env.PATH ?? ''}`,
  },
  stdio: 'inherit',
});
child.once('error', (error) => fail(error.message));
const result = await new Promise((done) =>
  child.once('exit', (code, signal) => done({ code, signal }))
);
if (result.signal) {
  process.kill(process.pid, result.signal);
} else {
  process.exitCode = result.code ?? 1;
}
