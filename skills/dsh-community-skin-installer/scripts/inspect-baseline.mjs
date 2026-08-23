#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

function fail(message) {
  throw new Error(`community baseline refused: ${message}`);
}

const laneName = process.argv[2] ?? 'certified';
if (!['certified', 'candidate'].includes(laneName) || process.argv.length > 3) {
  fail('usage: inspect-baseline.mjs [certified|candidate]');
}
const policy = JSON.parse(
  await readFile(new URL('../references/baseline-policy.json', import.meta.url))
);
const lane = policy[laneName];
const evidencePath = laneName === 'candidate' ? lane.evidencePath : lane.catalogPath;
const evidenceSha256 = laneName === 'candidate' ? lane.evidenceSha256 : lane.catalogSha256;
const [evidenceBytes, receiptBytes] = await Promise.all([
  readFile(new URL(`../references/${evidencePath}`, import.meta.url)),
  readFile(new URL(`../references/${lane.receiptPath}`, import.meta.url)),
]);
if (createHash('sha256').update(evidenceBytes).digest('hex') !== evidenceSha256) {
  fail(`${laneName} evidence digest differs`);
}
if (createHash('sha256').update(receiptBytes).digest('hex') !== lane.receiptSha256) {
  fail(`${laneName} receipt digest differs`);
}
const evidence = JSON.parse(evidenceBytes.toString('utf8'));
const receipt = JSON.parse(receiptBytes.toString('utf8'));
const dshVersion =
  evidence.dshPackageVersion ?? evidence.baseline?.dshPackageVersion;
if (typeof dshVersion !== 'string') fail('exact DSH version is missing');
if (
  laneName === 'candidate' &&
  (lane.status !== 'certification-pending' ||
    lane.enabled !== false ||
    lane.installable !== false ||
    evidence.certificationStatus !== 'pending' ||
    receipt.status !== 'certification-pending' ||
    receipt.installable !== false ||
    receipt.matrix?.completedJobs !== 0 ||
    receipt.summary?.itemsVerified !== 0 ||
    receipt.items?.length !== 11 ||
    receipt.items.some(
      (item) =>
        item.status !== 'pending' ||
        item.installable !== false ||
        item.receipt !== null
    ))
) {
  fail('candidate receipt is malformed or attempts promotion');
}
process.stdout.write(`${JSON.stringify({
  lane: laneName,
  status: lane.status,
  enabled: lane.enabled,
  installable: lane.installable,
  dshVersion,
  evidenceSha256,
  receiptSha256: lane.receiptSha256,
  itemsVerified: receipt.summary?.itemsVerified ?? receipt.summary?.runtimeMatrixPassed,
  blockers: evidence.blockers ?? [],
})}\n`);
