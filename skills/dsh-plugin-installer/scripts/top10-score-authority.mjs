#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { validateCandidateIntake } from './candidate-intake.mjs';

const scoreAuthorityUrl = new URL('../references/top10-score-authority.json', import.meta.url);
const scoreAuthoritySchemaUrl = new URL(
  '../references/top10-score-authority.schema.json',
  import.meta.url
);

const SHA64 = /^[a-f0-9]{64}$/u;
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u;

export const TOP10_WEIGHTS = {
  userValueAndUseCaseClarity: 25,
  stabilityMaintenanceAndAlpha2Fit: 25,
  securityAndPermissionRestraint: 15,
  crossPlatformInstallRemoveRollback: 15,
  nonTechnicalUsabilityAndDocs: 10,
  combinationComplementarity: 10,
};
export const TOP10_TIE_BREAKS = [
  'stability-plus-security',
  'maintenance-activity',
  'lower-public-id',
];
export const TOP10_USE_CASE_CATEGORIES = [
  'build-and-review',
  'collaborate-and-notify',
  'discover-and-start',
  'govern-and-secure',
  'measure-and-optimize',
  'navigate-and-focus',
  'plan-and-automate',
  'remember-and-retrieve',
  'research-the-web',
  'see-and-understand',
];

const SCORE_KEYS = Object.keys(TOP10_WEIGHTS);
const USE_CASES = new Set(TOP10_USE_CASE_CATEGORIES);

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
  if (
    value === null ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())
  ) {
    fail(`${label} keys mismatch`);
  }
}

function stableSha256(value) {
  return sha256(Buffer.from(`${JSON.stringify(stable(value))}\n`, 'utf8'));
}

