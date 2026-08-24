import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateCandidateBaseline } from './validate-baseline-candidate.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
export const skillDir = resolve(scriptDir, '..');
export const runtimeDir = resolve(skillDir, 'runtime-dsh-0.1.1-rc.2');
export const protocolContractPath = resolve(
  skillDir,
  'references/rc2-final-protocol-contract.json'
);
export const selectorContractPath = resolve(
  skillDir,
  'references/rc2-final-selector-contract.json'
);

export const EXPECTED_BASELINE = '@deepseek-ai/dsh@0.1.1-rc.2';
export const EXPECTED_SOURCE_COMMIT =
  'b150a551b8d465e31e418e1b2eaf5e79bbb7d28e';
export const EXPECTED_GITHUB_WORKFLOW_REF =
  'LvvUP/dsh-themes-skills/.github/workflows/rc2-certification.yml@refs/heads/main';
export const EXPECTED_MATRIX = Object.freeze([
  Object.freeze({ platform: 'linux', nodeVersion: '22.19.0' }),
  Object.freeze({ platform: 'linux', nodeVersion: '24.15.0' }),
  Object.freeze({ platform: 'darwin', nodeVersion: '22.19.0' }),
  Object.freeze({ platform: 'darwin', nodeVersion: '24.15.0' }),
  Object.freeze({ platform: 'win32', nodeVersion: '22.19.0' }),
  Object.freeze({ platform: 'win32', nodeVersion: '24.15.0' }),
]);

export const EXPECTED_LIFECYCLE_COMMAND_SEQUENCE = Object.freeze([
  'initial-list',
  'add-exact-artifact',
  'list-after-add',
  'remove-exact-package',
  'list-after-rollback',
  'reverse-add-exact-artifact',
  'list-after-reverse',
  'final-remove-exact-package',
  'final-list',
]);
export const EXPECTED_LIFECYCLE_WEB_SEQUENCE = Object.freeze([
  'mode-light',
  'mode-dark',
  'mode-system-first-cold-start',
  'mode-system-second-cold-start',
  'rollback-built-in-cold-start',
  'reverse-installed-cold-start',
]);
export const EXPECTED_THEME_PREFERENCES = Object.freeze([
  'light',
  'dark',
  'system',
]);
export const EXPECTED_NEGATIVE_EVIDENCE_CASES = Object.freeze([
  Object.freeze({
    id: 'malformed-evidence-fails-closed',
    mutation: 'mutable-selector-latest',
    expectedStderrIncludes: 'mutable version selector refused',
  }),
  Object.freeze({
    id: 'mixed-version-evidence-fails-closed',
    mutation: 'dsh-artifact-version-0.1.0-rc.8',
    expectedStderrIncludes:
      'input sidecar is not the pinned candidate evidence',
  }),
]);
export const EXPECTED_LIFECYCLE_PROBE = Object.freeze({
  name: '@dsh-themes/rc2-lifecycle-probe',
  version: '0.0.0',
  packageManifest: Object.freeze({
    name: '@dsh-themes/rc2-lifecycle-probe',
    version: '0.0.0',
    description: 'Non-promotional RC.2 lifecycle certification probe',
    license: 'UNLICENSED',
    private: true,
    files: Object.freeze(['cordis.patch.yml']),
    dsh: Object.freeze({
      bundle: Object.freeze({ patch: './cordis.patch.yml' }),
    }),
  }),
  bundlePatch: '[]\n',
  packTool: 'pnpm@11.7.0',
});

const SHA256 = /^[a-f0-9]{64}$/;
const SHA1 = /^[a-f0-9]{40}$/;
const PACKAGE_NAME = /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/;
const SAFE_PACKAGE_FILE = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[a-zA-Z0-9._/-]+$/;
const MAX_SOURCE_BYTES = 2 * 1024 * 1024;
const MAX_TARBALL_BYTES = 64 * 1024 * 1024;

export const sha256 = (value) =>
  createHash('sha256').update(value).digest('hex');

export const sha1 = (value) =>
  createHash('sha1').update(value).digest('hex');

function fail(message) {
  throw new Error(`RC.2 final contract refused: ${message}`);
}

async function readJsonWithBytes(path) {
  const bytes = await readFile(path);
  return { bytes, value: JSON.parse(bytes.toString('utf8')) };
}

function exactKeys(value, expected, label) {
  const keys = Object.keys(value).sort();
  if (JSON.stringify(keys) !== JSON.stringify([...expected].sort())) {
    fail(`${label} keys differ from the closed contract`);
  }
}

