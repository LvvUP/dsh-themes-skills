import assert from 'node:assert/strict';
import test from 'node:test';

import {
  loadCandidateIntake,
  loadCandidateIntakeSchema,
  validateCandidateIntake,
} from '../skills/dsh-plugin-installer/scripts/candidate-intake.mjs';

test('the 80-item Plugin intake is immutable source input, never installation authority', async () => {
  const intake = await loadCandidateIntake();
  assert.equal(intake.schemaVersion, 2);
  assert.equal(intake.items.length, 80);
  assert.equal(intake.publication.status, 'not-installable-candidate-input');
  assert.equal(intake.publication.installable, false);
  assert.deepEqual(intake.replacementPolicy.retiredCatalogIds, [3003]);
  assert.equal(intake.replacementPolicy.nextReplacementCatalogId, 3089);
  assert.ok(!intake.items.some((item) => item.catalogId === 3003));
  assert.equal(intake.items.at(-1).catalogId, 3088);
  assert.equal(intake.items.at(-1).editorialScore, 92);
  assert.equal(new Set(intake.items.map((item) => item.catalogId)).size, 80);
  assert.equal(
    new Set(intake.items.map((item) => `${item.repository}::${item.sourceSubdir ?? '.'}`)).size,
    80
  );
  assert.equal(new Set(intake.items.map((item) => item.slug)).size, 80);
  assert.ok(intake.items.every((item) => /^[a-f0-9]{40}$/u.test(item.commit)));
  assert.ok(intake.items.every((item) => item.status === 'source-intake-pending'));
});

test('candidate intake rejects publication claims, mutable source, and rebound IDs', async () => {
  const intake = await loadCandidateIntake();
  const published = structuredClone(intake);
  published.publication.installable = true;
  assert.throws(() => validateCandidateIntake(published), /explicitly non-installable/);

  const mutable = structuredClone(intake);
  mutable.items[0].commit = 'main';
  assert.throws(() => validateCandidateIntake(mutable), /malformed/);

  const traversal = structuredClone(intake);
  traversal.items[0].sourceSubdir = '../packages/plugin';
  assert.throws(() => validateCandidateIntake(traversal), /malformed/);

  const duplicatePackage = structuredClone(intake);
  duplicatePackage.items[1].repository = duplicatePackage.items[0].repository;
  duplicatePackage.items[1].sourceSubdir = duplicatePackage.items[0].sourceSubdir ?? '.';
  assert.throws(
    () => validateCandidateIntake(duplicatePackage),
    /duplicate repository\/package coordinates/
  );

  const caseAliasedPackage = structuredClone(intake);
  caseAliasedPackage.items[1].repository = caseAliasedPackage.items[0].repository;
  caseAliasedPackage.items[0].sourceSubdir = 'packages/Example';
  caseAliasedPackage.items[1].sourceSubdir = 'packages/example';
  assert.throws(
    () => validateCandidateIntake(caseAliasedPackage),
    /duplicate repository\/package coordinates/
  );

  const rebound = structuredClone(intake);
  rebound.items[1].catalogId = rebound.items[0].catalogId;
  assert.throws(
    () => validateCandidateIntake(rebound),
    /canonical ascending order|duplicate public IDs/
  );

  const resurrected = structuredClone(intake);
  resurrected.items[0].catalogId = 3003;
  assert.throws(
    () => validateCandidateIntake(resurrected),
    /rebinds a permanently retired public ID/
  );
});

test('candidate intake schema preserves the exact 80-item pending boundary', async () => {
  const schema = await loadCandidateIntakeSchema();
  assert.equal(schema.properties.items.minItems, 80);
  assert.equal(schema.properties.items.maxItems, 80);
  assert.equal(schema.properties.publication.properties.installable.const, false);
  assert.equal(schema.$defs.item.properties.status.const, 'source-intake-pending');
  assert.equal(schema.properties.replacementPolicy.properties.nextReplacementCatalogId.minimum, 3088);
  assert.equal(schema.properties.replacementPolicy.properties.retiredCatalogIds.uniqueItems, true);
});
