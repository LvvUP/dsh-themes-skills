#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { lstat, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  loadPluginRuntimeCandidatePlan,
  requireReadyPluginRuntimeCandidatePlan,
} from './plugin-runtime-plan.mjs';

function fail(message) {
  throw new Error(message);
}

function checkoutIdentity(checkoutRoot, expectedCommit, expectedTree) {
  const result = spawnSync('git', ['-C', checkoutRoot, 'rev-parse', 'HEAD', 'HEAD^{tree}'], {
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
  });
  const lines = result.stdout?.trim().split(/\r?\n/u) ?? [];
  if (result.error || result.status !== 0 || result.stderr?.trim() !== '' ||
      lines.length !== 2 || lines[0] !== expectedCommit || lines[1] !== expectedTree) {
    fail('candidate checkout does not match the exact runtime plan commit and tree');
  }
}

async function packageRootFromPlan(checkoutRoot, sourceSubdir) {
  let current = checkoutRoot;
  if (sourceSubdir !== '.') {
    for (const segment of sourceSubdir.split('/')) {
      current = join(current, segment);
      const stat = await lstat(current);
      if (stat.isSymbolicLink()) {
        fail('candidate package subdirectory must not traverse a symbolic link');
      }
    }
  }
  const packageRoot = await realpath(current);
  const packageInside = relative(checkoutRoot, packageRoot);
  if (packageInside.startsWith('..') || isAbsolute(packageInside)) {
    fail('candidate package subdirectory escapes the exact checkout root');
  }
  const packageStat = await lstat(packageRoot);
  if (!packageStat.isDirectory() || packageStat.isSymbolicLink()) {
    fail('candidate package subdirectory must resolve to one real directory');
  }
  return packageRoot;
}

function parseArgs(argv) {
  const allowed = new Set([
    '--catalog-id', '--candidate-source', '--harness-source', '--build-receipt',
    '--artifact-output', '--output', '--tuple',
  ]);
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(key) || value === undefined || options[key] !== undefined) {
      fail('invalid or duplicate fixed-executor argument');
    }
    options[key] = value;
  }
  if ([...allowed].some((key) => options[key] === undefined) ||
      !/^3\d{3}$/u.test(options['--catalog-id']) ||
      !/^(?:linux-x64|darwin-arm64|win32-x64)-node-(?:22\.19\.0|24\.15\.0)$/u
        .test(options['--tuple']) ||
      ![options['--candidate-source'], options['--harness-source'],
        options['--build-receipt'], options['--artifact-output'],
        options['--output']].every(isAbsolute)) {
    fail('fixed executor requires one exact candidate, tuple, and absolute private paths');
  }
  return {
    catalogId: Number(options['--catalog-id']),
    candidateSource: resolve(options['--candidate-source']),
    harnessSource: resolve(options['--harness-source']),
    buildReceipt: resolve(options['--build-receipt']),
    artifactOutput: resolve(options['--artifact-output']),
    output: resolve(options['--output']),
    tuple: options['--tuple'],
  };
}

function assertActualTuple(tuple) {
  const expected = `${process.platform}-${process.arch}-node-${process.versions.node}`;
  if (tuple !== expected) {
    fail('fixed executor runner platform, architecture, or Node version does not match the task tuple');
  }
}

export async function requireCapabilityProbeContract(options) {
  const context = await loadPluginRuntimeCandidatePlan();
  requireReadyPluginRuntimeCandidatePlan(
    context.plan,
    context.intake,
    context.intakeSha256
  );
  const item = context.plan.items.find((entry) => entry.catalogId === options.catalogId);
  if (item === undefined) fail('candidate is missing from the runtime candidate plan');
  const checkoutRoot = await realpath(options.candidateSource);
  checkoutIdentity(
    checkoutRoot,
    item.commit,
    item.artifact.source.tree
  );
  await packageRootFromPlan(checkoutRoot, item.sourceSubdir);
  const contract = new URL(`../../../${item.functionalProbe.contractPath}`, import.meta.url);
  try {
    const stat = await lstat(fileURLToPath(contract));
    if (!stat.isFile() || stat.isSymbolicLink()) fail('functional probe contract must be a regular file');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    fail(`plugin #${options.catalogId} probe contract bytes are unavailable`);
  }
  fail(
    `plugin #${options.catalogId} authorities exist but no reviewed fixed executor for the ` +
    'functional contract and complete isolated DSH HOME rollback is bundled; refusing candidate execution'
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
    await requireCapabilityProbeContract(options);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
