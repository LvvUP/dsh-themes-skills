import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const authorityUrl = new URL(
  '../references/alpha2-recertification.json',
  import.meta.url
);
const schemaUrl = new URL(
  '../references/alpha2-recertification.schema.json',
  import.meta.url
);
const catalogUrl = new URL('../references/community-catalog.json', import.meta.url);
const alpha1Url = new URL('../references/alpha1-recertification.json', import.meta.url);
const rc8ReceiptUrl = new URL('../references/runtime-receipt.rc8.json', import.meta.url);
const harnessAuthorityUrl = new URL(
  '../../dsh-harness-installer/references/alpha2-release-authority.json',
  import.meta.url
);

export const ALPHA2_RECERTIFICATION_SHA256 =
  '1c83be51b9b611470771fae89d4e4c0550618a84efc055d993b38cfe9acb1a87';
export const ALPHA2_RECERTIFICATION_SCHEMA_SHA256 =
  'f4b37c689ad1e9749127a711ce818d6a226842b94c9f455abf7775434c8c2f5e';
export const ALPHA2_HARNESS_AUTHORITY_SHA256 =
  '100e24ea87e111a7abb13aab5d8c81e38585319c27ea09ce82e62dd4fcc80094';
export const ALPHA1_RECERTIFICATION_SHA256 =
  '9ecc86474cba557c445ae21b8e479aa3f1b55cb8b2768faa6ed73952cc7b1552';
export const COMMUNITY_CATALOG_SHA256 =
  '343000de2be72848db4a7838be90e3c41191f164a5a62d8198d154bfe0aa5d99';
export const RC8_RUNTIME_RECEIPT_SHA256 =
  '89bb10b995e7734b6c13ab7d0027d73440f5d8f40b1f618b3c9adbbe52e1b1a1';

const EXPECTED_BASELINE = Object.freeze({
  baselineId:
    'deepseek-harness/dsh-v0.1.2-alpha.2@0a53fb55bea101816fa226bb964ae2bed71c343b',
  dshPackageName: '@deepseek-ai/dsh',
  dshPackageVersion: '0.1.2-alpha.2',
  officialTag: 'dsh-v0.1.2-alpha.2',
  sourceCommit: '0a53fb55bea101816fa226bb964ae2bed71c343b',
  sourceTree: '64ccbfa8e0caa4711cd4a75717ef9e022657961b',
  officialNpmTarballSha256:
    '5bf062a26a490853ffb9294fe3c9fb2047f029be3545612dea45718a81920a47',
  officialNpmIntegrity:
    'sha512-4TvTC5kRKlgtSU2UTBv+cID9a2Z+6+m6mpvjXWJfVzuTkflCff6s4MsQpFJTCmwFh/k7zNWe7qFXcLYMV/5VvA==',
  harnessAuthorityPath:
    '../../dsh-harness-installer/references/alpha2-release-authority.json',
  harnessAuthoritySha256: ALPHA2_HARNESS_AUTHORITY_SHA256,
  artifactRelationship:
    'official-npm-runtime-and-exact-source-cross-build-are-independent',
});

const EXPECTED_PLATFORMS = Object.freeze([
  { os: 'darwin', arch: 'arm64' },
  { os: 'linux', arch: 'x64' },
  { os: 'win32', arch: 'x64' },
]);
const EXPECTED_NODE_VERSIONS = Object.freeze(['22.19.0', '24.15.0']);
export const ALPHA2_SKIN_CENTER_COHORT_IDS = Object.freeze([
  2101, 2201, 2202, 2203, 2204, 2205, 2208, 2209, 2210,
]);
export const ALPHA2_INDEPENDENT_ITEM_IDS = Object.freeze([2206, 2207]);
export const ALPHA2_COHORT_POLICY = Object.freeze({
  skinCenterBuiltin: Object.freeze({
    cohortId: 'skin-center-builtin-0.2.5',
    members: ALPHA2_SKIN_CENTER_COHORT_IDS,
    requiredMembers: 9,
    allMembersMustPass: true,
    allMembersRollbackVerified: true,
    installability: 'all-or-none',
  }),
  independentItems: Object.freeze({
    members: ALPHA2_INDEPENDENT_ITEM_IDS,
    requiredMembers: 2,
    installability: 'item-level',
  }),
});

