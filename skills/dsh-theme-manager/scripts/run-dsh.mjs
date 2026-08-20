#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { dirname, delimiter, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import {
  ALLOWED_ADD_ARTIFACT_SHA256,
  buildDshChildArgs,
  isAllowedRunnerCommand,
} from './runner-policy.mjs';
import { snapshotAllowedArtifact } from './artifact-snapshot.mjs';

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeDir = resolve(skillDir, 'runtime-rc8');
const dshBin = resolve(runtimeDir, 'node_modules/@deepseek-ai/dsh/lib/bin.js');
const localBin = resolve(runtimeDir, 'node_modules/.bin');
const args = process.argv.slice(2);

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

async function prepareAllowedAddArtifact(values) {
  if (values[0] !== 'plugin' || values[3] !== 'add') {
    return values;
  }
  const snapshot = await snapshotAllowedArtifact(values[4], {
    workspace: process.cwd(),
    allowedDigests: ALLOWED_ADD_ARTIFACT_SHA256,
  });
  const snapshotValues = [...values];
  snapshotValues[4] = snapshot.path;
  return snapshotValues;
}

if (!isAllowedRunnerCommand(args)) {
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

let childArgs;
try {
  childArgs = buildDshChildArgs(await prepareAllowedAddArtifact(args), resolve);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
const child = spawn(process.execPath, [dshBin, ...childArgs], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    DSH_TELEMETRY_DISABLED: '1',
    PATH: `${localBin}${delimiter}${process.env.PATH ?? ''}`,
  },
  stdio: 'inherit',
});
const result = await new Promise((done) =>
  child.once('error', (error) => done({ code: 1, signal: null, error })).once(
    'exit',
    (code, signal) => done({ code, signal, error: null })
  )
);
if (result.error) {
  fail(result.error.message);
}
if (result.signal) {
  process.kill(process.pid, result.signal);
} else {
  process.exitCode = result.code ?? 1;
}
