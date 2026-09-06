#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

function fail(message) {
  throw new Error(`authoring baseline refused: ${message}`);
}

const laneName = process.argv[2] ?? 'alpha';
if (
  !['alpha', 'certified', 'certifiedRuntimeBaseline', 'candidate'].includes(laneName) ||
  process.argv.length > 3
) {
  fail(
    'usage: inspect-baseline.mjs [alpha|certified|certifiedRuntimeBaseline|candidate]'
  );
}
if (laneName === 'alpha') {
  const { ALPHA_SOURCE, readAlphaRuntime } = await import('../../dsh-theme-manager/scripts/dsh-alpha.mjs');
  const { loadAlphaHostedAuthority, stableAlphaJson } = await import('../../dsh-theme-manager/scripts/alpha-authority.mjs');
  const bytes = await readFile(new URL('../references/compatibility-alpha.json', import.meta.url));
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const evidence = JSON.parse(bytes.toString('utf8'));
  if (sha256 !== '1df3347e072b79d6c7607de2e7728f4b50e40c29591c1f307b4634ebb3d16032' || loadAlphaHostedAuthority().status !== 'runtime-verified' || stableAlphaJson(evidence) !== stableAlphaJson({ ...readAlphaRuntime().compatibility, runtimeAttestationSha256: ALPHA_SOURCE.verification.sha256 })) fail('Alpha compatibility evidence differs');
  process.stdout.write(`${JSON.stringify({ lane: 'alpha', status: 'reviewed-alpha-authoring', enabled: true, draftOnly: true, installableItems: false, dshVersion: ALPHA_SOURCE.version, sourceCommit: ALPHA_SOURCE.commit, evidenceSha256: sha256 })}\n`);
} else {
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
}
