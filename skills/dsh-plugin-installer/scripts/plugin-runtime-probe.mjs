const PACKAGE = /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/u;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const SAFE_ID = /^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/u;
const CONTROL = /[\u0000-\u001f\u007f]/u;
const ASSERTION_CLASSES = new Set([
  'package-graph',
  'cold-web-boot',
  'feature-contract',
  'security-boundary',
  'accessibility-responsive',
  'teardown-rollback',
  'combination',
]);

function fail(message) {
  throw new Error(message);
}

function exactKeys(value, keys, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) {
    fail(`${label} keys mismatch`);
  }
}

function boundedStrings(values, label) {
  if (!Array.isArray(values) || values.length > 32 ||
      values.some((value) => typeof value !== 'string' || value.length < 1 ||
        value.length > 240 || CONTROL.test(value)) ||
      new Set(values).size !== values.length) {
    fail(`${label} must be one bounded unique string list`);
  }
}

export function validatePluginRuntimeProbe(contract) {
  exactKeys(contract, [
    'schemaVersion', 'purpose', 'authorityEffect', 'candidateExecuted',
    'catalogId', 'baseline', 'package', 'capabilities', 'combination', 'assertions',
  ], 'plugin runtime probe');
  if (contract.schemaVersion !== 1 ||
      contract.purpose !== 'dsh-plugin-alpha1-fixed-runtime-probe' ||
      contract.authorityEffect !== 'contract-only-not-runtime-authority' ||
      contract.candidateExecuted !== false || !Number.isSafeInteger(contract.catalogId) ||
      contract.catalogId < 3000 || contract.catalogId > 9999) {
    fail('plugin runtime probe header is malformed');
  }
  exactKeys(contract.baseline, ['tag', 'commit', 'tree'], 'plugin runtime probe baseline');
  if (contract.baseline.tag !== 'dsh-v0.1.2-alpha.1' ||
      contract.baseline.commit !== 'cd5ef8148158c3a752a658978873241fdf8e2bbc' ||
      contract.baseline.tree !== 'a712eec535b48badc4fefb4df5176a7002e4280b') {
    fail('plugin runtime probe baseline is not the exact official alpha.1 source');
  }
  exactKeys(
    contract.package,
    ['name', 'version', 'profile', 'cordisEntryId'],
    'plugin runtime probe package'
  );
  if (!PACKAGE.test(contract.package.name ?? '') || !SEMVER.test(contract.package.version ?? '') ||
      contract.package.profile !== 'web' || !SAFE_ID.test(contract.package.cordisEntryId ?? '')) {
    fail('plugin runtime probe package identity is malformed');
  }
  exactKeys(contract.capabilities, [
    'permissions', 'network', 'processes', 'files', 'clientServices',
    'remoteMethods', 'browserPersistence',
  ], 'plugin runtime probe capabilities');
  for (const key of [
    'permissions', 'network', 'processes', 'files', 'clientServices', 'remoteMethods',
  ]) {
    boundedStrings(contract.capabilities[key], `plugin runtime probe capabilities.${key}`);
  }
  if (['permissions', 'network', 'processes', 'files']
    .every((key) => contract.capabilities[key].length === 0) ||
      !['none', 'settings-scope-only'].includes(contract.capabilities.browserPersistence)) {
    fail('plugin runtime probe requires one concrete capability and closed persistence mode');
  }
  exactKeys(
    contract.combination,
    ['additiveSlots', 'exclusiveResources', 'officialSurfacePreserved'],
    'plugin runtime probe combination'
  );
  boundedStrings(contract.combination.additiveSlots, 'plugin runtime probe additive slots');
  boundedStrings(contract.combination.exclusiveResources, 'plugin runtime probe exclusive resources');
  if (typeof contract.combination.officialSurfacePreserved !== 'boolean') {
    fail('plugin runtime probe official surface flag is malformed');
  }
  if (!Array.isArray(contract.assertions) || contract.assertions.length < 1 ||
      contract.assertions.length > 32) {
    fail('plugin runtime probe assertions are missing or unbounded');
  }
  const assertionIds = new Set();
  for (const [index, assertion] of contract.assertions.entries()) {
    exactKeys(assertion, ['id', 'class', 'expected'], `plugin runtime probe assertions[${index}]`);
    if (!SAFE_ID.test(assertion.id ?? '') || assertionIds.has(assertion.id) ||
        !ASSERTION_CLASSES.has(assertion.class) || typeof assertion.expected !== 'string' ||
        assertion.expected.length < 1 || assertion.expected.length > 400 ||
        CONTROL.test(assertion.expected) || /https?:\/\//iu.test(assertion.expected)) {
      fail(`plugin runtime probe assertions[${index}] is malformed or duplicated`);
    }
    assertionIds.add(assertion.id);
  }
  return contract;
}
