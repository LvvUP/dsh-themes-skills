#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  rankTop10ScoreItems,
  scoreAuthorityItemSha256,
  TOP10_TIE_BREAKS,
  TOP10_WEIGHTS,
  validateTop10ScoreAuthority,
} from './top10-score-authority.mjs';

const releaseSetUrl = new URL('../references/top10-release-set.json', import.meta.url);
const releaseSetSchemaUrl = new URL('../references/top10-release-set.schema.json', import.meta.url);
const scoreAuthorityUrl = new URL('../references/top10-score-authority.json', import.meta.url);
const candidateIntakeUrl = new URL('../references/plugin-candidate-intake.json', import.meta.url);

const SHA64 = /^[a-f0-9]{64}$/;

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

export function releaseSetPayloadSha256(releaseSet) {
  const payload = structuredClone(releaseSet);
  delete payload.releaseSetPayloadSha256;
  return sha256(Buffer.from(`${JSON.stringify(stable(payload))}\n`, 'utf8'));
}

export function itemAuthoritySha256(item) {
  return sha256(Buffer.from(`${JSON.stringify(stable(item))}\n`, 'utf8'));
}

export function validateTop10ReleaseSet(
  releaseSet,
  { authority = null, scoreAuthorityBytes = null, candidateIntakeBytes = null } = {}
) {
  exactKeys(releaseSet, [
    'schemaVersion', 'capturedAt', 'purpose', 'releaseSet', 'status', 'frozen',
    'baseline', 'scoreAuthority', 'scoring', 'entries', 'gate', 'releaseSetPayloadSha256',
  ], 'Top10 release set');
  if (releaseSet.schemaVersion !== 2 || releaseSet.purpose !== 'dsh-plugin-top10-release-set' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(releaseSet.capturedAt) ||
      !/^[a-z0-9-]{8,80}$/.test(releaseSet.releaseSet)) fail('Top10 release-set header mismatch');
  exactKeys(releaseSet.baseline, ['tag', 'commit'], 'Top10 baseline');
  if (releaseSet.baseline.tag !== 'dsh-v0.1.2-alpha.2' ||
      releaseSet.baseline.commit !== '0a53fb55bea101816fa226bb964ae2bed71c343b') fail('Top10 baseline mismatch');
  exactKeys(
    releaseSet.scoreAuthority,
    ['path', 'sha256', 'payloadSha256'],
    'Top10 score authority binding'
  );
  if (
    releaseSet.scoreAuthority.path !== 'top10-score-authority.json' ||
    !SHA64.test(releaseSet.scoreAuthority.sha256) ||
    !SHA64.test(releaseSet.scoreAuthority.payloadSha256) ||
    !Buffer.isBuffer(scoreAuthorityBytes) ||
    sha256(scoreAuthorityBytes) !== releaseSet.scoreAuthority.sha256
  ) {
    fail('Top10 release set is not bound to the exact complete score authority bytes');
  }
  let scoreAuthority;
  try {
    scoreAuthority = validateTop10ScoreAuthority(JSON.parse(scoreAuthorityBytes), {
      authority,
      candidateIntakeBytes,
    });
  } catch (error) {
    fail(`Top10 complete score authority is invalid: ${error.message}`);
  }
  if (scoreAuthority.scoreAuthorityPayloadSha256 !== releaseSet.scoreAuthority.payloadSha256) {
    fail('Top10 release set score-authority payload digest mismatch');
  }
  exactKeys(releaseSet.scoring, [
    'weights', 'minimumUseCaseCategories', 'coveredUseCaseCategories',
    'coverageStatus', 'tieBreakOrder',
  ], 'Top10 scoring');
  exactKeys(releaseSet.scoring.weights, Object.keys(TOP10_WEIGHTS), 'Top10 weights');
  if (JSON.stringify(releaseSet.scoring.weights) !== JSON.stringify(TOP10_WEIGHTS) ||
      releaseSet.scoring.minimumUseCaseCategories !== 8 ||
      !Array.isArray(releaseSet.scoring.coveredUseCaseCategories) ||
      new Set(releaseSet.scoring.coveredUseCaseCategories).size !== releaseSet.scoring.coveredUseCaseCategories.length ||
      releaseSet.scoring.coveredUseCaseCategories.some(
        (entry) => !scoreAuthority.scoring.useCaseCategories.includes(entry)
      ) ||
      JSON.stringify(releaseSet.scoring.coveredUseCaseCategories) !==
        JSON.stringify([...releaseSet.scoring.coveredUseCaseCategories].sort()) ||
      JSON.stringify(releaseSet.scoring.tieBreakOrder) !== JSON.stringify(TOP10_TIE_BREAKS)) {
    fail('Top10 scoring, coverage, or tie-break rules mismatch');
  }
  if (!Array.isArray(releaseSet.entries) || ![0, 10].includes(releaseSet.entries.length)) {
    fail('Top10 entries must be empty while pending or contain ten frozen entries');
  }
  const ids = [];
  for (let index = 0; index < releaseSet.entries.length; index += 1) {
    const entry = releaseSet.entries[index];
    exactKeys(entry, [
      'rank', 'publicId', 'catalogId', 'itemAuthoritySha256', 'scoreAuthorityItemSha256',
    ], `Top10 entries[${index}]`);
    if (entry.rank !== index + 1 || !Number.isSafeInteger(entry.catalogId) ||
        entry.catalogId < 3000 || entry.catalogId > 3999 || entry.publicId !== `#${entry.catalogId}` ||
        !SHA64.test(entry.itemAuthoritySha256) ||
        !SHA64.test(entry.scoreAuthorityItemSha256)) {
      fail(`Top10 entries[${index}] identity or digest mismatch`);
    }
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
  const anyReadyFlag = booleanGateKeys.some((key) => gate[key] === true);
  if (!releaseSet.frozen) {
    if (releaseSet.status !== 'candidate-pending' || releaseSet.scoring.coverageStatus !== 'candidate-unverified' ||
        releaseSet.entries.length !== 0 || releaseSet.scoring.coveredUseCaseCategories.length !== 0 ||
        scoreAuthority.frozen !== false || scoreAuthority.status !== 'candidate-pending' ||
        anyReadyFlag || gate.verifiedPluginCount !== 0 || gate.verifiedMatrixTasksPerItem !== 0 ||
        gate.itemAuthoritySetSha256 !== null || gate.platformNodeMatrixSetSha256 !== null ||
        gate.transactionPreflightReceiptSha256 !== null || gate.transactionRollbackReceiptSha256 !== null ||
        gate.webCoexistenceReceiptSha256 !== null || gate.conflictMatrixReceiptSha256 !== null) {
      fail('pending Top10 release set must not claim verified evidence');
    }
    return releaseSet;
  }
  if (!authority) fail('frozen Top10 release set requires the full Plugin authority');
  const rankedScoreItems = rankTop10ScoreItems(scoreAuthority.items);
  const coveredUseCases = new Set(
    rankedScoreItems.flatMap((scoreItem) => scoreItem.useCaseCategories)
  );
  if (releaseSet.status !== 'verified-frozen' || releaseSet.scoring.coverageStatus !== 'verified' ||
      releaseSet.entries.length !== 10 || coveredUseCases.size < releaseSet.scoring.minimumUseCaseCategories ||
      JSON.stringify([...coveredUseCases].sort()) !== JSON.stringify(releaseSet.scoring.coveredUseCaseCategories) || !readyFlags ||
      gate.verifiedPluginCount !== 80 || gate.verifiedMatrixTasksPerItem !== 6 ||
      !SHA64.test(gate.itemAuthoritySetSha256) || !SHA64.test(gate.platformNodeMatrixSetSha256) ||
      !SHA64.test(gate.transactionPreflightReceiptSha256) ||
      !SHA64.test(gate.transactionRollbackReceiptSha256) ||
      !SHA64.test(gate.webCoexistenceReceiptSha256) ||
      !SHA64.test(gate.conflictMatrixReceiptSha256) ||
      scoreAuthority.frozen !== true || scoreAuthority.status !== 'verified-frozen' ||
      authority.harness?.installable !== true || authority.publication?.publishedInstallable !== true ||
      authority.items?.length !== 80) fail('frozen Top10 release set lacks the complete 80/80 six-task gate');
  const byId = new Map(authority.items.map((item) => [item.catalogId, item]));
  for (let index = 0; index < releaseSet.entries.length; index += 1) {
    const entry = releaseSet.entries[index];
    const scoreItem = rankedScoreItems[index];
    if (
      entry.catalogId !== scoreItem.catalogId ||
      entry.scoreAuthorityItemSha256 !== scoreAuthorityItemSha256(scoreItem)
    ) {
      fail('Top10 entries omit a higher-ranked item or differ from the global deterministic ranking');
    }
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
  const [bytes, scoreAuthorityBytes, candidateIntakeBytes] = await Promise.all([
    readFile(releaseSetUrl),
    readFile(scoreAuthorityUrl),
    readFile(candidateIntakeUrl),
  ]);
  return {
    releaseSet: validateTop10ReleaseSet(JSON.parse(bytes), {
      scoreAuthorityBytes,
      candidateIntakeBytes,
    }),
    bytes,
    sha256: sha256(bytes),
    scoreAuthorityBytes,
    candidateIntakeBytes,
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
