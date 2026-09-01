#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { lstat, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadReplacementRuntimePlan,
  requireReadyReplacementRuntimePlan,
} from './plugin-replacement-runtime-plan.mjs';

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const allowed = new Set([
    '--candidate-key',
    '--candidate-source',
    '--harness-source',
    '--build-receipt',
    '--artifact-output',
    '--output',
    '--tuple',
  ]);
  const values = {};
  if (argv.length !== allowed.size * 2) fail('replacement executor argument count mismatch');
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(key) || value === undefined || values[key] !== undefined) {
      fail('invalid or duplicate replacement executor argument');
    }
    values[key] = value;
  }
  if (
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+(?:#[A-Za-z0-9_./-]+)?$/u.test(
      values['--candidate-key']
    ) ||
    !/^(?:linux-x64|darwin-arm64|win32-x64)-node-(?:22\.19\.0|24\.15\.0)$/u.test(
      values['--tuple']
    ) ||
    ![
      values['--candidate-source'],
      values['--harness-source'],
      values['--build-receipt'],
      values['--artifact-output'],
      values['--output'],
    ].every(isAbsolute)
  ) {
    fail('replacement executor requires one exact candidate, tuple, and absolute private paths');
  }
  return {
    candidateKey: values['--candidate-key'],
    candidateSource: resolve(values['--candidate-source']),
    harnessSource: resolve(values['--harness-source']),
    buildReceipt: resolve(values['--build-receipt']),
    artifactOutput: resolve(values['--artifact-output']),
    output: resolve(values['--output']),
    tuple: values['--tuple'],
  };
}

function assertActualTuple(tuple) {
  const actual = `${process.platform}-${process.arch}-node-${process.versions.node}`;
  if (tuple !== actual) {
    fail('replacement executor runner does not match the exact matrix tuple');
  }
}

function checkoutIdentity(checkoutRoot, candidate) {
  const result = spawnSync(
    'git',
    ['-C', checkoutRoot, 'rev-parse', 'HEAD', 'HEAD^{tree}'],
    {
      encoding: 'utf8',
      env: {
        PATH: process.env.PATH,
        GIT_CONFIG_NOSYSTEM: '1',
        GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
        GIT_TERMINAL_PROMPT: '0',
        GIT_OPTIONAL_LOCKS: '0',
      },
      shell: false,
      timeout: 30_000,
      windowsHide: true,
    }
  );
  const lines = result.stdout?.trim().split(/\r?\n/u) ?? [];
  if (
    result.error ||
    result.status !== 0 ||
    result.stderr?.trim() !== '' ||
    lines.length !== 2 ||
    lines[0] !== candidate.source.commit ||
    lines[1] !== candidate.source.tree
  ) {
    fail('replacement checkout does not match the exact migration-map commit and tree');
  }
}

async function requireRealPackageRoot(checkoutRoot, sourceSubdir) {
  let current = checkoutRoot;
  if (sourceSubdir !== '.') {
    for (const segment of sourceSubdir.split('/')) {
      current = join(current, segment);
      const stat = await lstat(current);
      if (stat.isSymbolicLink()) fail('replacement source subdirectory traverses a symlink');
    }
  }
  const packageRoot = await realpath(current);
  const rel = relative(checkoutRoot, packageRoot);
  if (rel.startsWith('..') || isAbsolute(rel)) fail('replacement source escapes its checkout');
  const stat = await lstat(packageRoot);
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    fail('replacement package root must be one real directory');
  }
}

export async function requireReviewedReplacementExecutor(options) {
  const context = await loadReplacementRuntimePlan();
  requireReadyReplacementRuntimePlan(context.plan, context.map, context);
  const candidate = context.plan.candidates.find(
    (entry) => entry.candidateKey === options.candidateKey
  );
  if (candidate === undefined) fail('candidate key is outside the replacement runtime plan');
  const checkoutRoot = await realpath(options.candidateSource);
  checkoutIdentity(checkoutRoot, candidate);
  await requireRealPackageRoot(checkoutRoot, candidate.source.sourceSubdir);
  if (candidate.distributionClass === 'hosted-adaptation-required') {
    fail(
      `${candidate.candidateToken} is a non-installing hosted adaptation candidate; ` +
        'its reviewed candidate-specific executor is not bundled'
    );
  }
  fail(
    `${candidate.candidateToken} has no reviewed candidate-specific functional executor; ` +
      'refusing to run untrusted code or fabricate runtime evidence'
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    assertActualTuple(options.tuple);
    await Promise.all([
      lstat(options.candidateSource),
      lstat(options.harnessSource),
      lstat(options.buildReceipt),
      lstat(join(options.candidateSource, '.git')),
    ]);
    await requireReviewedReplacementExecutor(options);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