export function buildNegativeCandidateFixture(candidate, id) {
  const value = JSON.parse(JSON.stringify(candidate));
  if (id === 'malformed-evidence-fails-closed') {
    value.compatibility.npmArtifacts.dsh.version = 'latest';
  } else if (id === 'mixed-version-evidence-fails-closed') {
    value.compatibility.npmArtifacts.dsh.version = '0.1.0-rc.8';
  } else {
    fail(`unknown negative evidence case: ${id}`);
  }
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
}

function validateLifecycleContract(value) {
  exactKeys(
    value,
    [
      'schemaVersion',
      'probePackage',
      'themePreferences',
      'commandSequence',
      'webLaunchSequence',
      'negativeEvidenceCases',
    ],
    'lifecycle acceptance'
  );
  exactKeys(
    value.probePackage,
    ['name', 'version', 'packageManifest', 'bundlePatch', 'packTool'],
    'lifecycle probe package'
  );
  if (
    value.schemaVersion !== 1 ||
    JSON.stringify(value.probePackage) !==
      JSON.stringify(EXPECTED_LIFECYCLE_PROBE) ||
    JSON.stringify(value.themePreferences) !==
      JSON.stringify(EXPECTED_THEME_PREFERENCES) ||
    JSON.stringify(value.commandSequence) !==
      JSON.stringify(EXPECTED_LIFECYCLE_COMMAND_SEQUENCE) ||
    JSON.stringify(value.webLaunchSequence) !==
      JSON.stringify(EXPECTED_LIFECYCLE_WEB_SEQUENCE) ||
    JSON.stringify(value.negativeEvidenceCases) !==
      JSON.stringify(EXPECTED_NEGATIVE_EVIDENCE_CASES)
  ) {
    fail('lifecycle acceptance differs from the closed RC.2 contract');
  }
}

function validateSourceEntry(entry) {
  exactKeys(
    entry,
    ['surface', 'path', 'bytes', 'sha256', 'requiredSubstrings'],
    `source ${entry?.path ?? '<unknown>'}`
  );
  if (
    typeof entry.surface !== 'string' ||
    !SAFE_PACKAGE_FILE.test(entry.path) ||
    !Number.isSafeInteger(entry.bytes) ||
    entry.bytes <= 0 ||
    entry.bytes > MAX_SOURCE_BYTES ||
    !SHA256.test(entry.sha256) ||
    !Array.isArray(entry.requiredSubstrings) ||
    entry.requiredSubstrings.length === 0 ||
    entry.requiredSubstrings.some(
      (needle) => typeof needle !== 'string' || needle.length === 0
    )
  ) {
    fail(`source contract is malformed for ${entry?.path ?? '<unknown>'}`);
  }
}

function validateInstalledEntry(entry) {
  exactKeys(
    entry,
    ['package', 'version', 'path', 'bytes', 'sha256', 'requiredSubstrings'],
    `installed artifact ${entry?.package ?? '<unknown>'}`
  );
  if (
    !PACKAGE_NAME.test(entry.package) ||
    typeof entry.version !== 'string' ||
    entry.version.length === 0 ||
    !SAFE_PACKAGE_FILE.test(entry.path) ||
    !Number.isSafeInteger(entry.bytes) ||
    entry.bytes <= 0 ||
    entry.bytes > MAX_SOURCE_BYTES ||
    !SHA256.test(entry.sha256) ||
    !Array.isArray(entry.requiredSubstrings) ||
    entry.requiredSubstrings.length === 0 ||
    entry.requiredSubstrings.some(
      (needle) => typeof needle !== 'string' || needle.length === 0
    )
  ) {
    fail(`installed artifact contract is malformed for ${entry?.package}`);
  }
}

