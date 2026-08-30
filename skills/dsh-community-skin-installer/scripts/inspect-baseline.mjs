#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

function fail(message) {
  throw new Error(`community baseline refused: ${message}`);
}

const laneName = process.argv[2] ?? 'currentAlpha1';
if (
  ![
    'currentAlpha1',
    'certified',
    'certifiedRuntimeBaseline',
    'candidate',
  ].includes(laneName) ||
  process.argv.length > 3
) {
  fail(
    'usage: inspect-baseline.mjs [currentAlpha1|certified|certifiedRuntimeBaseline|candidate]'
  );
}
const policy = JSON.parse(
  await readFile(new URL('../references/baseline-policy.json', import.meta.url))
);
const lane = policy[laneName];
const evidencePath =
  laneName === 'certified' ? lane.catalogPath : lane.evidencePath;
const evidenceSha256 =
  laneName === 'certified' ? lane.catalogSha256 : lane.evidenceSha256;
const evidenceBytes = await readFile(
  new URL(`../references/${evidencePath}`, import.meta.url)
);
if (createHash('sha256').update(evidenceBytes).digest('hex') !== evidenceSha256) {
  fail(`${laneName} evidence digest differs`);
}
let receiptBytes;
if (lane.receiptPath) {
  receiptBytes = await readFile(
    new URL(`../references/${lane.receiptPath}`, import.meta.url)
  );
  if (
    createHash('sha256').update(receiptBytes).digest('hex') !==
    lane.receiptSha256
  ) {
    fail(`${laneName} receipt digest differs`);
  }
}
const evidence = JSON.parse(evidenceBytes.toString('utf8'));
const receipt = receiptBytes
  ? JSON.parse(receiptBytes.toString('utf8'))
  : undefined;
const dshVersion =
  lane.dshPackageVersion ??
  evidence.dshPackageVersion ??
  evidence.baseline?.dshPackageVersion;
if (typeof dshVersion !== 'string') fail('exact DSH version is missing');
if (
  laneName === 'currentAlpha1' &&
  (policy.schemaVersion !== 3 ||
    policy.defaultOperationalLane !== 'currentAlpha1' ||
    lane.status !== 'alpha1-item-runtime-evidence-pending' ||
    lane.enabled !== true ||
    lane.inspectionEnabled !== true ||
    lane.installable !== false ||
    lane.dshPackageVersion !== '0.1.2-alpha.1' ||
    lane.sourceTag !== 'dsh-v0.1.2-alpha.1' ||
    lane.sourceCommit !== 'cd5ef8148158c3a752a658978873241fdf8e2bbc' ||
    lane.sourceTree !== 'a712eec535b48badc4fefb4df5176a7002e4280b' ||
    lane.communityItemsRequired !== 11 ||
    lane.communityItemsCompleted !== 0 ||
    lane.communityInstallableRecords !== 0 ||
    lane.websiteDistribution !== 'external-showcase' ||
    lane.websiteInstallability !== 'showcase-only' ||
    lane.websiteCompatibility !== 'verification-pending' ||
    evidence.baseline?.baselineId !== lane.baselineId ||
    evidence.gate?.status !== lane.status ||
    evidence.gate?.requiredItems !== 11 ||
    evidence.gate?.completedItems !== 0 ||
    evidence.gate?.requiredTasksPerItem !== 6 ||
    evidence.gate?.completedTasksPerItem !== 0 ||
    evidence.gate?.installable !== false ||
    evidence.gate?.runtimeReceiptSetSha256 !== null ||
    evidence.gate?.rollbackReceiptSetSha256 !== null ||
    evidence.items?.length !== 11 ||
    evidence.items.some(
      (item) => item.status !== 'verification-pending'
    ) ||
    evidence.historicalAuthority?.mayAuthorizeAlpha1 !== false)
) {
  fail('current alpha1 lane is malformed or attempts promotion');
}
if (
  laneName === 'certified' &&
  (lane.status !== 'historical-certified-installable-at-capture' ||
    lane.historicalAtCapture !== true ||
    lane.enabled !== false ||
    lane.installable !== false ||
    lane.installableAtCapture !== true ||
    lane.mayAuthorizeCurrent !== false ||
    evidence.baseline?.dshPackageVersion !== '0.1.0-rc.8' ||
    receipt?.status !== 'runtime-verified-install-authority' ||
    receipt?.authority?.installable !== true ||
    receipt?.summary?.itemsCovered !== 11 ||
    receipt?.summary?.installableRecords !== 11)
) {
  fail('historical RC.8 lane is malformed or attempts current promotion');
}
if (
  laneName === 'candidate' &&
  (lane.status !== 'certification-pending' ||
    lane.historicalAtCapture !== true ||
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
if (
  laneName === 'certifiedRuntimeBaseline' &&
  (lane.status !== 'baseline-certified' ||
    lane.certificationStatus !== 'verified-runtime-baseline' ||
    lane.productionReady !== true ||
    lane.installableItems !== false ||
    lane.itemInstallability !== 'separate-authority-required' ||
    lane.enabled !== false ||
    lane.communityItemsPlanned !== 11 ||
    lane.communityItemsVerified !== 0 ||
    lane.communityInstallableRecords !== 0 ||
    evidence.status !== lane.status ||
    evidence.certificationStatus !== lane.certificationStatus ||
    evidence.productionReady !== true ||
    evidence.installableItems !== false ||
    evidence.capabilities?.communityItemsPlanned !== 11 ||
    evidence.capabilities?.communityItemsVerified !== 0 ||
    evidence.capabilities?.communityInstallableRecords !== 0 ||
    evidence.itemAuthority !== 'not-granted' ||
    receipt.status !== 'certification-pending' ||
    receipt.installable !== false ||
    receipt.summary?.itemsPlanned !== 11 ||
    receipt.summary?.itemsVerified !== 0 ||
    receipt.summary?.installableRecords !== 0 ||
    receipt.items?.length !== 11)
) {
  fail('certified runtime baseline is malformed or grants community items');
}
process.stdout.write(`${JSON.stringify({
  lane: laneName,
  status: lane.status,
  enabled: lane.enabled,
  inspectionEnabled: lane.inspectionEnabled,
  installable: lane.installable,
  installableAtCapture: lane.installableAtCapture,
  mayAuthorizeCurrent: lane.mayAuthorizeCurrent,
  productionReady: lane.productionReady,
  installableItems: lane.installableItems,
  itemInstallability: lane.itemInstallability,
  dshVersion,
  evidenceSha256,
  receiptSha256: lane.receiptSha256,
  itemsPlanned:
    evidence.gate?.requiredItems ??
    receipt?.summary?.itemsPlanned ??
    receipt?.summary?.runtimeMatrixRequired,
  itemsVerified:
    evidence.gate?.completedItems ??
    receipt?.summary?.itemsVerified ??
    receipt?.summary?.runtimeMatrixPassed,
  installableRecords:
    lane.communityInstallableRecords ?? receipt?.summary?.installableRecords,
  websiteDistribution: lane.websiteDistribution,
  websiteInstallability: lane.websiteInstallability,
  websiteCompatibility: lane.websiteCompatibility,
  blockers: evidence.blockers ?? [],
})}\n`);
