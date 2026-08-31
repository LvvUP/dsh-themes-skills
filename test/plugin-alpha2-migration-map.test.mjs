import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  loadAlpha2PluginMigrationMap,
  loadAlpha2PluginMigrationMapSchema,
  validateAlpha2PluginMigrationMap,
} from '../skills/dsh-plugin-installer/scripts/validate-alpha2-plugin-migration-map.mjs';

const alpha1MapUrl = new URL(
  '../skills/dsh-plugin-installer/references/alpha1-plugin-migration-map.md',
  import.meta.url
);
const alpha2MapDocUrl = new URL(
  '../skills/dsh-plugin-installer/references/alpha2-plugin-migration-map.md',
  import.meta.url
);

test('alpha.2 migration evidence freezes the exact 6/10/28 outcomes and 44-candidate pool', async () => {
  const map = await loadAlpha2PluginMigrationMap();

  assert.equal(map.publication.status, 'static-reviewed-pending-runtime');
  assert.equal(map.publication.installable, false);
  assert.equal(map.publication.runtimeCertifiedCount, 0);
  assert.equal(map.baseline.commit, '0a53fb55bea101816fa226bb964ae2bed71c343b');
  assert.equal(map.baseline.tree, '64ccbfa8e0caa4711cd4a75717ef9e022657961b');
  assert.equal(map.awesomeSnapshot.commit, 'db181e1aed39ad4a041cb9d379f0d713edfc49bb');
  assert.equal(map.awesomeSnapshot.tree, '24c75117d9fe59fd832359c7ef2ab14632fd543d');
  assert.deepEqual(
    map.directPinRetained.map((item) => item.catalogId),
    [3021, 3022, 3032, 3039, 3066, 3076]
  );
  assert.deepEqual(
    map.hostedAdaptationRetained.map((item) => item.catalogId),
    [3004, 3006, 3008, 3010, 3011, 3017, 3040, 3041, 3042, 3050]
  );
  assert.deepEqual(
    map.retired.map((item) => item.catalogId),
    [
      3009, 3012, 3013, 3014, 3015, 3018, 3020, 3026, 3034, 3035, 3037, 3043, 3044,
      3047, 3055, 3056, 3057, 3059, 3060, 3061, 3065, 3071, 3072, 3073, 3078, 3079,
      3080, 3086,
    ]
  );
  assert.equal(map.replacementCandidates.length, 44);
  assert.equal(
    map.replacementCandidates.filter(
      (candidate) => candidate.distributionClass === 'direct-upstream-exact'
    ).length,
    35
  );
  assert.equal(
    map.replacementCandidates.filter(
      (candidate) => candidate.distributionClass === 'hosted-adaptation-required'
    ).length,
    9
  );
});

