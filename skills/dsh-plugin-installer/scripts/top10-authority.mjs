#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const releaseSetUrl = new URL('../references/top10-release-set.json', import.meta.url);
const releaseSetSchemaUrl = new URL('../references/top10-release-set.schema.json', import.meta.url);

const SHA64 = /^[a-f0-9]{64}$/;
const WEIGHTS = {
  userValueAndUseCaseClarity: 25,
  stabilityMaintenanceAndAlpha2Fit: 25,
  securityAndPermissionRestraint: 15,
  crossPlatformInstallRemoveRollback: 15,
  nonTechnicalUsabilityAndDocs: 10,
  combinationComplementarity: 10,
};
const TIE_BREAKS = ['stability-plus-security', 'maintenance-activity', 'lower-public-id'];
const SCORE_KEYS = Object.keys(WEIGHTS);
const USE_CASE = /^[a-z0-9-]{3,48}$/;

function fail(message) {
  throw new Error(message);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function exactKeys(value, keys, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) {
    fail(`${label} keys mismatch`);
  }
}

function validIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function releaseSetPayloadSha256(releaseSet) {
  const payload = structuredClone(releaseSet);
  delete payload.releaseSetPayloadSha256;
  return sha256(Buffer.from(`${JSON.stringify(stable(payload))}\n`, 'utf8'));
}

export function itemAuthoritySha256(item) {
  return sha256(Buffer.from(`${JSON.stringify(stable(item))}\n`, 'utf8'));
}