function validIsoTimestamp(value) {
  if (typeof value !== 'string' || !ISO_TIMESTAMP.test(value)) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

function validIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function candidateInputSha256(candidate) {
  return stableSha256(candidate);
}

export function maintenanceEvidenceSha256(evidence) {
  return stableSha256(evidence);
}

export function scoreReceiptSha256(receipt) {
  return stableSha256(receipt);
}

export function scoreAuthorityItemSha256(item) {
  return stableSha256(item);
}

export function scoreAuthorityPayloadSha256(authority) {
  const payload = structuredClone(authority);
  delete payload.scoreAuthorityPayloadSha256;
  return stableSha256(payload);
}

export function scoringPolicySha256() {
  return stableSha256({
    weights: TOP10_WEIGHTS,
    minimumUseCaseCategories: 8,
    useCaseCategories: TOP10_USE_CASE_CATEGORIES,
    tieBreakOrder: TOP10_TIE_BREAKS,
  });
}

function compareScoreItems(left, right) {
  if (left.totalScore !== right.totalScore) return right.totalScore - left.totalScore;
  const leftSubtotal =
    left.scores.stabilityMaintenanceAndAlpha2Fit +
    left.scores.securityAndPermissionRestraint;
  const rightSubtotal =
    right.scores.stabilityMaintenanceAndAlpha2Fit +
    right.scores.securityAndPermissionRestraint;
  if (leftSubtotal !== rightSubtotal) return rightSubtotal - leftSubtotal;
  if (left.maintenanceEvidence.committedAt !== right.maintenanceEvidence.committedAt) {
    return right.maintenanceEvidence.committedAt.localeCompare(
      left.maintenanceEvidence.committedAt,
      'en'
    );
  }
  return left.catalogId - right.catalogId;
}

export function rankTop10ScoreItems(items) {
  if (!Array.isArray(items) || items.length !== 80) {
    fail('global Top10 ranking requires the complete 80-item score authority');
  }
  return [...items].sort(compareScoreItems).slice(0, 10);
}

function validateScoreItem(item, index, { authorityItem, candidate, capturedAt }) {
  const label = `Top10 score authority items[${index}]`;
  exactKeys(
    item,
    [
      'catalogId',
      'publicId',
      'candidateInputSha256',
      'itemAuthoritySha256',
      'useCaseCategories',
      'scores',
      'totalScore',
      'maintenanceEvidence',
      'scoreReceipt',
      'scoreReceiptSha256',
    ],
    label
  );
  if (
    item.catalogId !== candidate?.catalogId ||
    item.catalogId !== authorityItem?.catalogId ||
    item.publicId !== `#${item.catalogId}` ||
    item.candidateInputSha256 !== candidateInputSha256(candidate) ||
    item.itemAuthoritySha256 !== stableSha256(authorityItem)
  ) {
    fail(`${label} is not bound to the matching candidate and Plugin item authorities`);
  }
  if (
    !Array.isArray(item.useCaseCategories) ||
    item.useCaseCategories.length < 1 ||
    new Set(item.useCaseCategories).size !== item.useCaseCategories.length ||
    item.useCaseCategories.some((category) => !USE_CASES.has(category)) ||
    JSON.stringify(item.useCaseCategories) !== JSON.stringify([...item.useCaseCategories].sort()) ||
    !item.useCaseCategories.includes(candidate.primaryUseCase)
  ) {
    fail(`${label} use cases are not a canonical candidate-bound category set`);
  }
  exactKeys(item.scores, SCORE_KEYS, `${label}.scores`);
  for (const key of SCORE_KEYS) {
    if (
      !Number.isSafeInteger(item.scores[key]) ||
      item.scores[key] < 0 ||
      item.scores[key] > TOP10_WEIGHTS[key]
    ) {
      fail(`${label}.scores.${key} exceeds its fixed weight`);
    }
  }
  const totalScore = SCORE_KEYS.reduce((sum, key) => sum + item.scores[key], 0);
  if (item.totalScore !== totalScore) fail(`${label} total score mismatch`);

  exactKeys(
    item.scoreReceipt,
    [
      'schemaVersion',
      'purpose',
      'capturedAt',
      'baselineCommit',
      'catalogId',
      'candidateInputSha256',
      'itemAuthoritySha256',
      'platformNodeMatrixSha256',
      'scoringPolicySha256',
      'useCaseCategories',
      'scores',
      'totalScore',
      'maintenanceEvidenceSha256',
    ],
    `${label}.scoreReceipt`
  );

  const evidence = item.maintenanceEvidence;
  exactKeys(
    evidence,
    [
      'kind',
      'repository',
      'commit',
      'committedAt',
      'observedAt',
      'evidenceUrl',
      'sourceResponseSha256',
    ],
    `${label}.maintenanceEvidence`
  );
  const expectedEvidenceUrl = `${candidate.repository.replace(/\.git$/u, '')}/commit/${candidate.commit}`;
  if (
    evidence.kind !== 'github-commit-metadata' ||
    evidence.repository !== candidate.repository ||
    evidence.commit !== candidate.commit ||
    evidence.evidenceUrl !== expectedEvidenceUrl ||
    !validIsoTimestamp(evidence.committedAt) ||
    !validIsoTimestamp(evidence.observedAt) ||
    evidence.observedAt < evidence.committedAt ||
    evidence.observedAt.slice(0, 10) > item.scoreReceipt.capturedAt ||
    !SHA64.test(evidence.sourceResponseSha256)
  ) {
    fail(`${label} maintenance evidence is not bound to exact upstream commit metadata`);
  }

  const expectedReceipt = {
    schemaVersion: 1,
    purpose: 'dsh-plugin-top10-score-review',
    capturedAt: item.scoreReceipt.capturedAt,
    baselineCommit: '0a53fb55bea101816fa226bb964ae2bed71c343b',
    catalogId: item.catalogId,
    candidateInputSha256: item.candidateInputSha256,
    itemAuthoritySha256: item.itemAuthoritySha256,
    platformNodeMatrixSha256: authorityItem.receipts?.platformNodeMatrixSha256,
    scoringPolicySha256: scoringPolicySha256(),
    useCaseCategories: item.useCaseCategories,
    scores: item.scores,
    totalScore: item.totalScore,
    maintenanceEvidenceSha256: maintenanceEvidenceSha256(evidence),
  };
  if (
    item.scoreReceipt.capturedAt !== capturedAt ||
    !SHA64.test(expectedReceipt.platformNodeMatrixSha256 ?? '') ||
    JSON.stringify(stable(item.scoreReceipt)) !== JSON.stringify(stable(expectedReceipt)) ||
    !SHA64.test(item.scoreReceiptSha256) ||
    item.scoreReceiptSha256 !== scoreReceiptSha256(item.scoreReceipt)
  ) {
    fail(`${label} score receipt is not exact or digest-bound`);
  }
  return item;
}

export function validateTop10ScoreAuthority(
  scoreAuthority,
  { authority = null, candidateIntakeBytes = null } = {}
) {
  exactKeys(
    scoreAuthority,
    [
      'schemaVersion',
      'capturedAt',
      'purpose',
      'status',
      'frozen',
      'baseline',
      'candidateIntake',
      'scoring',
      'pluginSet',
      'items',
      'scoreAuthorityPayloadSha256',
    ],
    'Top10 score authority'
  );
  if (
    scoreAuthority.schemaVersion !== 1 ||
    scoreAuthority.purpose !== 'dsh-plugin-top10-score-authority' ||
    !validIsoDate(scoreAuthority.capturedAt) ||
    typeof scoreAuthority.frozen !== 'boolean'
  ) {
    fail('Top10 score authority header mismatch');
  }
  exactKeys(scoreAuthority.baseline, ['tag', 'commit'], 'Top10 score authority baseline');
  if (
    scoreAuthority.baseline.tag !== 'dsh-v0.1.2-alpha.2' ||
    scoreAuthority.baseline.commit !== '0a53fb55bea101816fa226bb964ae2bed71c343b'
  ) {
    fail('Top10 score authority baseline mismatch');
  }
  exactKeys(
    scoreAuthority.candidateIntake,
    ['path', 'sha256', 'requiredItemCount'],
    'Top10 score candidate intake'
  );
  if (
    scoreAuthority.candidateIntake.path !== 'plugin-candidate-intake.json' ||
    scoreAuthority.candidateIntake.requiredItemCount !== 80 ||
    !SHA64.test(scoreAuthority.candidateIntake.sha256) ||
    !Buffer.isBuffer(candidateIntakeBytes) ||
    sha256(candidateIntakeBytes) !== scoreAuthority.candidateIntake.sha256
  ) {
    fail('Top10 score authority is not bound to the exact 80-item candidate intake bytes');
  }
  let candidateIntake;
  try {
    candidateIntake = validateCandidateIntake(JSON.parse(candidateIntakeBytes));
  } catch (error) {
    fail(`Top10 score candidate intake is invalid: ${error.message}`);
  }
  exactKeys(
    scoreAuthority.scoring,
    ['weights', 'minimumUseCaseCategories', 'useCaseCategories', 'tieBreakOrder'],
    'Top10 score policy'
  );
  exactKeys(scoreAuthority.scoring.weights, SCORE_KEYS, 'Top10 score weights');
  if (
    JSON.stringify(scoreAuthority.scoring.weights) !== JSON.stringify(TOP10_WEIGHTS) ||
    scoreAuthority.scoring.minimumUseCaseCategories !== 8 ||
    JSON.stringify(scoreAuthority.scoring.useCaseCategories) !==
      JSON.stringify(TOP10_USE_CASE_CATEGORIES) ||
    JSON.stringify(scoreAuthority.scoring.tieBreakOrder) !== JSON.stringify(TOP10_TIE_BREAKS)
  ) {
    fail('Top10 score policy differs from the fixed six-dimension policy');
  }
  exactKeys(
    scoreAuthority.pluginSet,
    ['requiredItemCount', 'verifiedItemCount', 'itemAuthoritySetSha256'],
    'Top10 score Plugin set'
  );
  if (
    scoreAuthority.pluginSet.requiredItemCount !== 80 ||
    !Number.isSafeInteger(scoreAuthority.pluginSet.verifiedItemCount) ||
    scoreAuthority.pluginSet.verifiedItemCount < 0 ||
    scoreAuthority.pluginSet.verifiedItemCount > 80 ||
    (scoreAuthority.pluginSet.itemAuthoritySetSha256 !== null &&
      !SHA64.test(scoreAuthority.pluginSet.itemAuthoritySetSha256)) ||
    !Array.isArray(scoreAuthority.items) ||
    ![0, 80].includes(scoreAuthority.items.length)
  ) {
    fail('Top10 score Plugin set is malformed');
  }
  if (
    !SHA64.test(scoreAuthority.scoreAuthorityPayloadSha256) ||
    scoreAuthorityPayloadSha256(scoreAuthority) !== scoreAuthority.scoreAuthorityPayloadSha256
  ) {
    fail('Top10 score authority payload digest mismatch');
  }
  if (!scoreAuthority.frozen) {
    if (
      scoreAuthority.status !== 'candidate-pending' ||
      scoreAuthority.pluginSet.verifiedItemCount !== 0 ||
      scoreAuthority.pluginSet.itemAuthoritySetSha256 !== null ||
      scoreAuthority.items.length !== 0
    ) {
      fail('pending Top10 score authority must not claim verified scores or Plugin evidence');
    }
    return scoreAuthority;
  }
  if (
    scoreAuthority.status !== 'verified-frozen' ||
    scoreAuthority.pluginSet.verifiedItemCount !== 80 ||
    scoreAuthority.items.length !== 80 ||
    authority?.harness?.installable !== true ||
    authority?.publication?.publishedInstallable !== true ||
    authority?.items?.length !== 80
  ) {
    fail('frozen Top10 score authority requires the complete verified 80-item Plugin authority');
  }
  const candidateById = new Map(candidateIntake.items.map((item) => [item.catalogId, item]));
  const authorityById = new Map(authority.items.map((item) => [item.catalogId, item]));
  const ids = scoreAuthority.items.map((item) => item.catalogId);
  const candidateIds = candidateIntake.items.map((item) => item.catalogId);
  if (
    JSON.stringify(ids) !== JSON.stringify([...ids].sort((left, right) => left - right)) ||
    JSON.stringify(ids) !== JSON.stringify(candidateIds) ||
    new Set(ids).size !== 80 ||
    authorityById.size !== 80 ||
    ids.some((catalogId) => !authorityById.has(catalogId))
  ) {
    fail('frozen Top10 score authority must bind the complete canonical 80-item identity set');
  }
  scoreAuthority.items.forEach((item, index) =>
    validateScoreItem(item, index, {
      authorityItem: authorityById.get(item.catalogId),
      candidate: candidateById.get(item.catalogId),
      capturedAt: scoreAuthority.capturedAt,
    })
  );
  const itemSetDigest = stableSha256(
    scoreAuthority.items.map((item) => ({
      catalogId: item.catalogId,
      itemAuthoritySha256: item.itemAuthoritySha256,
    }))
  );
  if (scoreAuthority.pluginSet.itemAuthoritySetSha256 !== itemSetDigest) {
    fail('Top10 score authority full 80-item authority-set digest mismatch');
  }
  return scoreAuthority;
}

export async function loadTop10ScoreAuthority() {
  const [bytes, candidateIntakeBytes] = await Promise.all([
    readFile(scoreAuthorityUrl),
    readFile(new URL('../references/plugin-candidate-intake.json', import.meta.url)),
  ]);
  return {
    scoreAuthority: validateTop10ScoreAuthority(JSON.parse(bytes), { candidateIntakeBytes }),
    bytes,
    sha256: sha256(bytes),
    candidateIntakeBytes,
  };
}

export async function loadTop10ScoreAuthoritySchema() {
  return JSON.parse(await readFile(scoreAuthoritySchemaUrl, 'utf8'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const loaded = await loadTop10ScoreAuthority();
    process.stdout.write(
      `${JSON.stringify(
        {
          valid: true,
          sha256: loaded.sha256,
          status: loaded.scoreAuthority.status,
          frozen: loaded.scoreAuthority.frozen,
          scoredPluginCount: loaded.scoreAuthority.items.length,
        },
        null,
        2
      )}\n`
    );
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
