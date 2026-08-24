#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

function fail(message) {
  throw new Error(`authoring baseline refused: ${message}`);
}

const laneName = process.argv[2] ?? 'certified';
if (
  !['certified', 'certifiedRuntimeBaseline', 'candidate'].includes(laneName) ||
  process.argv.length > 3
) {
  fail(
    'usage: inspect-baseline.mjs [certified|certifiedRuntimeBaseline|candidate]'
  );
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
    lane.historicalAtCapture !== true ||
    lane.enabled !== false ||
    evidence.certificationStatus !== 'pending' ||
    evidence.installable !== false ||
    evidence.matrix?.completedJobs !== 0)
) {
  fail('candidate is malformed or attempts promotion');
}
if (
  laneName === 'certifiedRuntimeBaseline' &&
  (lane.status !== 'baseline-certified' ||
    lane.certificationStatus !== 'verified-runtime-baseline' ||
    lane.productionReady !== true ||
    lane.installableItems !== false ||
    lane.itemInstallability !== 'separate-authority-required' ||
    lane.enabled !== false ||
    lane.authoringEnabled !== false ||
    evidence.status !== lane.status ||
    evidence.certificationStatus !== lane.certificationStatus ||
    evidence.productionReady !== true ||
    evidence.installableItems !== false ||
    evidence.capabilities?.authoringEnabled !== false ||
    evidence.itemAuthority !== 'not-granted')
) {
  fail('certified runtime baseline is malformed or enables authoring');
}
process.stdout.write(`${JSON.stringify({
  lane: laneName,
  status: lane.status,
  enabled: lane.enabled,
  productionReady: lane.productionReady,
  installableItems: lane.installableItems,
  itemInstallability: lane.itemInstallability,
  authoringEnabled: lane.authoringEnabled,
  dshVersion,
  evidenceSha256: lane.evidenceSha256,
  blockers: evidence.blockers ?? [],
})}\n`);
