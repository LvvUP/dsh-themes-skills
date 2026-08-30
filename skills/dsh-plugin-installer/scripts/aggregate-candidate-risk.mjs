#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { lstat, mkdir, open, readdir, readFile, realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateCandidateStaticRiskReceipt } from './audit-candidate-risk.mjs';
import { loadCandidateIntake } from './candidate-intake.mjs';

const MAX_RECEIPT_BYTES = 2 * 1024 * 1024;
const FORBIDDEN = /(?:[?&]token=|\bcookie\s*:|\bauthorization\s*:|bearer\s+[a-z0-9._~-]+|-----BEGIN [A-Z ]*PRIVATE KEY-----)/iu;

function fail(message) {
  throw new Error(message);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

async function walk(path, state = { entries: 0 }) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    state.entries += 1;
    if (state.entries > 1000) fail('static-risk aggregate input exceeds its entry bound');
    const target = join(path, entry.name);
    if (entry.isSymbolicLink()) fail('static-risk aggregate input must not contain symlinks');
    if (entry.isDirectory()) files.push(...(await walk(target, state)));
    else if (entry.isFile() && entry.name === 'static-risk-receipt.json') files.push(target);
  }
  return files;
}

async function newOutput(input) {
  if (!isAbsolute(input)) fail('--out-dir must be absolute');
  const requested = resolve(input);
  const name = basename(requested);
  if (requested === parse(requested).root || ['.', '..'].includes(name) ||
      name !== basename(input)) {
    fail('--out-dir must be one bounded new directory');
  }
  const output = join(await realpath(dirname(requested)), name);
  try {
    await lstat(output);
    fail('--out-dir must not exist');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await mkdir(output, { mode: 0o700 });
  return realpath(output);
}

export async function aggregateCandidateStaticRisk({ input: inputPath, output: outputPath }) {
  if (!isAbsolute(inputPath)) fail('--input must be absolute');
  const requestedInput = resolve(inputPath);
  const requestedStat = await lstat(requestedInput);
  if (!requestedStat.isDirectory() || requestedStat.isSymbolicLink()) {
    fail('--input must be one real directory');
  }
  const input = await realpath(requestedInput);
  const [intake, files] = await Promise.all([loadCandidateIntake(), walk(input)]);
  if (files.length !== intake.items.length) {
    fail(`static-risk aggregate requires ${intake.items.length} receipts, found ${files.length}`);
  }

  const receipts = [];
  const signalCounts = new Map();
  for (const file of files) {
    const fileStat = await lstat(file);
    if (!fileStat.isFile() || fileStat.isSymbolicLink() || fileStat.size < 2 ||
        fileStat.size > MAX_RECEIPT_BYTES) {
      fail('static-risk receipt is not one bounded regular file');
    }
    const bytes = await readFile(file);
    const text = bytes.toString('utf8');
    if (FORBIDDEN.test(text)) {
      fail('static-risk receipt contains forbidden BrowserAuth or credential material');
    }
    let receipt;
    try {
      receipt = JSON.parse(text);
    } catch {
      fail('static-risk receipt is not valid JSON');
    }
    const candidate = intake.items.find((item) => item.catalogId === receipt.catalogId);
    if (!candidate) fail('static-risk receipt uses an unknown public ID');
    validateCandidateStaticRiskReceipt(receipt, candidate);
    for (const finding of receipt.scan.findings) {
      signalCounts.set(finding.id, (signalCounts.get(finding.id) ?? 0) + finding.occurrences);
    }
    receipts.push({
      catalogId: receipt.catalogId,
      receiptSha256: sha256(bytes),
      tree: receipt.source.tree,
      requiresElevatedStaticReview: receipt.classification.requiresElevatedStaticReview,
      rawWebRouteAuthState: receipt.classification.rawWebRouteAuthState,
      alpha1RemovedPackages: receipt.classification.alpha1RemovedPackages,
      highReviewSignalIds: receipt.scan.findings
        .filter((finding) => finding.severity === 'high-review')
        .map((finding) => finding.id)
        .sort(),
    });
  }
  receipts.sort((left, right) => left.catalogId - right.catalogId);
  if (new Set(receipts.map((receipt) => receipt.catalogId)).size !== intake.items.length ||
      receipts.some((receipt, index) => receipt.catalogId !== intake.items[index].catalogId)) {
    fail('static-risk aggregate contains duplicate or missing public IDs');
  }

  const rawRouteReviewCatalogIds = receipts
    .filter((receipt) => receipt.rawWebRouteAuthState !== 'no-raw-webserver-route-found')
    .map((receipt) => receipt.catalogId);
  const summary = {
    schemaVersion: 1,
    status: 'static-risk-review-queue-ready',
    authorityEffect: 'none-review-prioritization-only',
    candidateExecuted: false,
    requiredCount: 80,
    auditedCount: receipts.length,
    priorityReviewCount: receipts.filter((receipt) =>
      receipt.requiresElevatedStaticReview).length,
    rawRouteReviewCatalogIds,
    rawRouteWithoutOfficialAuthReferenceCatalogIds: receipts
      .filter((receipt) =>
        receipt.rawWebRouteAuthState === 'raw-route-without-official-auth-reference')
      .map((receipt) => receipt.catalogId),
    alpha1RemovedPackageCatalogIds: receipts
      .filter((receipt) => receipt.alpha1RemovedPackages.length > 0)
      .map((receipt) => receipt.catalogId),
    signalCounts: Object.fromEntries([...signalCounts.entries()].sort(([left], [right]) =>
      left.localeCompare(right))),
    receipts,
    publication: {
      installable: false,
      runtimeCertifiedCount: 0,
      boundary:
        'Static risk signals only prioritize human review; they are not compatibility, legal, distribution, runtime, installation, or Top 10 authority.',
    },
  };
  const output = await newOutput(outputPath);
  const handle = await open(join(output, 'static-risk-summary.json'), 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(stable(summary), null, 2)}\n`);
  } finally {
    await handle.close();
  }
  return { output, summary };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (!['--input', '--out-dir'].includes(argv[index]) || !argv[index + 1] || options[argv[index]]) {
      fail('usage: aggregate-candidate-risk.mjs --input <receipts> --out-dir <new-directory>');
    }
    options[argv[index]] = argv[++index];
  }
  if (!options['--input'] || !options['--out-dir'] || Object.keys(options).length !== 2) {
    fail('static-risk aggregate input and output are required');
  }
  return options;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await aggregateCandidateStaticRisk({
      input: options['--input'],
      output: options['--out-dir'],
    });
    process.stdout.write(`${JSON.stringify({
      status: result.summary.status,
      auditedCount: result.summary.auditedCount,
      priorityReviewCount: result.summary.priorityReviewCount,
      candidateExecuted: false,
    })}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
