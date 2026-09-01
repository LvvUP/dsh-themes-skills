#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const mapUrl = new URL('../references/alpha2-plugin-migration-map.json', import.meta.url);
const schemaUrl = new URL(
  '../references/alpha2-plugin-migration-map.schema.json',
  import.meta.url
);
const intakeUrl = new URL('../references/plugin-candidate-intake.json', import.meta.url);

const SHA = /^[a-f0-9]{40}$/u;
const REPOSITORY = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git$/u;
const SAFE_SUBDIR = /^(?:\.|[A-Za-z0-9_-]+(?:[A-Za-z0-9._-]*[A-Za-z0-9_-])?(?:\/[A-Za-z0-9_-]+(?:[A-Za-z0-9._-]*[A-Za-z0-9_-])?)*)$/u;
const NPM_EXACT = /^npm:(?:@[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+|[A-Za-z0-9_.-]+)@[^@\s/]+$/u;
const RELEASE_EXACT = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/releases\/download\/[^/]+\/[^/?#]+\.tgz$/u;
const MUTABLE_SOURCE = /(?:\/latest(?:\/|$)|\/tree\/(?:main|master)(?:\/|$)|refs\/heads\/|(?:^|:)latest(?:$|@))/iu;
const CATEGORIES = new Set([
  'developer-tools',
  'documentation',
  'identity',
  'market-data',
  'memory',
  'model-routing',
  'notifications',
  'security',
  'sessions',
  'skills',
  'usage',
  'vision',
  'voice',
  'web-ui',
  'workflow',
]);

const BASELINE = Object.freeze({
  tag: 'dsh-v0.1.2-alpha.2',
  commit: '0a53fb55bea101816fa226bb964ae2bed71c343b',
  tree: '64ccbfa8e0caa4711cd4a75717ef9e022657961b',
});
const AWESOME = Object.freeze({
  repository: 'https://github.com/awesome-dsh-plugin/awesome-dsh-plugin.git',
  commit: 'db181e1aed39ad4a041cb9d379f0d713edfc49bb',
  tree: '24c75117d9fe59fd832359c7ef2ab14632fd543d',
});
const DIRECT_IDS = Object.freeze([3021, 3022, 3032, 3039, 3066, 3076]);
const HOSTED_IDS = Object.freeze([3004, 3006, 3008, 3010, 3011, 3017, 3040, 3041, 3042, 3050]);
const RETIRED_IDS = Object.freeze([
  3009, 3012, 3013, 3014, 3015, 3018, 3020, 3026, 3034, 3035, 3037, 3043, 3044,
  3047, 3055, 3056, 3057, 3059, 3060, 3061, 3065, 3071, 3072, 3073, 3078, 3079,
  3080, 3086,
]);
const ALL_REVIEWED_IDS = Object.freeze(
  [...DIRECT_IDS, ...HOSTED_IDS, ...RETIRED_IDS].sort((left, right) => left - right)
);

function fail(message) {
  throw new Error(message);
}

function exactKeys(value, expected, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  const actual = Object.keys(value).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
    fail(`${label} keys mismatch`);
  }
}

function exactArray(actual, expected, label) {
  if (!Array.isArray(actual) || JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label} mismatch`);
  }
}

function sourceCoordinate(item) {
  return `${item.repository.toLowerCase()}::${item.sourceSubdir.toLowerCase()}`;
}

function expectedCandidateKey(candidate) {
  const repositoryPath = candidate.repository
    .replace(/^https:\/\/github\.com\//u, '')
    .replace(/\.git$/u, '');
  return candidate.sourceSubdir === '.'
    ? repositoryPath
    : `${repositoryPath}#${candidate.sourceSubdir}`;
}

function validateLegacyGroup(items, expectedIds, expectedDecision, label) {
  if (!Array.isArray(items) || items.length !== expectedIds.length) {
    fail(`${label} count mismatch`);
  }
  exactArray(
    items.map((item) => item.catalogId),
    expectedIds,
    `${label} public IDs`
  );
  for (const [index, item] of items.entries()) {
    const itemLabel = `${label}[${index}]`;
    exactKeys(
      item,
      [
        'catalogId',
        'repository',
        'commit',
        'tree',
        'packageCoordinate',
        'decision',
        'staticReviewStatus',
        'runtimeStatus',
        'reasonCodes',
      ],
      itemLabel
    );
    if (
      !Number.isSafeInteger(item.catalogId) ||
      !REPOSITORY.test(item.repository) ||
      !SHA.test(item.commit) ||
      !SHA.test(item.tree) ||
      typeof item.packageCoordinate !== 'string' ||
      item.packageCoordinate.length < 3 ||
      item.packageCoordinate.length > 160 ||
      MUTABLE_SOURCE.test(item.packageCoordinate) ||
      item.decision !== expectedDecision ||
      item.staticReviewStatus !== 'static-reviewed' ||
      item.runtimeStatus !== 'pending-runtime' ||
      !Array.isArray(item.reasonCodes) ||
      item.reasonCodes.length === 0 ||
      new Set(item.reasonCodes).size !== item.reasonCodes.length
    ) {
      fail(`${itemLabel} is malformed or overclaims runtime status`);
    }
    if (expectedDecision === 'retain-direct-pin' && !item.reasonCodes.includes('alpha2-surface-clean')) {
      fail(`${itemLabel} lacks the alpha.2 direct-pin surface finding`);
    }
    if (
      expectedDecision === 'retain-hosted-adaptation' &&
      !item.reasonCodes.includes('hosted-rewrite-bounded')
    ) {
      fail(`${itemLabel} lacks its bounded hosted-adaptation finding`);
    }
    if (expectedDecision === 'retire-permanently' && !item.reasonCodes.includes('retirement-selected')) {
      fail(`${itemLabel} does not preserve permanent retirement`);
    }
  }
}

function validateCandidate(candidate, index) {
  const label = `replacementCandidates[${index}]`;
  exactKeys(
    candidate,
    [
      'rank',
      'candidateKey',
      'repository',
      'sourceSubdir',
      'commit',
      'tree',
      'licenseExpression',
      'category',
      'packageName',
      'packageVersion',
      'distributionClass',
      'upstreamInstall',
      'staticReviewStatus',
      'runtimeStatus',
      'alpha2SurfaceAssessment',
      'qualitySignals',
    ],
    label
  );
  if (
    Object.hasOwn(candidate, 'catalogId') ||
    Object.hasOwn(candidate, 'publicId') ||
    Object.hasOwn(candidate, 'id')
  ) {
    fail(`${label} must not pre-allocate a Public ID`);
  }
  if (
    candidate.rank !== index + 1 ||
    typeof candidate.candidateKey !== 'string' ||
    candidate.candidateKey !== expectedCandidateKey(candidate) ||
    !REPOSITORY.test(candidate.repository) ||
    !SAFE_SUBDIR.test(candidate.sourceSubdir) ||
    !SHA.test(candidate.commit) ||
    !SHA.test(candidate.tree) ||
    typeof candidate.licenseExpression !== 'string' ||
    candidate.licenseExpression.length < 2 ||
    !CATEGORIES.has(candidate.category) ||
    typeof candidate.packageName !== 'string' ||
    candidate.packageName.length < 1 ||
    typeof candidate.packageVersion !== 'string' ||
    candidate.packageVersion.length < 1 ||
    candidate.staticReviewStatus !== 'static-reviewed' ||
    candidate.runtimeStatus !== 'pending-runtime'
  ) {
    fail(`${label} is malformed or claims runtime certification`);
  }
  exactKeys(candidate.upstreamInstall, ['mode', 'direct', 'exactCoordinate'], `${label}.upstreamInstall`);
  exactKeys(candidate.qualitySignals, ['starsAtReview', 'summary'], `${label}.qualitySignals`);
  if (
    !Number.isSafeInteger(candidate.qualitySignals.starsAtReview) ||
    candidate.qualitySignals.starsAtReview < 0 ||
    typeof candidate.qualitySignals.summary !== 'string' ||
    candidate.qualitySignals.summary.length < 3 ||
    MUTABLE_SOURCE.test(candidate.upstreamInstall.exactCoordinate)
  ) {
    fail(`${label} has malformed quality evidence or a mutable install coordinate`);
  }

  const { mode, direct, exactCoordinate } = candidate.upstreamInstall;
  if (candidate.distributionClass === 'direct-upstream-exact') {
    if (direct !== true || !['npm-exact', 'github-release-exact'].includes(mode)) {
      fail(`${label} direct distribution is not an exact upstream install`);
    }
    if (mode === 'npm-exact' && !NPM_EXACT.test(exactCoordinate)) {
      fail(`${label} npm coordinate is not an exact version`);
    }
    if (
      mode === 'npm-exact' &&
      exactCoordinate !== `npm:${candidate.packageName}@${candidate.packageVersion}`
    ) {
      fail(`${label} npm coordinate does not match its package name and version`);
    }
    if (mode === 'github-release-exact' && !RELEASE_EXACT.test(exactCoordinate)) {
      fail(`${label} release coordinate is not an exact immutable-looking asset URL`);
    }
    if (
      mode === 'github-release-exact' &&
      (!exactCoordinate.startsWith(`${candidate.repository.slice(0, -4)}/releases/download/`) ||
        !exactCoordinate.includes(candidate.packageVersion))
    ) {
      fail(`${label} release coordinate does not match its repository and version`);
    }
    if (candidate.alpha2SurfaceAssessment !== 'no-removed-package-imports-found') {
      fail(`${label} direct install is not clean against the alpha.2 package surface`);
    }
  } else if (candidate.distributionClass === 'hosted-adaptation-required') {
    if (
      mode !== 'hosted-adaptation-required' ||
      direct !== false ||
      exactCoordinate !== `github-commit:${candidate.commit}` ||
      ![
        'removed-package-imports-require-adaptation',
        'artifact-gap-requires-adaptation',
      ].includes(candidate.alpha2SurfaceAssessment)
    ) {
      fail(`${label} hosted candidate must remain pinned source, not an install authority`);
    }
  } else {
    fail(`${label} has an unsupported distribution class`);
  }
}

export function validateAlpha2PluginMigrationMap(map, { existingRepositories = [] } = {}) {
  exactKeys(
    map,
    [
      'schemaVersion',
      'capturedAt',
      'purpose',
      'baseline',
      'awesomeSnapshot',
      'publication',
      'counts',
      'idPolicy',
      'directPinRetained',
      'hostedAdaptationRetained',
      'retired',
      'replacementCandidates',
    ],
    'alpha.2 plugin migration map'
  );
  if (
    map.schemaVersion !== 1 ||
    map.purpose !== 'dsh-plugin-alpha2-static-migration-evidence' ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(map.capturedAt)
  ) {
    fail('alpha.2 migration map header mismatch');
  }
  exactKeys(map.baseline, ['tag', 'commit', 'tree', 'removedPackages'], 'alpha.2 baseline');
  if (
    map.baseline.tag !== BASELINE.tag ||
    map.baseline.commit !== BASELINE.commit ||
    map.baseline.tree !== BASELINE.tree
  ) {
    fail('alpha.2 baseline tag/commit/tree mismatch');
  }
  exactArray(
    map.baseline.removedPackages,
    ['@deepseek-ai/dsh-client-runtime', '@deepseek-ai/dsh-host-apiproxy'],
    'alpha.2 removed package surface'
  );
  exactKeys(map.awesomeSnapshot, ['repository', 'commit', 'tree'], 'awesome snapshot');
  if (
    map.awesomeSnapshot.repository !== AWESOME.repository ||
    map.awesomeSnapshot.commit !== AWESOME.commit ||
    map.awesomeSnapshot.tree !== AWESOME.tree
  ) {
    fail('awesome snapshot repository/commit/tree mismatch');
  }
  exactKeys(
    map.publication,
    ['status', 'installable', 'runtimeCertifiedCount'],
    'migration publication boundary'
  );
  if (
    map.publication.status !== 'static-reviewed-pending-runtime' ||
    map.publication.installable !== false ||
    map.publication.runtimeCertifiedCount !== 0
  ) {
    fail('migration evidence must remain explicitly non-installable and pending runtime');
  }
  exactKeys(
    map.counts,
    [
      'reviewedRejected',
      'directPinRetained',
      'hostedAdaptationRetained',
      'retired',
      'replacementCandidates',
      'replacementDirectUpstream',
      'replacementHostedAdaptation',
    ],
    'migration counts'
  );
  const expectedCounts = {
    reviewedRejected: 44,
    directPinRetained: 6,
    hostedAdaptationRetained: 10,
    retired: 28,
    replacementCandidates: 44,
    replacementDirectUpstream: 35,
    replacementHostedAdaptation: 9,
  };
  if (JSON.stringify(map.counts) !== JSON.stringify(expectedCounts)) {
    fail('alpha.2 migration counts mismatch');
  }
  exactKeys(
    map.idPolicy,
    [
      'firstEligibleReplacementCatalogId',
      'idsToIssueAfterCertification',
      'allocateOnlyAfterSixTaskRuntimePass',
      'neverRebindRetiredIds',
      'candidatePublicIdsAllocated',
    ],
    'replacement Public ID policy'
  );
  if (
    map.idPolicy.firstEligibleReplacementCatalogId !== 3089 ||
    map.idPolicy.idsToIssueAfterCertification !== 28 ||
    map.idPolicy.allocateOnlyAfterSixTaskRuntimePass !== true ||
    map.idPolicy.neverRebindRetiredIds !== true ||
    map.idPolicy.candidatePublicIdsAllocated !== false
  ) {
    fail('replacement Public ID policy was weakened');
  }

  validateLegacyGroup(map.directPinRetained, DIRECT_IDS, 'retain-direct-pin', 'directPinRetained');
  validateLegacyGroup(
    map.hostedAdaptationRetained,
    HOSTED_IDS,
    'retain-hosted-adaptation',
    'hostedAdaptationRetained'
  );
  validateLegacyGroup(map.retired, RETIRED_IDS, 'retire-permanently', 'retired');

  const allLegacy = [
    ...map.directPinRetained,
    ...map.hostedAdaptationRetained,
    ...map.retired,
  ];
  const legacyIds = allLegacy.map((item) => item.catalogId).sort((left, right) => left - right);
  exactArray(legacyIds, ALL_REVIEWED_IDS, 'reviewed alpha.1 rejected IDs');
  if (new Set(legacyIds).size !== legacyIds.length) {
    fail('a legacy Public ID appears in more than one migration outcome');
  }

  if (!Array.isArray(map.replacementCandidates) || map.replacementCandidates.length !== 44) {
    fail('replacement pool must contain exactly 44 static-reviewed candidates');
  }
  map.replacementCandidates.forEach(validateCandidate);
  const keys = map.replacementCandidates.map((candidate) => candidate.candidateKey.toLowerCase());
  const coordinates = map.replacementCandidates.map(sourceCoordinate);
  const packages = map.replacementCandidates.map((candidate) => candidate.packageName.toLowerCase());
  const installCoordinates = map.replacementCandidates.map((candidate) =>
    candidate.upstreamInstall.exactCoordinate.toLowerCase()
  );
  for (const [values, label] of [
    [coordinates, 'repository/package coordinates'],
    [keys, 'candidate keys'],
    [packages, 'package names'],
    [installCoordinates, 'exact install/source coordinates'],
  ]) {
    if (new Set(values).size !== values.length) {
      fail(`replacement pool contains duplicate ${label}`);
    }
  }
  const directCount = map.replacementCandidates.filter(
    (candidate) => candidate.distributionClass === 'direct-upstream-exact'
  ).length;
  const hostedCount = map.replacementCandidates.filter(
    (candidate) => candidate.distributionClass === 'hosted-adaptation-required'
  ).length;
  if (directCount !== 35 || hostedCount !== 9) {
    fail('replacement distribution counts do not match the frozen review result');
  }

  const existing = new Set(existingRepositories.map((repository) => repository.toLowerCase()));
  for (const candidate of map.replacementCandidates) {
    if (existing.has(candidate.repository.toLowerCase())) {
      fail(`replacement candidate duplicates an existing 80-item repository: ${candidate.repository}`);
    }
  }
  return map;
}

export async function loadAlpha2PluginMigrationMap() {
  const [map, intake] = await Promise.all([
    readFile(mapUrl, 'utf8').then(JSON.parse),
    readFile(intakeUrl, 'utf8').then(JSON.parse),
  ]);
  return validateAlpha2PluginMigrationMap(map, {
    existingRepositories: intake.items.map((item) => item.repository),
  });
}

export async function loadAlpha2PluginMigrationMapSchema() {
  return JSON.parse(await readFile(schemaUrl, 'utf8'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 2) fail('usage: validate-alpha2-plugin-migration-map.mjs');
    const map = await loadAlpha2PluginMigrationMap();
    process.stdout.write(
      `${JSON.stringify({
        valid: true,
        installable: map.publication.installable,
        baselineCommit: map.baseline.commit,
        retainedDirect: map.directPinRetained.length,
        retainedHosted: map.hostedAdaptationRetained.length,
        retired: map.retired.length,
        replacementCandidates: map.replacementCandidates.length,
        nextEligiblePublicId: map.idPolicy.firstEligibleReplacementCatalogId,
      })}\n`
    );
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