test('replacement candidates remain ID-less, exact-pinned, unique, and pending runtime', async () => {
  const map = await loadAlpha2PluginMigrationMap();
  const serialized = JSON.stringify(map.replacementCandidates);

  assert.ok(
    map.replacementCandidates.every(
      (candidate) =>
        !Object.hasOwn(candidate, 'catalogId') &&
        !Object.hasOwn(candidate, 'publicId') &&
        candidate.staticReviewStatus === 'static-reviewed' &&
        candidate.runtimeStatus === 'pending-runtime' &&
        /^[a-f0-9]{40}$/u.test(candidate.commit) &&
        /^[a-f0-9]{40}$/u.test(candidate.tree)
    )
  );
  assert.equal(
    new Set(
      map.replacementCandidates.map(
        (candidate) => `${candidate.repository.toLowerCase()}::${candidate.sourceSubdir.toLowerCase()}`
      )
    ).size,
    44
  );
  assert.equal(
    new Set(map.replacementCandidates.map((candidate) => candidate.packageName.toLowerCase())).size,
    44
  );
  assert.doesNotMatch(serialized, /\/latest(?:\/|")/iu);
  assert.doesNotMatch(serialized, /\/tree\/(?:main|master)(?:\/|")/iu);
  assert.doesNotMatch(serialized, /refs\/heads\//iu);
});

test('alpha.2 migration validator fails closed on publication, identity, and mutable pins', async () => {
  const map = await loadAlpha2PluginMigrationMap();

  const published = structuredClone(map);
  published.publication.installable = true;
  assert.throws(
    () => validateAlpha2PluginMigrationMap(published),
    /explicitly non-installable/
  );

  const wrongBaseline = structuredClone(map);
  wrongBaseline.baseline.tree = '0'.repeat(40);
  assert.throws(() => validateAlpha2PluginMigrationMap(wrongBaseline), /baseline tag\/commit\/tree/);

  const rebound = structuredClone(map);
  rebound.directPinRetained[0].catalogId = 3009;
  assert.throws(() => validateAlpha2PluginMigrationMap(rebound), /directPinRetained public IDs/);

  const preallocated = structuredClone(map);
  preallocated.replacementCandidates[0].publicId = 3089;
  assert.throws(() => validateAlpha2PluginMigrationMap(preallocated), /keys mismatch|Public ID/);

  const mutableCommit = structuredClone(map);
  mutableCommit.replacementCandidates[0].commit = 'main';
  assert.throws(() => validateAlpha2PluginMigrationMap(mutableCommit), /malformed/);

  const mutableRelease = structuredClone(map);
  const released = mutableRelease.replacementCandidates.find(
    (candidate) => candidate.upstreamInstall.mode === 'github-release-exact'
  );
  released.upstreamInstall.exactCoordinate = released.upstreamInstall.exactCoordinate.replace(
    /\/releases\/download\/[^/]+\//u,
    '/releases/latest/download/'
  );
  assert.throws(
    () => validateAlpha2PluginMigrationMap(mutableRelease),
    /mutable install coordinate/
  );

  const runtimeClaim = structuredClone(map);
  runtimeClaim.replacementCandidates[0].runtimeStatus = 'certified';
  assert.throws(() => validateAlpha2PluginMigrationMap(runtimeClaim), /claims runtime certification/);
});

test('alpha.2 migration validator rejects duplicate source and install coordinates', async () => {
  const map = await loadAlpha2PluginMigrationMap();

  const duplicateSource = structuredClone(map);
  const hostedCandidates = duplicateSource.replacementCandidates.filter(
    (candidate) => candidate.distributionClass === 'hosted-adaptation-required'
  );
  hostedCandidates[1].repository = hostedCandidates[0].repository;
  hostedCandidates[1].sourceSubdir = hostedCandidates[0].sourceSubdir;
  hostedCandidates[1].candidateKey = hostedCandidates[0].candidateKey;
  assert.throws(
    () => validateAlpha2PluginMigrationMap(duplicateSource),
    /duplicate repository\/package coordinates/
  );

  const duplicateInstall = structuredClone(map);
  const hostedInstallCandidates = duplicateInstall.replacementCandidates.filter(
    (candidate) => candidate.upstreamInstall.mode === 'hosted-adaptation-required'
  );
  hostedInstallCandidates[1].commit = hostedInstallCandidates[0].commit;
  hostedInstallCandidates[1].upstreamInstall.exactCoordinate =
    hostedInstallCandidates[0].upstreamInstall.exactCoordinate;
  assert.throws(
    () => validateAlpha2PluginMigrationMap(duplicateInstall),
    /duplicate exact install\/source coordinates/
  );

  const existingRepo = map.replacementCandidates[0].repository;
  assert.throws(
    () =>
      validateAlpha2PluginMigrationMap(map, {
        existingRepositories: [existingRepo],
      }),
    /duplicates an existing 80-item repository/
  );
});

test('schema and documentation preserve the pending-runtime Public ID issuance gate', async () => {
  const [schema, alpha1Map, alpha2MapDoc] = await Promise.all([
    loadAlpha2PluginMigrationMapSchema(),
    readFile(alpha1MapUrl, 'utf8'),
    readFile(alpha2MapDocUrl, 'utf8'),
  ]);

  assert.equal(schema.properties.baseline.properties.tag.const, 'dsh-v0.1.2-alpha.2');
  assert.equal(
    schema.properties.baseline.properties.commit.const,
    '0a53fb55bea101816fa226bb964ae2bed71c343b'
  );
  assert.equal(schema.properties.replacementCandidates.minItems, 44);
  assert.equal(schema.properties.replacementCandidates.maxItems, 44);
  assert.equal(schema.$defs.replacementCandidate.additionalProperties, false);
  assert.equal(schema.$defs.replacementCandidate.properties.runtimeStatus.const, 'pending-runtime');
  assert.equal(schema.properties.idPolicy.properties.firstEligibleReplacementCatalogId.const, 3089);
  assert.equal(schema.properties.idPolicy.properties.idsToIssueAfterCertification.const, 28);

  assert.match(alpha1Map, /dsh-v0\.1\.2-alpha\.1/u);
  assert.match(alpha1Map, /cd5ef8148158c3a752a658978873241fdf8e2bbc/u);
  assert.match(alpha1Map, /a712eec535b48badc4fefb4df5176a7002e4280b/u);
  assert.match(alpha2MapDoc, /28 retired IDs are never rebound/u);
  assert.match(alpha2MapDoc, /all six alpha\.2 runtime\s+tasks/u);
  assert.match(alpha2MapDoc, /beginning at `#3089` and\s+continuing sequentially/u);
  assert.match(
    alpha2MapDoc,
    /binds their exact\s+bytes only as a fail-closed migration prerequisite/u,
  );
  assert.match(alpha2MapDoc, /installable `items`\s+array remains empty/u);
});