function fail(message) {
  throw new Error(`alpha2 community recertification refused: ${message}`);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function object(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value;
}

function exact(actual, expected, label) {
  if (actual !== expected) fail(`${label} differs from frozen authority`);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stable(value[key])])
  );
}

function exactObject(actual, expected, label) {
  if (JSON.stringify(stable(actual)) !== JSON.stringify(stable(expected))) {
    fail(`${label} differs from frozen authority`);
  }
}

function exactKeys(actual, expected, label) {
  exactObject(Object.keys(object(actual, label)).sort(), [...expected].sort(), `${label} keys`);
}

export function validateAlpha2Recertification(
  authority,
  { catalog, alpha1, rc8Receipt, harnessAuthority }
) {
  exactKeys(
    authority,
    ['schemaVersion', 'purpose', 'baseline', 'matrix', 'gate', 'items', 'historicalAuthority'],
    'authority'
  );
  exact(authority.schemaVersion, 3, 'schemaVersion');
  exact(
    authority.purpose,
    'alpha2-community-skin-item-recertification',
    'purpose'
  );
  exactKeys(authority.baseline, Object.keys(EXPECTED_BASELINE), 'baseline');
  exactObject(authority.baseline, EXPECTED_BASELINE, 'baseline');

  exactKeys(
    authority.matrix,
    ['platforms', 'nodeVersions', 'requiredTasksPerItem', 'requiredTotalTasks'],
    'matrix'
  );
  exactObject(authority.matrix.platforms, EXPECTED_PLATFORMS, 'matrix.platforms');
  exactObject(
    authority.matrix.nodeVersions,
    EXPECTED_NODE_VERSIONS,
    'matrix.nodeVersions'
  );
  exact(authority.matrix.requiredTasksPerItem, 6, 'matrix.requiredTasksPerItem');
  exact(authority.matrix.requiredTotalTasks, 66, 'matrix.requiredTotalTasks');

  const gate = object(authority.gate, 'gate');
  exactKeys(
    gate,
    [
      'status',
      'requiredItems',
      'reviewedItems',
      'completedTasks',
      'installableItems',
      'installable',
      'showcasePublicationAllowed',
      'installPublicationAllowed',
      'runtimeReceiptSetSha256',
      'rollbackReceiptSetSha256',
      'cohortPolicy',
      'publicationRule',
    ],
    'gate'
  );
  exact(gate.status, 'alpha2-item-runtime-evidence-pending', 'gate.status');
  exact(gate.requiredItems, 11, 'gate.requiredItems');
  exact(gate.reviewedItems, 0, 'gate.reviewedItems');
  exact(gate.completedTasks, 0, 'gate.completedTasks');
  exact(gate.installableItems, 0, 'gate.installableItems');
  exact(gate.installable, false, 'gate.installable');
  exact(
    gate.showcasePublicationAllowed,
    true,
    'gate.showcasePublicationAllowed'
  );
  exact(
    gate.installPublicationAllowed,
    false,
    'gate.installPublicationAllowed'
  );
  exact(gate.runtimeReceiptSetSha256, null, 'gate.runtimeReceiptSetSha256');
  exact(gate.rollbackReceiptSetSha256, null, 'gate.rollbackReceiptSetSha256');
  exactObject(gate.cohortPolicy, ALPHA2_COHORT_POLICY, 'gate.cohortPolicy');
  if (
    typeof gate.publicationRule !== 'string' ||
    !gate.publicationRule.includes('All 11 exact items') ||
    !gate.publicationRule.includes('all nine') ||
    !gate.publicationRule.includes('QQ98 #2206') ||
    !gate.publicationRule.includes('THS #2207') ||
    !gate.publicationRule.includes('showcase-only') ||
    !gate.publicationRule.includes('complete rollback')
  ) {
    fail('gate.publicationRule is incomplete');
  }

  if (!Array.isArray(authority.items) || authority.items.length !== 11) {
    fail('items must contain the exact 11-item historical allowlist');
  }
  if (!Array.isArray(catalog?.skins) || catalog.skins.length !== 11) {
    fail('historical catalog must contain exactly 11 skins');
  }
  const seen = new Set();
  for (const item of authority.items) {
    exactKeys(
      item,
      [
        'catalogId',
        'slug',
        'status',
        'reviewed',
        'completedTasks',
        'installable',
        'showcaseVisible',
        'ineligibilityReasons',
        'runtimeReceiptSetSha256',
        'rollbackReceiptSetSha256',
      ],
      `item ${item?.slug ?? '<unknown>'}`
    );
    const key = `${item.catalogId}:${item.slug}`;
    if (seen.has(key)) fail(`duplicate item ${key}`);
    seen.add(key);
    const historical = catalog.skins.find(
      (skin) => skin.catalogId === item.catalogId && skin.slug === item.slug
    );
    if (!historical) fail(`item ${key} changes the historical allowlist`);
    exact(item.status, 'verification-pending', `${key}.status`);
    exact(item.reviewed, false, `${key}.reviewed`);
    exact(item.completedTasks, 0, `${key}.completedTasks`);
    exact(item.installable, false, `${key}.installable`);
    exact(item.showcaseVisible, true, `${key}.showcaseVisible`);
    exactObject(
      item.ineligibilityReasons,
      ['alpha2-item-runtime-evidence-pending'],
      `${key}.ineligibilityReasons`
    );
    exact(item.runtimeReceiptSetSha256, null, `${key}.runtimeReceiptSetSha256`);
    exact(item.rollbackReceiptSetSha256, null, `${key}.rollbackReceiptSetSha256`);
  }

  const historical = object(authority.historicalAuthority, 'historicalAuthority');
  exactKeys(
    historical,
    [
      'alpha1Path',
      'alpha1Sha256',
      'alpha1MayAuthorizeAlpha2',
      'rc8CatalogPath',
      'rc8CatalogSha256',
      'rc8ReceiptPath',
      'rc8ReceiptSha256',
      'rc8MayAuthorizeAlpha2',
    ],
    'historicalAuthority'
  );
  exact(historical.alpha1Path, 'alpha1-recertification.json', 'historical alpha1 path');
  exact(historical.alpha1Sha256, ALPHA1_RECERTIFICATION_SHA256, 'historical alpha1 sha256');
  exact(historical.alpha1MayAuthorizeAlpha2, false, 'historical alpha1 authority scope');
  exact(historical.rc8CatalogPath, 'community-catalog.json', 'historical RC.8 catalog path');
  exact(historical.rc8CatalogSha256, COMMUNITY_CATALOG_SHA256, 'historical RC.8 catalog sha256');
  exact(historical.rc8ReceiptPath, 'runtime-receipt.rc8.json', 'historical RC.8 receipt path');
  exact(historical.rc8ReceiptSha256, RC8_RUNTIME_RECEIPT_SHA256, 'historical RC.8 receipt sha256');
  exact(historical.rc8MayAuthorizeAlpha2, false, 'historical RC.8 authority scope');

  exact(alpha1?.baseline?.dshPackageVersion, '0.1.2-alpha.1', 'historical alpha1 version');
  exact(alpha1?.historicalAuthority?.mayAuthorizeAlpha1, false, 'historical alpha1 gate scope');
  exact(rc8Receipt?.summary?.itemsCovered, 11, 'historical RC.8 item count');
  exact(rc8Receipt?.authority?.installable, true, 'historical RC.8 captured status');

  exact(harnessAuthority?.release?.tag, EXPECTED_BASELINE.officialTag, 'Harness tag');
  exact(harnessAuthority?.release?.commit, EXPECTED_BASELINE.sourceCommit, 'Harness commit');
  exact(harnessAuthority?.release?.tree, EXPECTED_BASELINE.sourceTree, 'Harness tree');
  exact(harnessAuthority?.officialNpm?.packageName, EXPECTED_BASELINE.dshPackageName, 'Harness npm package');
  exact(harnessAuthority?.officialNpm?.version, EXPECTED_BASELINE.dshPackageVersion, 'Harness npm version');
  exact(
    harnessAuthority?.officialNpm?.tarballSha256,
    EXPECTED_BASELINE.officialNpmTarballSha256,
    'Harness npm tarball sha256'
  );
  exact(
    harnessAuthority?.officialNpm?.distIntegrity,
    EXPECTED_BASELINE.officialNpmIntegrity,
    'Harness npm integrity'
  );
  exact(
    harnessAuthority?.publication?.status,
    'runtime-receipt-verified',
    'Harness runtime status'
  );
  exact(
    harnessAuthority?.publication?.publishedInstallable,
    true,
    'Harness runtime installability'
  );
  exact(
    harnessAuthority?.publication?.completedReceipts?.length,
    6,
    'Harness completed runtime receipts'
  );
  exact(
    harnessAuthority?.publication?.receiptSetSha256,
    '3a1017961b0fbc2ac3e773913009c842332b030b5494a5af454594afdb679d0a',
    'Harness runtime receipt set sha256'
  );

  return {
    status: gate.status,
    baselineId: authority.baseline.baselineId,
    requiredItems: gate.requiredItems,
    reviewedItems: gate.reviewedItems,
    requiredTasks: authority.matrix.requiredTotalTasks,
    completedTasks: gate.completedTasks,
    installableItems: gate.installableItems,
    installable: gate.installable,
    showcasePublicationAllowed: gate.showcasePublicationAllowed,
    installPublicationAllowed: gate.installPublicationAllowed,
    skinCenterCohortItems: gate.cohortPolicy.skinCenterBuiltin.requiredMembers,
    independentItems: gate.cohortPolicy.independentItems.requiredMembers,
    historicalAlpha1MayAuthorize: historical.alpha1MayAuthorizeAlpha2,
    historicalRc8MayAuthorize: historical.rc8MayAuthorizeAlpha2,
  };
}