export async function loadFinalContracts() {
  const [protocolResult, selectorResult] = await Promise.all([
    readJsonWithBytes(protocolContractPath),
    readJsonWithBytes(selectorContractPath),
  ]);
  const protocol = protocolResult.value;
  const selector = selectorResult.value;

  exactKeys(
    protocol,
    [
      'schemaVersion',
      'baseline',
      'officialRelease',
      'sourceFiles',
      'installedArtifacts',
      'lifecycleAcceptance',
      'cspBoundary',
    ],
    'protocol contract'
  );
  exactKeys(
    protocol.officialRelease,
    ['tag', 'sourceCommit', 'rawBaseUrl'],
    'official release'
  );
  exactKeys(
    protocol.cspBoundary,
    [
      'expectedServedContentSecurityPolicy',
      'strictCspCompatibilityClaimed',
      'reason',
    ],
    'CSP boundary'
  );
  if (
    protocol.schemaVersion !== 1 ||
    protocol.baseline !== EXPECTED_BASELINE ||
    protocol.officialRelease.tag !== 'dsh-v0.1.1-rc.2' ||
    protocol.officialRelease.sourceCommit !== EXPECTED_SOURCE_COMMIT ||
    protocol.officialRelease.rawBaseUrl !==
      `https://raw.githubusercontent.com/deepseek-ai/deepseek-harness/${EXPECTED_SOURCE_COMMIT}/` ||
    protocol.cspBoundary.expectedServedContentSecurityPolicy !== null ||
    protocol.cspBoundary.strictCspCompatibilityClaimed !== false ||
    typeof protocol.cspBoundary.reason !== 'string' ||
    protocol.cspBoundary.reason.length === 0 ||
    !Array.isArray(protocol.sourceFiles) ||
    protocol.sourceFiles.length !== 10 ||
    !Array.isArray(protocol.installedArtifacts) ||
    protocol.installedArtifacts.length !== 11
  ) {
    fail('protocol contract identity or closed cardinality differs');
  }
  protocol.sourceFiles.forEach(validateSourceEntry);
  protocol.installedArtifacts.forEach(validateInstalledEntry);
  validateLifecycleContract(protocol.lifecycleAcceptance);
  if (
    new Set(protocol.sourceFiles.map((entry) => entry.surface)).size !==
      protocol.sourceFiles.length ||
    new Set(protocol.sourceFiles.map((entry) => entry.path)).size !==
      protocol.sourceFiles.length ||
    new Set(
      protocol.installedArtifacts.map(
        (entry) => `${entry.package}@${entry.version}/${entry.path}`
      )
    ).size !== protocol.installedArtifacts.length
  ) {
    fail('protocol contract contains duplicate evidence coordinates');
  }

  exactKeys(
    selector,
    [
      'schemaVersion',
      'baseline',
      'officialSourceCommit',
      'algorithm',
      'sha256',
      'selectors',
      'scope',
      'qualification',
    ],
    'selector contract'
  );
  if (
    selector.schemaVersion !== 1 ||
    selector.baseline !== EXPECTED_BASELINE ||
    selector.officialSourceCommit !== EXPECTED_SOURCE_COMMIT ||
    selector.algorithm !== 'declared-order-selector-lf' ||
    !SHA256.test(selector.sha256) ||
    !Array.isArray(selector.selectors) ||
    selector.selectors.length !== 13 ||
    new Set(selector.selectors).size !== selector.selectors.length ||
    selector.selectors.some(
      (item) => typeof item !== 'string' || item.length === 0
    ) ||
    sha256(`${selector.selectors.join('\n')}\n`) !== selector.sha256 ||
    typeof selector.scope !== 'string' ||
    typeof selector.qualification !== 'string'
  ) {
    fail('selector contract is malformed or its canonical digest differs');
  }

  return {
    protocol,
    protocolSha256: sha256(protocolResult.bytes),
    selector,
    selectorSha256: sha256(selectorResult.bytes),
  };
}