export function validateTop10ReleaseSet(releaseSet, { authority = null } = {}) {
  exactKeys(releaseSet, [
    'schemaVersion', 'capturedAt', 'purpose', 'releaseSet', 'status', 'frozen',
    'baseline', 'scoring', 'entries', 'gate', 'releaseSetPayloadSha256',
  ], 'Top10 release set');
  if (releaseSet.schemaVersion !== 1 || releaseSet.purpose !== 'dsh-plugin-top10-release-set' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(releaseSet.capturedAt) ||
      !/^[a-z0-9-]{8,80}$/.test(releaseSet.releaseSet)) fail('Top10 release-set header mismatch');
  exactKeys(releaseSet.baseline, ['tag', 'commit'], 'Top10 baseline');
  if (releaseSet.baseline.tag !== 'dsh-v0.1.2-alpha.2' ||
      releaseSet.baseline.commit !== '0a53fb55bea101816fa226bb964ae2bed71c343b') fail('Top10 baseline mismatch');
  exactKeys(releaseSet.scoring, [
    'weights', 'minimumUseCaseCategories', 'coveredUseCaseCategories',
    'coverageStatus', 'tieBreakOrder',
  ], 'Top10 scoring');
  exactKeys(releaseSet.scoring.weights, Object.keys(WEIGHTS), 'Top10 weights');
  if (JSON.stringify(releaseSet.scoring.weights) !== JSON.stringify(WEIGHTS) ||
      releaseSet.scoring.minimumUseCaseCategories !== 8 ||
      !Array.isArray(releaseSet.scoring.coveredUseCaseCategories) ||
      new Set(releaseSet.scoring.coveredUseCaseCategories).size !== releaseSet.scoring.coveredUseCaseCategories.length ||
      releaseSet.scoring.coveredUseCaseCategories.some((entry) => !USE_CASE.test(entry)) ||
      JSON.stringify(releaseSet.scoring.coveredUseCaseCategories) !==
        JSON.stringify([...releaseSet.scoring.coveredUseCaseCategories].sort()) ||
      JSON.stringify(releaseSet.scoring.tieBreakOrder) !== JSON.stringify(TIE_BREAKS)) {
    fail('Top10 scoring, coverage, or tie-break rules mismatch');
  }
  if (!Array.isArray(releaseSet.entries) || ![0, 10].includes(releaseSet.entries.length)) {
    fail('Top10 entries must be empty while pending or contain ten frozen entries');
  }
  const ids = [];
  const coveredUseCases = new Set();
  for (let index = 0; index < releaseSet.entries.length; index += 1) {
    const entry = releaseSet.entries[index];
    exactKeys(entry, [
      'rank', 'publicId', 'catalogId', 'itemAuthoritySha256', 'useCaseCategories',
      'scores', 'totalScore', 'maintenanceActivityAt', 'maintenanceActivityReceiptSha256',
    ], `Top10 entries[${index}]`);
    if (entry.rank !== index + 1 || !Number.isSafeInteger(entry.catalogId) ||
        entry.catalogId < 3000 || entry.catalogId > 3999 || entry.publicId !== `#${entry.catalogId}` ||
        !SHA64.test(entry.itemAuthoritySha256) ||
        !Array.isArray(entry.useCaseCategories) || entry.useCaseCategories.length < 1 ||
        new Set(entry.useCaseCategories).size !== entry.useCaseCategories.length ||
        entry.useCaseCategories.some((category) => !USE_CASE.test(category)) ||
        JSON.stringify(entry.useCaseCategories) !== JSON.stringify([...entry.useCaseCategories].sort()) ||
        !validIsoDate(entry.maintenanceActivityAt) ||
        !SHA64.test(entry.maintenanceActivityReceiptSha256)) {
      fail(`Top10 entries[${index}] identity or digest mismatch`);
    }
    exactKeys(entry.scores, SCORE_KEYS, `Top10 entries[${index}].scores`);
    for (const key of SCORE_KEYS) {
      if (!Number.isSafeInteger(entry.scores[key]) || entry.scores[key] < 0 ||
          entry.scores[key] > WEIGHTS[key]) {
        fail(`Top10 entries[${index}].scores.${key} exceeds its fixed weight`);
      }
    }
    const total = SCORE_KEYS.reduce((sum, key) => sum + entry.scores[key], 0);
    if (entry.totalScore !== total) fail(`Top10 entries[${index}] total score mismatch`);
    entry.useCaseCategories.forEach((category) => coveredUseCases.add(category));
    ids.push(entry.catalogId);
  }
  if (new Set(ids).size !== ids.length) fail('Top10 Public IDs must be unique');
  exactKeys(releaseSet.gate, [
    'requiredPublishedPluginCount', 'verifiedPluginCount', 'requiredMatrixTasksPerItem',
    'verifiedMatrixTasksPerItem', 'itemAuthorityComplete', 'allEightyVerified',
    'sixTaskMatrixVerified', 'transactionPreflightVerified', 'transactionRollbackVerified',
    'webCoexistenceVerified', 'conflictMatrixVerified',
    'transactionPreflightReceiptSha256', 'transactionRollbackReceiptSha256',
    'webCoexistenceReceiptSha256', 'conflictMatrixReceiptSha256',
    'itemAuthoritySetSha256', 'platformNodeMatrixSetSha256',
  ], 'Top10 gate');
  const gate = releaseSet.gate;
  const booleanGateKeys = [
    'itemAuthorityComplete', 'allEightyVerified', 'sixTaskMatrixVerified',
    'transactionPreflightVerified', 'transactionRollbackVerified',
    'webCoexistenceVerified', 'conflictMatrixVerified',
  ];
  if (gate.requiredPublishedPluginCount !== 80 || gate.requiredMatrixTasksPerItem !== 6 ||
      typeof releaseSet.frozen !== 'boolean' ||
      booleanGateKeys.some((key) => typeof gate[key] !== 'boolean') ||
      !Number.isSafeInteger(gate.verifiedPluginCount) || gate.verifiedPluginCount < 0 || gate.verifiedPluginCount > 80 ||
      !Number.isSafeInteger(gate.verifiedMatrixTasksPerItem) || gate.verifiedMatrixTasksPerItem < 0 || gate.verifiedMatrixTasksPerItem > 6 ||
      (gate.itemAuthoritySetSha256 !== null && !SHA64.test(gate.itemAuthoritySetSha256)) ||
      (gate.platformNodeMatrixSetSha256 !== null && !SHA64.test(gate.platformNodeMatrixSetSha256)) ||
      (gate.transactionPreflightReceiptSha256 !== null && !SHA64.test(gate.transactionPreflightReceiptSha256)) ||
      (gate.transactionRollbackReceiptSha256 !== null && !SHA64.test(gate.transactionRollbackReceiptSha256)) ||
      (gate.webCoexistenceReceiptSha256 !== null && !SHA64.test(gate.webCoexistenceReceiptSha256)) ||
      (gate.conflictMatrixReceiptSha256 !== null && !SHA64.test(gate.conflictMatrixReceiptSha256))) {
    fail('Top10 gate values are malformed');
  }
  if (!SHA64.test(releaseSet.releaseSetPayloadSha256) ||
      releaseSetPayloadSha256(releaseSet) !== releaseSet.releaseSetPayloadSha256) {
    fail('Top10 release-set payload digest mismatch');
  }
  const readyFlags = [
    gate.itemAuthorityComplete, gate.allEightyVerified, gate.sixTaskMatrixVerified,
    gate.transactionPreflightVerified, gate.transactionRollbackVerified,
    gate.webCoexistenceVerified, gate.conflictMatrixVerified,
  ].every((value) => value === true);
  if (!releaseSet.frozen) {
    if (releaseSet.status !== 'candidate-pending' || releaseSet.scoring.coverageStatus !== 'candidate-unverified' ||
        releaseSet.entries.length !== 0 || releaseSet.scoring.coveredUseCaseCategories.length !== 0 ||
        readyFlags || gate.verifiedPluginCount !== 0 || gate.verifiedMatrixTasksPerItem !== 0 ||
        gate.itemAuthoritySetSha256 !== null || gate.platformNodeMatrixSetSha256 !== null ||
        gate.transactionPreflightReceiptSha256 !== null || gate.transactionRollbackReceiptSha256 !== null ||
        gate.webCoexistenceReceiptSha256 !== null || gate.conflictMatrixReceiptSha256 !== null) {
      fail('pending Top10 release set must not claim verified evidence');
    }
    return releaseSet;
  }
  if (!authority) fail('frozen Top10 release set requires the full Plugin authority');
  if (releaseSet.status !== 'verified-frozen' || releaseSet.scoring.coverageStatus !== 'verified' ||
      releaseSet.entries.length !== 10 || coveredUseCases.size < releaseSet.scoring.minimumUseCaseCategories ||
      JSON.stringify([...coveredUseCases].sort()) !== JSON.stringify(releaseSet.scoring.coveredUseCaseCategories) || !readyFlags ||
      gate.verifiedPluginCount !== 80 || gate.verifiedMatrixTasksPerItem !== 6 ||
      !SHA64.test(gate.itemAuthoritySetSha256) || !SHA64.test(gate.platformNodeMatrixSetSha256) ||
      !SHA64.test(gate.transactionPreflightReceiptSha256) ||
      !SHA64.test(gate.transactionRollbackReceiptSha256) ||
      !SHA64.test(gate.webCoexistenceReceiptSha256) ||
      !SHA64.test(gate.conflictMatrixReceiptSha256) ||
      authority.harness?.installable !== true || authority.publication?.publishedInstallable !== true ||
      authority.items?.length !== 80) fail('frozen Top10 release set lacks the complete 80/80 six-task gate');
  const ranked = [...releaseSet.entries].sort((left, right) => {
    if (left.totalScore !== right.totalScore) return right.totalScore - left.totalScore;
    const leftSubtotal = left.scores.stabilityMaintenanceAndAlpha2Fit +
      left.scores.securityAndPermissionRestraint;
    const rightSubtotal = right.scores.stabilityMaintenanceAndAlpha2Fit +
      right.scores.securityAndPermissionRestraint;
    if (leftSubtotal !== rightSubtotal) return rightSubtotal - leftSubtotal;
    if (left.maintenanceActivityAt !== right.maintenanceActivityAt) {
      return right.maintenanceActivityAt.localeCompare(left.maintenanceActivityAt, 'en');
    }
    return left.catalogId - right.catalogId;
  });
  if (ranked.some((entry, index) => entry.catalogId !== releaseSet.entries[index].catalogId)) {
    fail('Top10 entries are not ordered by total score and the fixed tie-break sequence');
  }
  const byId = new Map(authority.items.map((item) => [item.catalogId, item]));
  for (const entry of releaseSet.entries) {
    const item = byId.get(entry.catalogId);
    if (!item || entry.itemAuthoritySha256 !== itemAuthoritySha256(item)) {
      fail(`Top10 #${entry.catalogId} item authority digest mismatch`);
    }
  }
  const itemSetDigest = sha256(Buffer.from(`${JSON.stringify(releaseSet.entries.map((entry) => ({
    catalogId: entry.catalogId,
    itemAuthoritySha256: entry.itemAuthoritySha256,
  })))}\n`, 'utf8'));
  if (gate.itemAuthoritySetSha256 !== itemSetDigest) fail('Top10 item authority set digest mismatch');
  const matrixSetDigest = sha256(Buffer.from(`${JSON.stringify(releaseSet.entries.map((entry) => ({
    catalogId: entry.catalogId,
    platformNodeMatrixSha256: byId.get(entry.catalogId).receipts.platformNodeMatrixSha256,
  })))}\n`, 'utf8'));
  if (gate.platformNodeMatrixSetSha256 !== matrixSetDigest) {
    fail('Top10 platform/Node matrix set digest mismatch');
  }
  return releaseSet;
}

export async function loadTop10ReleaseSet() {
  const bytes = await readFile(releaseSetUrl);
  return {
    releaseSet: validateTop10ReleaseSet(JSON.parse(bytes)),
    bytes,
    sha256: sha256(bytes),
  };
}

export async function loadTop10Schema() {
  return JSON.parse(await readFile(releaseSetSchemaUrl, 'utf8'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const loaded = await loadTop10ReleaseSet();
    process.stdout.write(`${JSON.stringify({
      valid: true,
      sha256: loaded.sha256,
      status: loaded.releaseSet.status,
      frozen: loaded.releaseSet.frozen,
      catalogIds: loaded.releaseSet.entries.map((entry) => entry.catalogId),
    }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