export async function loadAlpha2RecertificationAuthority() {
  const [
    authorityBytes,
    schemaBytes,
    catalogBytes,
    alpha1Bytes,
    rc8ReceiptBytes,
    harnessAuthorityBytes,
  ] = await Promise.all([
    readFile(authorityUrl),
    readFile(schemaUrl),
    readFile(catalogUrl),
    readFile(alpha1Url),
    readFile(rc8ReceiptUrl),
    readFile(harnessAuthorityUrl),
  ]);
  const digests = [
    [authorityBytes, ALPHA2_RECERTIFICATION_SHA256, 'alpha2 authority'],
    [schemaBytes, ALPHA2_RECERTIFICATION_SCHEMA_SHA256, 'alpha2 authority schema'],
    [catalogBytes, COMMUNITY_CATALOG_SHA256, 'historical community catalog'],
    [alpha1Bytes, ALPHA1_RECERTIFICATION_SHA256, 'historical alpha1 authority'],
    [rc8ReceiptBytes, RC8_RUNTIME_RECEIPT_SHA256, 'historical RC.8 receipt'],
    [harnessAuthorityBytes, ALPHA2_HARNESS_AUTHORITY_SHA256, 'alpha2 Harness authority'],
  ];
  for (const [bytes, expected, label] of digests) {
    exact(sha256(bytes), expected, `${label} sha256`);
  }
  const authority = JSON.parse(authorityBytes.toString('utf8'));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const alpha1 = JSON.parse(alpha1Bytes.toString('utf8'));
  const rc8Receipt = JSON.parse(rc8ReceiptBytes.toString('utf8'));
  const harnessAuthority = JSON.parse(harnessAuthorityBytes.toString('utf8'));
  const summary = validateAlpha2Recertification(authority, {
    catalog,
    alpha1,
    rc8Receipt,
    harnessAuthority,
  });
  return {
    authority,
    catalog,
    alpha1,
    rc8Receipt,
    harnessAuthority,
    summary,
    authorityBytes,
    schemaBytes,
  };
}

export function assertPlannedMatrixTarget(authority, target, nodeVersion) {
  if (typeof target !== 'string' || !/^(darwin-arm64|linux-x64|win32-x64)$/.test(target)) {
    fail('target must be darwin-arm64, linux-x64, or win32-x64');
  }
  if (!EXPECTED_NODE_VERSIONS.includes(nodeVersion)) {
    fail('node version is outside the frozen matrix');
  }
  const [os, arch] = target.split('-');
  if (!authority.matrix.platforms.some((entry) => entry.os === os && entry.arch === arch)) {
    fail('target is outside the frozen matrix');
  }
}