async function listInstalledPackages() {
  const store = resolve(runtimeDir, 'node_modules/.pnpm');
  const packages = [];
  for (const storeEntry of await readdir(store)) {
    const modulesDir = resolve(store, storeEntry, 'node_modules');
    let names;
    try {
      names = await readdir(modulesDir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (name.startsWith('@')) {
        let children;
        try {
          children = await readdir(resolve(modulesDir, name));
        } catch {
          continue;
        }
        for (const child of children) {
          const root = resolve(modulesDir, name, child);
          try {
            const manifest = JSON.parse(
              await readFile(resolve(root, 'package.json'), 'utf8')
            );
            packages.push({
              name: manifest.name,
              version: manifest.version,
              root,
            });
          } catch {
            // Peer-only symlinks and non-package directories are not evidence.
          }
        }
      } else {
        const root = resolve(modulesDir, name);
        try {
          const manifest = JSON.parse(
            await readFile(resolve(root, 'package.json'), 'utf8')
          );
          packages.push({
            name: manifest.name,
            version: manifest.version,
            root,
          });
        } catch {
          // Ignore pnpm metadata directories.
        }
      }
    }
  }
  return packages;
}

export async function validateInstalledProtocolContract(contracts) {
  const packages = await listInstalledPackages();
  const observations = [];
  for (const expected of contracts.protocol.installedArtifacts) {
    const copies = packages.filter(
      (entry) =>
        entry.name === expected.package && entry.version === expected.version
    );
    if (copies.length === 0) {
      fail(`installed package is missing: ${expected.package}@${expected.version}`);
    }
    const variants = new Set();
    for (const copy of copies) {
      const bytes = await readFile(resolve(copy.root, expected.path));
      const digest = sha256(bytes);
      variants.add(`${bytes.length}:${digest}`);
      const text = bytes.toString('utf8');
      if (
        bytes.length !== expected.bytes ||
        digest !== expected.sha256 ||
        expected.requiredSubstrings.some((needle) => !text.includes(needle))
      ) {
        fail(
          `installed artifact differs: ${expected.package}@${expected.version}/${expected.path}`
        );
      }
    }
    if (variants.size !== 1) {
      fail(`peer variants disagree for ${expected.package}/${expected.path}`);
    }
    observations.push({
      package: expected.package,
      version: expected.version,
      path: expected.path,
      copies: copies.length,
      bytes: expected.bytes,
      sha256: expected.sha256,
      semanticAssertions: expected.requiredSubstrings.length,
    });
  }
  return observations;
}

async function boundedFetch(url, maxBytes) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
    fail(`refusing non-HTTPS evidence URL: ${url}`);
  }
  const response = await fetch(parsed, {
    redirect: 'error',
    signal: AbortSignal.timeout(30_000),
    headers: { 'user-agent': 'dsh-themes-rc2-final-certifier/1' },
  });
  if (!response.ok) fail(`evidence fetch returned ${response.status}: ${url}`);
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    fail(`evidence response exceeds byte limit: ${url}`);
  }
  const chunks = [];
  let total = 0;
  if (!response.body) fail(`evidence response has no body: ${url}`);
  for await (const chunk of response.body) {
    total += chunk.length;
    if (total > maxBytes) fail(`evidence response exceeds byte limit: ${url}`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export async function validatePinnedOfficialSources(contracts) {
  const observations = [];
  for (const expected of contracts.protocol.sourceFiles) {
    const url = `${contracts.protocol.officialRelease.rawBaseUrl}${expected.path}`;
    const bytes = await boundedFetch(url, MAX_SOURCE_BYTES);
    const text = bytes.toString('utf8');
    if (
      bytes.length !== expected.bytes ||
      sha256(bytes) !== expected.sha256 ||
      expected.requiredSubstrings.some((needle) => !text.includes(needle))
    ) {
      fail(`fixed upstream source differs: ${expected.path}`);
    }
    observations.push({
      surface: expected.surface,
      path: expected.path,
      bytes: expected.bytes,
      sha256: expected.sha256,
      semanticAssertions: expected.requiredSubstrings.length,
    });
  }
  return observations;
}

export async function validateOfficialTarballs(contracts) {
  const authority = await validateCandidateBaseline();
  const sidecar = JSON.parse(
    await readFile(
      resolve(skillDir, 'references/dsh-0.1.1-rc.2.candidate.json'),
      'utf8'
    )
  );
  const observations = [];
  for (const artifact of Object.values(sidecar.compatibility.npmArtifacts)) {
    if (
      artifact.version !== authority.dshVersion ||
      !SHA256.test(artifact.tarballSha256) ||
      !SHA1.test(artifact.shasum)
    ) {
      fail(`npm artifact authority is malformed for ${artifact.name}`);
    }
    const url = new URL(artifact.registryUrl);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'registry.npmjs.org' ||
      url.search ||
      url.hash ||
      url.username ||
      url.password
    ) {
      fail(`registry URL is outside the fixed npm authority: ${artifact.name}`);
    }
    const bytes = await boundedFetch(url, MAX_TARBALL_BYTES);
    if (
      sha256(bytes) !== artifact.tarballSha256 ||
      sha1(bytes) !== artifact.shasum
    ) {
      fail(`registry tarball digest differs for ${artifact.name}`);
    }
    observations.push({
      name: artifact.name,
      version: artifact.version,
      bytes: bytes.length,
      sha256: artifact.tarballSha256,
      shasum: artifact.shasum,
    });
  }
  return observations;
}

export async function validateFinalContractOffline() {
  const [candidate, contracts] = await Promise.all([
    validateCandidateBaseline(),
    loadFinalContracts(),
  ]);
  const installedArtifacts = await validateInstalledProtocolContract(contracts);
  return {
    status: 'final-infrastructure-ready-certification-pending',
    productionReady: false,
    baseline: EXPECTED_BASELINE,
    sourceCommit: EXPECTED_SOURCE_COMMIT,
    candidate: {
      sidecarSha256: candidate.sidecarSha256,
      pendingAttestationSha256: candidate.attestationSha256,
      pendingReceiptSha256: candidate.receiptSha256,
      lockfileSha256: candidate.lockfileSha256,
      productionPackages: candidate.packages,
      dshPackages: candidate.dshPackages,
    },
    protocolContractSha256: contracts.protocolSha256,
    selectorContractSha256: contracts.selectorSha256,
    selectorCatalogSha256: contracts.selector.sha256,
    installedArtifacts,
    completedMatrixJobs: 0,
    requiredMatrixJobs: EXPECTED_MATRIX.length,
  };
}
