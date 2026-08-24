#!/usr/bin/env node

import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validatePromotedRuntimeBaseline } from './validate-promoted-rc2-runtime-baseline.mjs';

function fail(message) {
  throw new Error(`promoted RC.2 provenance refused: ${message}`);
}

if (process.argv.length !== 2) fail('this verifier accepts no arguments');

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const referencesDirectory = resolve(scriptDirectory, '..', 'references');
const sourceSha = 'cc7546cb5ccd77002713171328972291ceaa12e6';
const runId = '32694257969';
const runAttempt = '1';
const archiveName =
  `rc2-final-baseline-certification-${sourceSha}-run-${runId}-attempt-${runAttempt}.tar.gz`;
const validated = await validatePromotedRuntimeBaseline();
if (
  validated.sourceSha !== sourceSha ||
  validated.runId !== runId ||
  validated.runAttempt !== runAttempt
) {
  fail('checked-in baseline does not match the pinned provenance invocation');
}

const child = spawn(
  process.execPath,
  [
    resolve(scriptDirectory, 'verify-rc2-final-provenance.mjs'),
    '--artifact',
    resolve(referencesDirectory, archiveName),
    '--bundle',
    resolve(referencesDirectory, `${archiveName}.sigstore.json`),
    '--run-id',
    runId,
    '--run-attempt',
    runAttempt,
    '--source-sha',
    sourceSha,
  ],
  { stdio: 'inherit' }
);

const result = await new Promise((accept, reject) => {
  child.once('error', reject);
  child.once('exit', (code, signal) => accept({ code, signal }));
});
if (result.code !== 0) {
  fail(`detached Sigstore verification failed (${result.code ?? result.signal})`);
}
