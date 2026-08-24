#!/usr/bin/env node

import { mkdir, readdir, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve, sep } from 'node:path';

import {
  EXPECTED_GITHUB_WORKFLOW_REF,
  sha256,
} from './rc2-final-contract.mjs';
import {
  FINAL_ATTESTATION_FILE,
  FINAL_CERTIFICATION_FILE,
  buildFinalAttestation,
  buildFinalCertificationReceipt,
  loadAndValidateMatrixReceiptSet,
  validateFinalCertificationBundle,
} from './rc2-final-evidence.mjs';

const SHA = /^[a-f0-9]{40}$/;
const DIGITS = /^\d+$/;

function fail(message) {
  throw new Error(`RC.2 finalization refused: ${message}`);
}

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value == null || values.has(key)) {
      fail('usage: finalize-rc2-certification.mjs --receipts <absolute-directory> --output <absolute-directory>');
    }
    values.set(key, value);
  }
  if (
    values.size !== 2 ||
    !values.has('--receipts') ||
    !values.has('--output')
  ) {
    fail('usage: finalize-rc2-certification.mjs --receipts <absolute-directory> --output <absolute-directory>');
  }
  const receiptsDirectory = values.get('--receipts');
  const outputDirectory = values.get('--output');
  if (!isAbsolute(receiptsDirectory) || !isAbsolute(outputDirectory)) {
    fail('receipt and output directories must be absolute');
  }
  const receipts = resolve(receiptsDirectory);
  const output = resolve(outputDirectory);
  if (
    receipts === output ||
    receipts.startsWith(`${output}${sep}`) ||
    output.startsWith(`${receipts}${sep}`)
  ) {
    fail('receipt and output directories must be separate and non-nested');
  }
  return { receiptsDirectory: receipts, outputDirectory: output };
}

function githubEnvironment() {
  const environment = {
    githubActions: process.env.GITHUB_ACTIONS,
    repository: process.env.GITHUB_REPOSITORY,
    serverUrl: process.env.GITHUB_SERVER_URL,
    workflow: process.env.GITHUB_WORKFLOW,
    workflowRef: process.env.GITHUB_WORKFLOW_REF,
    runId: process.env.GITHUB_RUN_ID,
    runAttempt: process.env.GITHUB_RUN_ATTEMPT,
    job: process.env.GITHUB_JOB,
    ref: process.env.GITHUB_REF,
    headSha: process.env.GITHUB_SHA,
  };
  if (
    environment.githubActions !== 'true' ||
    environment.repository !== 'LvvUP/dsh-themes-skills' ||
    environment.serverUrl !== 'https://github.com' ||
    environment.workflow !== 'RC.2 final baseline certification' ||
    environment.workflowRef !== EXPECTED_GITHUB_WORKFLOW_REF ||
    !DIGITS.test(environment.runId ?? '') ||
    !DIGITS.test(environment.runAttempt ?? '') ||
    environment.job !== 'finalize' ||
    environment.ref !== 'refs/heads/main' ||
    !SHA.test(environment.headSha ?? '')
  ) {
    fail('final evidence may be issued only by the pinned GitHub Actions finalizer');
  }
  return {
    provider: 'github-actions',
    repository: environment.repository,
    serverUrl: environment.serverUrl,
    workflow: environment.workflow,
    workflowRef: environment.workflowRef,
    runId: environment.runId,
    runAttempt: environment.runAttempt,
    runUrl: `${environment.serverUrl}/${environment.repository}/actions/runs/${environment.runId}/attempts/${environment.runAttempt}`,
    job: environment.job,
    ref: environment.ref,
    headSha: environment.headSha,
  };
}

function assertSameRun(receiptSet, issuer) {
  const matrix = receiptSet.github;
  for (const key of [
    'repository',
    'workflow',
    'workflowRef',
    'runId',
    'runAttempt',
    'ref',
    'headSha',
  ]) {
    if (matrix[key] !== issuer[key]) {
      fail(`matrix receipts and finalizer disagree on GitHub ${key}`);
    }
  }
}

async function prepareEmptyOutput(directory) {
  await mkdir(directory, { recursive: true });
  if ((await readdir(directory)).length !== 0) {
    fail('output directory must be empty');
  }
  await mkdir(resolve(directory, 'matrix'), { mode: 0o700 });
}

async function writeJson(path, value) {
  const bytes = Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
  await writeFile(path, bytes, { mode: 0o600 });
  return bytes;
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const issuer = githubEnvironment();
  const receiptSet = await loadAndValidateMatrixReceiptSet(
    args.receiptsDirectory
  );
  assertSameRun(receiptSet, issuer);
  await prepareEmptyOutput(args.outputDirectory);

  for (const receipt of receiptSet.receipts) {
    const path = resolve(
      args.outputDirectory,
      'matrix',
      `${receipt.platform}-node-${receipt.nodeVersion}.json`
    );
    await writeFile(path, receipt.bytes, { mode: 0o600 });
  }

  const issuedAt = new Date().toISOString();
  const attestation = buildFinalAttestation({
    receiptSet,
    issuer,
    issuedAt,
  });
  const attestationBytes = await writeJson(
    resolve(args.outputDirectory, FINAL_ATTESTATION_FILE),
    attestation
  );
  const certification = buildFinalCertificationReceipt({
    attestationSha256: sha256(attestationBytes),
    issuer,
    issuedAt,
  });
  await writeJson(
    resolve(args.outputDirectory, FINAL_CERTIFICATION_FILE),
    certification
  );

  const result = await validateFinalCertificationBundle(args.outputDirectory);
  process.stdout.write(
    `${JSON.stringify({ output: args.outputDirectory, ...result })}\n`
  );
}

await run();
