#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const intakeUrl = new URL('../references/plugin-candidate-intake.json', import.meta.url);
const schemaUrl = new URL('../references/plugin-candidate-intake.schema.json', import.meta.url);

const COMMIT = /^[a-f0-9]{40}$/u;
const REPOSITORY = /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git$/u;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const SAFE_TEXT = /^[^\u0000-\u001f\u007f]{1,100}$/u;
const SAFE_PATH = /^(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/u;
const SAFE_SUBDIR = /^(?:\.|[A-Za-z0-9_-]+(?:[A-Za-z0-9._-]*[A-Za-z0-9_-])?(?:\/[A-Za-z0-9_-]+(?:[A-Za-z0-9._-]*[A-Za-z0-9_-])?)*)$/u;
const USE_CASES = new Set([
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
]);

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

export function validateCandidateIntake(intake) {
  exactKeys(
    intake,
    [
      'schemaVersion',
      'capturedAt',
      'purpose',
      'baseline',
      'publication',
      'replacementPolicy',
      'items',
    ],
    'candidate intake'
  );
  if (
    intake.schemaVersion !== 2 ||
    intake.purpose !== 'dsh-plugin-alpha1-candidate-intake' ||
    !/^\d{4}-\d{2}-\d{2}$/u.test(intake.capturedAt)
  ) {
    fail('candidate intake header mismatch');
  }
  exactKeys(intake.baseline, ['tag', 'commit'], 'candidate intake baseline');
  if (
    intake.baseline.tag !== 'dsh-v0.1.2-alpha.1' ||
    intake.baseline.commit !== 'cd5ef8148158c3a752a658978873241fdf8e2bbc'
  ) {
    fail('candidate intake baseline mismatch');
  }
  exactKeys(
    intake.publication,
    ['status', 'installable', 'requiredFinalCount'],
    'candidate intake publication'
  );
  if (
    intake.publication.status !== 'not-installable-candidate-input' ||
    intake.publication.installable !== false ||
    intake.publication.requiredFinalCount !== 80
  ) {
    fail('candidate intake must remain explicitly non-installable');
  }
  exactKeys(
    intake.replacementPolicy,
    [
      'retireFailedIds',
      'retiredCatalogIds',
      'nextReplacementCatalogId',
      'neverRebindRetiredIds',
    ],
    'candidate intake replacement policy'
  );
  if (
    intake.replacementPolicy.retireFailedIds !== true ||
    intake.replacementPolicy.neverRebindRetiredIds !== true ||
    !Array.isArray(intake.replacementPolicy.retiredCatalogIds) ||
    !Number.isSafeInteger(intake.replacementPolicy.nextReplacementCatalogId) ||
    intake.replacementPolicy.nextReplacementCatalogId < 3088 ||
    intake.replacementPolicy.nextReplacementCatalogId > 3999
  ) {
    fail('candidate replacement policy is weaker than the public-ID retirement contract');
  }
  const retiredIds = intake.replacementPolicy.retiredCatalogIds;
  if (
    retiredIds.some(
      (catalogId) =>
        !Number.isSafeInteger(catalogId) ||
        catalogId < 3000 ||
        catalogId >= intake.replacementPolicy.nextReplacementCatalogId
    ) ||
    JSON.stringify(retiredIds) !== JSON.stringify([...retiredIds].sort((left, right) => left - right)) ||
    new Set(retiredIds).size !== retiredIds.length
  ) {
    fail('retired public IDs must be unique, ascending, and below the next replacement ID');
  }
  if (!Array.isArray(intake.items) || intake.items.length !== 80) {
    fail('candidate intake must contain exactly 80 editorial inputs');
  }
  const ids = [];
  const sourceCoordinates = [];
  const slugs = [];
  for (const [index, item] of intake.items.entries()) {
    const label = `candidate intake items[${index}]`;
    const requiredKeys = [
        'catalogId',
        'slug',
        'title',
        'repository',
        'commit',
        'licenseExpression',
        'licenseEvidencePath',
        'primaryUseCase',
        'editorialScore',
        'status',
      ];
    const actualKeys = Object.keys(item).sort();
    const withoutSubdir = [...requiredKeys].sort();
    const withSubdir = [...requiredKeys, 'sourceSubdir'].sort();
    if (
      JSON.stringify(actualKeys) !== JSON.stringify(withoutSubdir) &&
      JSON.stringify(actualKeys) !== JSON.stringify(withSubdir)
    ) {
      fail(`${label} keys mismatch`);
    }
    const sourceSubdir = item.sourceSubdir ?? '.';
    if (
      !Number.isSafeInteger(item.catalogId) ||
      item.catalogId < 3000 ||
      item.catalogId > 3999 ||
      !SLUG.test(item.slug) ||
      !SAFE_TEXT.test(item.title) ||
      !REPOSITORY.test(item.repository) ||
      !SAFE_SUBDIR.test(sourceSubdir) ||
      !COMMIT.test(item.commit) ||
      !SAFE_TEXT.test(item.licenseExpression) ||
      !SAFE_PATH.test(item.licenseEvidencePath) ||
      !USE_CASES.has(item.primaryUseCase) ||
      !Number.isSafeInteger(item.editorialScore) ||
      item.editorialScore < 0 ||
      item.editorialScore > 100 ||
      item.status !== 'source-intake-pending'
    ) {
      fail(`${label} is malformed or claims more than source-intake-pending`);
    }
    ids.push(item.catalogId);
    sourceCoordinates.push(`${item.repository.toLowerCase()}::${sourceSubdir.toLowerCase()}`);
    slugs.push(item.slug);
  }
  if (JSON.stringify(ids) !== JSON.stringify([...ids].sort((left, right) => left - right))) {
    fail('candidate intake IDs must use canonical ascending order');
  }
  if (new Set(ids).size !== ids.length) fail('candidate intake contains duplicate public IDs');
  if (ids.some((catalogId) => retiredIds.includes(catalogId))) {
    fail('candidate intake rebinds a permanently retired public ID');
  }
  if (new Set(sourceCoordinates).size !== sourceCoordinates.length) {
    fail('candidate intake contains duplicate repository/package coordinates');
  }
  if (new Set(slugs).size !== slugs.length) fail('candidate intake contains duplicate slugs');
  return intake;
}

export async function loadCandidateIntake() {
  return validateCandidateIntake(JSON.parse(await readFile(intakeUrl, 'utf8')));
}

export async function loadCandidateIntakeSchema() {
  return JSON.parse(await readFile(schemaUrl, 'utf8'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const intake = await loadCandidateIntake();
    if (process.argv.length === 3 && process.argv[2] === '--github-matrix') {
      process.stdout.write(
        `${JSON.stringify({
          include: intake.items.map((item) => ({
            catalogId: item.catalogId,
            repository: item.repository
              .replace(/^https:\/\/github\.com\//u, '')
              .replace(/\.git$/u, ''),
            commit: item.commit,
            sourceSubdir: item.sourceSubdir ?? '.',
          })),
        })}\n`
      );
      process.exit(0);
    }
    if (process.argv.length !== 2) {
      fail('usage: candidate-intake.mjs [--github-matrix]');
    }
    process.stdout.write(
      `${JSON.stringify({
        valid: true,
        status: intake.publication.status,
        installable: intake.publication.installable,
        candidateCount: intake.items.length,
        retiredCatalogIds: intake.replacementPolicy.retiredCatalogIds,
        nextReplacementCatalogId: intake.replacementPolicy.nextReplacementCatalogId,
      })}\n`
    );
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
