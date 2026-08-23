#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

function fail(message) {
  throw new Error(`submission baseline refused: ${message}`);
}

const laneName = process.argv[2] ?? 'certified';
if (!['certified', 'candidate'].includes(laneName) || process.argv.length > 3) {
  fail('usage: inspect-baseline.mjs [certified|candidate]');
}
const policy = JSON.parse(
  await readFile(new URL('../references/baseline-policy.json', import.meta.url))
);
const lane = policy[laneName];
const bytes = await readFile(
  new URL(`../references/${lane.evidencePath}`, import.meta.url)
);
if (createHash('sha256').update(bytes).digest('hex') !== lane.evidenceSha256) {
  fail(`${laneName} evidence digest differs`);
}
const evidence = JSON.parse(bytes.toString('utf8'));
const dshVersion =
  evidence.dshPackageVersion ?? evidence.compatibility?.dshPackageVersion;
if (typeof dshVersion !== 'string') fail('exact DSH version is missing');
if (
  laneName === 'candidate' &&
  (lane.status !== 'certification-pending' ||
    lane.enabled !== false ||
    evidence.certificationStatus !== 'pending' ||
    evidence.installable !== false ||
    evidence.matrix?.completedJobs !== 0)
) {
  fail('candidate is malformed or attempts promotion');
}
process.stdout.write(`${JSON.stringify({
  lane: laneName,
  status: lane.status,
  enabled: lane.enabled,
  dshVersion,
  evidenceSha256: lane.evidenceSha256,
  blockers: evidence.blockers ?? [],
})}\n`);
