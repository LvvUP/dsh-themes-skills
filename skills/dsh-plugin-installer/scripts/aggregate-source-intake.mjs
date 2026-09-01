#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { lstat, mkdir, open, readdir, readFile, realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadCandidateIntake } from './candidate-intake.mjs';
import { validateSourceIntakeReceipt } from './audit-candidate-source.mjs';

const FORBIDDEN = /(?:[?&]token=|\bcookie\s*:|\bauthorization\s*:|bearer\s+[a-z0-9._~-]+)/iu;
const BASE64URL_SECRET = /(?:^|[^A-Za-z0-9_-])[A-Za-z0-9_-]{43}(?:$|[^A-Za-z0-9_-])/u;

function fail(message) {
  throw new Error(message);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function walk(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = join(path, entry.name);
    if (entry.isSymbolicLink()) fail('source-intake aggregate input must not contain symlinks');
    if (entry.isDirectory()) files.push(...(await walk(target)));
    else if (entry.isFile() && entry.name === 'source-intake-receipt.json') files.push(target);
  }
  return files;
}

async function newOutput(input) {
  if (!isAbsolute(input)) fail('--out-dir must be absolute');
  const requested = resolve(input);
  if (requested === parse(requested).root) fail('--out-dir cannot be a filesystem root');
  const output = join(await realpath(dirname(requested)), basename(requested));
  try {
    await lstat(output);
    fail('--out-dir must not exist');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await mkdir(output, { mode: 0o700 });
  return realpath(output);
}

export async function aggregateSourceIntake({ input: inputPath, output: outputPath }) {
  const input = await realpath(inputPath);
  const stat = await lstat(input);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail('--input must be one real directory');
  const [intake, files] = await Promise.all([loadCandidateIntake(), walk(input)]);
  if (files.length !== intake.items.length) {
    fail(`source-intake aggregate requires ${intake.items.length} receipts, found ${files.length}`);
  }
  const receipts = [];
  for (const file of files) {
    const bytes = await readFile(file);
    const text = bytes.toString('utf8');
    if (FORBIDDEN.test(text) || BASE64URL_SECRET.test(text)) {
      fail('source-intake receipt contains forbidden BrowserAuth or credential material');
    }
    let receipt;
    try {
      receipt = JSON.parse(text);
    } catch {
      fail('source-intake receipt is not valid JSON');
    }
    const candidate = intake.items.find((item) => item.catalogId === receipt.catalogId);
    if (!candidate) fail('source-intake receipt uses an unknown public ID');
    validateSourceIntakeReceipt(receipt, candidate);
    receipts.push({
      catalogId: receipt.catalogId,
      status: receipt.status,
      receiptSha256: sha256(bytes),
      npmSourceAvailable: receipt.npm !== null,
      replacementRequired: receipt.review.replacementRequired,
    });
  }
  receipts.sort((left, right) => left.catalogId - right.catalogId);
  if (new Set(receipts.map((receipt) => receipt.catalogId)).size !== intake.items.length) {
    fail('source-intake aggregate contains duplicate or missing public IDs');
  }
  const rejected = receipts.filter((receipt) => receipt.status === 'source-intake-rejected');
  const summary = {
    schemaVersion: 1,
    status: rejected.length === 0 ? 'source-intake-review-ready' : 'source-intake-blocked',
    candidateExecuted: false,
    requiredCount: 80,
    auditedCount: receipts.length - rejected.length,
    rejectedCount: rejected.length,
    rejectedCatalogIds: rejected.map((receipt) => receipt.catalogId),
    receipts,
    publication: {
      installable: false,
      runtimeCertifiedCount: 0,
      boundary:
        'Static source intake is not legal distribution approval, runtime certification, or installation authority.',
    },
  };
  const output = await newOutput(outputPath);
  const handle = await open(join(output, 'source-intake-summary.json'), 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(summary, null, 2)}\n`);
  } finally {
    await handle.close();
  }
  return { output, summary };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (!['--input', '--out-dir'].includes(argv[index]) || !argv[index + 1]) {
      fail('usage: aggregate-source-intake.mjs --input <receipts> --out-dir <new-directory>');
    }
    options[argv[index]] = argv[++index];
  }
  if (!options['--input'] || !options['--out-dir']) fail('aggregate input and output are required');
  return options;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = await aggregateSourceIntake({
      input: options['--input'],
      output: options['--out-dir'],
    });
    process.stdout.write(
      `${JSON.stringify({
        status: result.summary.status,
        auditedCount: result.summary.auditedCount,
        rejectedCount: result.summary.rejectedCount,
        candidateExecuted: false,
      })}\n`
    );
    if (result.summary.status !== 'source-intake-review-ready') process.exitCode = 2;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
