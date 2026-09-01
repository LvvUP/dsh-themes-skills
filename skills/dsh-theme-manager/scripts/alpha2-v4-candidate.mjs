#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CURRENT_INSTALLABLE_HOSTED_ARTIFACTS,
  LEGACY_ROLLBACK_HOSTED_ARTIFACTS,
} from './hosted-artifact-authority.mjs';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const skillDir = resolve(scriptDir, '..');
const authorityPath = resolve(
  skillDir,
  'references/alpha2-v4-candidate-authority.json'
);

const SHA256 = /^[a-f0-9]{64}$/u;
const PUBLIC_ID = /^#([1-9][0-9]{3})$/u;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const HEX_COLOR = /^#[A-Fa-f0-9]{6}(?:[A-Fa-f0-9]{2})?$/u;
const EXACT_VERSION = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u;
const LOCAL_ASSET_SEGMENT =
  /^[A-Za-z0-9][A-Za-z0-9._~!$&'()*+,;=:@-]*$/u;
const UNSAFE_TEXT_CONTROL =
  /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u;
const LOCAL_ASSET_ROOTS = [
  'api/theme-studio',
  '__dsh-themes',
  'imgs',
  'theme-packages',
];
const EXPECTED_AUTHORITY_SHA256 =
  '5bda616b8ae9963fc64194b9e1ecf666eec3f93c82437b4db3677b7ad4776c92';

const TOKEN_NAMES = [
  '--dsw-alias-bg-base',
  '--dsw-alias-bg-layer-1',
  '--dsw-alias-bg-layer-2',
  '--dsw-alias-bg-overlay',
  '--dsw-alias-border-l1',
  '--dsw-alias-border-l2',
  '--dsw-alias-brand-primary',
  '--dsw-alias-label-primary',
  '--dsw-alias-label-secondary',
  '--dsw-alias-state-error-primary',
  '--dsw-alias-state-success-primary',
  '--dsw-alias-state-warn-primary',
  '--dsw-specific-sidebar-fill',
];

const EXPECTED_COMPATIBILITY = Object.freeze({
  dshPackageVersion: '0.1.2-alpha.2',
  source: {
    authoritySha256:
      '49919387e7c37a1759c1a13d581211b1efb3a105cb289497847e76e604e20c05',
    distribution: 'official-npm',
    officialArtifact: true,
    baselineId:
      'deepseek-harness/dsh-v0.1.2-alpha.2@0a53fb55bea101816fa226bb964ae2bed71c343b',
    tag: 'dsh-v0.1.2-alpha.2',
    commitSha1: '0a53fb55bea101816fa226bb964ae2bed71c343b',
    treeSha1: '64ccbfa8e0caa4711cd4a75717ef9e022657961b',
    sourceArchiveSha256:
      'b05eb8e4f654b1f6d97330decdcccf03ed30f7c292d3012f36fafff0ed505563',
    pnpmLockfileSha256:
      '6cc109a574218f51762474455c8d72e5f7c2625aedf25e85569dba1af7adcef0',
    npmPackage: '@deepseek-ai/dsh',
    npmVersion: '0.1.2-alpha.2',
    npmTarballSha256:
      '5bf062a26a490853ffb9294fe3c9fb2047f029be3545612dea45718a81920a47',
    npmIntegrity:
      'sha512-4TvTC5kRKlgtSU2UTBv+cID9a2Z+6+m6mpvjXWJfVzuTkflCff6s4MsQpFJTCmwFh/k7zNWe7qFXcLYMV/5VvA==',
  },
  profile: {
    contractSha256:
      '557e156f25dd9d9fc784f5fb196873ae64c00ddc1374cc877632668af4e9f039',
    profile: 'web',
    bundles: ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'],
    patchReload: 'live',
    pluginMutation: 'pnpm-profile',
    lifecycle: 'managed-cold-restart',
  },
  browserAuth: {
    contractSha256:
      '5fc95f3640b89e65f55807a68a4ae39137e6f2b8263c7ca7cdbb5b4dc5d518fd',
    launchToken: {
      queryParameter: 'token',
      pattern: '^[A-Za-z0-9_-]{43}$',
      persistence: 'process',
    },
    exchange: {
      method: 'GET',
      path: '/',
      status: 303,
      location: '/',
      referrerPolicy: 'no-referrer',
    },
    cookie: {
      httpOnly: true,
      sameSite: 'Strict',
      secure: false,
      authorityBound: true,
    },
    unauthenticatedStatus: 401,
    untrustedHostStatus: 403,
    evidencePolicy: 'redacted-no-token-cookie-or-derived-digest',
  },
  clientModules: {
    contractSha256:
      '11c520b06e1b3734434e73f8fa6832f6f205890d81a56419724ab2a05294e973',
    graphShape: 'entries+batches',
    comboRoute: '/plugins/??<resources>&rev=<revision>',
    maxComboUrlBytes: 3072,
    phases: ['bootstrap', 'application'],
    javascriptMimeType: 'text/javascript; charset=utf-8',
    sourceMapMimeType: 'application/json; charset=utf-8',
    cacheControl: 'public, max-age=31536000, immutable',
    revisionMismatchStatus: 404,
    compression: ['identity', 'gzip'],
    bootReadyGlobal: '__DSH_BOOT_READY__',
  },
  ui: {
    contractSha256:
      '07e1d4ba967727056a359fe87511ee8f25aac68cf0d1df6c612b5da2314a1e61',
    tokenCatalogSha256:
      'fe38fdb18dae76f3cc93e3ca3a37bb1916f207180781b1aa8321ee2ddadcb926',
    selectorCatalogSha256:
      '663aa5927591ac99076f924ee9cd6f9bd09e6a8a9ee1e6b8b1b0d9e3093df807',
    fontSizes: [12, 14, 17],
    styleOrder: [
      'base.css',
      'design-platform.css',
      'scrollbar.css',
      'gradient-shadow-text.css',
      'shiki.css',
    ],
  },
  certification: {
    status: 'pending',
    installability: 'none',
    builtArtifacts: null,
    runtimeReceipt: {
      status: 'pending',
      requiredJobs: 6,
      requiredPlatforms: ['darwin', 'linux', 'win32'],
      requiredNodeVersions: ['22.19.0', '24.15.0'],
      lifecycle: 'managed-cold-restart',
      secretEvidencePolicy: 'redacted-no-token-cookie-or-derived-digest',
      completedJobs: 0,
      receiptSha256: null,
      attestationSha256: null,
      sourceRuntimeArchiveSha256: null,
      entrypointSha256: null,
      jobs: [],
    },
  },
});

function fail(message) {
  throw new Error(`alpha.2 V4 candidate refused: ${message}`);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function plainObject(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value;
}

function exactKeys(value, keys, label) {
  const actual = Object.keys(plainObject(value, label)).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label} keys must be exactly ${expected.join(', ')}`);
  }
}

function allowedKeys(value, allowed, required, label) {
  const actual = Object.keys(plainObject(value, label));
  const unexpected = actual.filter((key) => !allowed.includes(key));
  const missing = required.filter((key) => !actual.includes(key));
  if (unexpected.length > 0 || missing.length > 0) {
    fail(
      `${label} has unexpected [${unexpected.join(', ')}] or missing [${missing.join(', ')}] keys`
    );
  }
}

function sameValue(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label} differs from the frozen alpha.2 V4 contract`);
  }
}

function safeText(value, label, maxLength = Number.POSITIVE_INFINITY) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > maxLength ||
    value.trim() !== value ||
    UNSAFE_TEXT_CONTROL.test(value)
  ) {
    fail(`${label} must be non-empty safe text`);
  }
  return value;
}

function strictHttpsUrl(value, label) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 2048 ||
    value.trim() !== value ||
    !/^https:\/\/[A-Za-z0-9]/u.test(value) ||
    /[\s\\]/u.test(value) ||
    value.includes('#')
  ) {
    fail(`${label} must be a credential-free HTTPS URL without a fragment`);
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${label} must be a credential-free HTTPS URL without a fragment`);
  }
  if (
    url.protocol !== 'https:' ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.hash
  ) {
    fail(`${label} must be a credential-free HTTPS URL without a fragment`);
  }
  return value;
}

function localAssetUrl(value, label) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > 2048 ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\?#%]/u.test(value)
  ) {
    fail(`${label} must be a safe local absolute URL`);
  }
  const root = LOCAL_ASSET_ROOTS.find((candidate) =>
    value.startsWith(`/${candidate}/`)
  );
  if (!root) fail(`${label} must be a safe local absolute URL`);
  const segments = value.slice(root.length + 2).split('/');
  if (
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === '.' ||
        segment === '..' ||
        !LOCAL_ASSET_SEGMENT.test(segment)
    )
  ) {
    fail(`${label} must be a safe local absolute URL`);
  }
  return value;
}

function integrityFor(digest) {
  return `sha256-${Buffer.from(digest, 'hex').toString('base64')}`;
}

function parseTuple(value, index) {
  if (typeof value !== 'string') fail(`candidate tuple ${index} must be text`);
  const fields = value.split('\t');
  if (fields.length !== 6) fail(`candidate tuple ${index} has the wrong field count`);
  const [publicId, kind, slug, version, artifactSha256, manifestSha256] = fields;
  if (
    !PUBLIC_ID.test(publicId) ||
    !['theme', 'full-skin'].includes(kind) ||
    !SLUG.test(slug) ||
    !EXACT_VERSION.test(version) ||
    !SHA256.test(artifactSha256) ||
    !SHA256.test(manifestSha256)
  ) {
    fail(`candidate tuple ${index} is malformed`);
  }
  return {
    publicId,
    catalogId: Number(PUBLIC_ID.exec(publicId)[1]),
    kind,
    slug,
    version,
    artifactSha256,
    manifestSha256,
  };
}

function validateHarnessProjection(authority, bytes) {
  if (sha256(bytes) !== authority.baseline.publicHarnessAuthoritySha256) {
    fail('public Harness authority digest changed');
  }
  const harness = JSON.parse(bytes.toString('utf8'));
  if (
    harness.release?.tag !== authority.baseline.officialSource.tag ||
    harness.release?.commit !== authority.baseline.officialSource.commitSha1 ||
    harness.release?.tree !== authority.baseline.officialSource.treeSha1 ||
    harness.source?.lockfileSha256 !==
      authority.baseline.officialSource.pnpmLockfileSha256 ||
    harness.officialNpm?.packageName !== authority.baseline.officialNpm.package ||
    harness.officialNpm?.version !== authority.baseline.officialNpm.version ||
    harness.officialNpm?.tarballSha256 !==
      authority.baseline.officialNpm.tarballSha256 ||
    harness.officialNpm?.distIntegrity !== authority.baseline.officialNpm.integrity
  ) {
    fail('public Harness authority differs from the Manager candidate projection');
  }
  if (
    harness.publication?.publishedInstallable !== false ||
    harness.publication?.completedReceipts?.length !== 0 ||
    harness.publication?.receiptSetSha256 !== null
  ) {
    fail('public Harness baseline has changed and needs an independent review');
  }
}

export function validateAlpha2V4CandidateAuthority(authority) {
  exactKeys(
    authority,
    [
      'schemaVersion',
      'authorityKind',
      'status',
      'installable',
      'promotionAllowed',
      'baseline',
      'candidateSet',
      'manifestContract',
      'releaseGate',
      'scope',
    ],
    'authority'
  );
  if (
    authority.schemaVersion !== 1 ||
    authority.authorityKind !== 'alpha2-v4-hosted-theme-candidate-set' ||
    authority.status !== 'candidate-pending' ||
    authority.installable !== false ||
    authority.promotionAllowed !== false
  ) {
    fail('authority status attempts to leave the pending lane');
  }

  exactKeys(
    authority.baseline,
    [
      'baselineId',
      'dshPackageVersion',
      'officialSource',
      'officialNpm',
      'publicHarnessAuthorityPath',
      'publicHarnessAuthoritySha256',
      'publisherV4SourceAuthoritySha256',
      'provenanceBoundary',
    ],
    'baseline'
  );
  exactKeys(
    authority.baseline.officialSource,
    [
      'tag',
      'commitSha1',
      'treeSha1',
      'sourceArchiveSha256',
      'pnpmLockfileSha256',
    ],
    'baseline.officialSource'
  );
  exactKeys(
    authority.baseline.officialNpm,
    ['package', 'version', 'tarballSha256', 'integrity'],
    'baseline.officialNpm'
  );
  exactKeys(
    authority.baseline.provenanceBoundary,
    [
      'officialNpmRuntimeTarget',
      'sourceCrossBuildIndependent',
      'sourceCrossBuildIsRuntimeReceipt',
      'binarySourceEquivalenceClaimed',
    ],
    'baseline.provenanceBoundary'
  );
  if (
    authority.baseline.baselineId !== EXPECTED_COMPATIBILITY.source.baselineId ||
    authority.baseline.dshPackageVersion !== '0.1.2-alpha.2' ||
    authority.baseline.officialSource.tag !== EXPECTED_COMPATIBILITY.source.tag ||
    authority.baseline.officialSource.commitSha1 !==
      EXPECTED_COMPATIBILITY.source.commitSha1 ||
    authority.baseline.officialSource.treeSha1 !==
      EXPECTED_COMPATIBILITY.source.treeSha1 ||
    authority.baseline.officialSource.sourceArchiveSha256 !==
      EXPECTED_COMPATIBILITY.source.sourceArchiveSha256 ||
    authority.baseline.officialSource.pnpmLockfileSha256 !==
      EXPECTED_COMPATIBILITY.source.pnpmLockfileSha256 ||
    authority.baseline.officialNpm.package !== '@deepseek-ai/dsh' ||
    authority.baseline.officialNpm.version !== '0.1.2-alpha.2' ||
    authority.baseline.officialNpm.tarballSha256 !==
      EXPECTED_COMPATIBILITY.source.npmTarballSha256 ||
    authority.baseline.officialNpm.integrity !==
      EXPECTED_COMPATIBILITY.source.npmIntegrity ||
    authority.baseline.publicHarnessAuthorityPath !==
      '../dsh-harness-installer/references/alpha2-release-authority.json' ||
    authority.baseline.publicHarnessAuthoritySha256 !==
      'f8be99bda583c2b8b1458746eaf07fe64c5a846348cbe0fffc1d4ff699211e11' ||
    authority.baseline.publisherV4SourceAuthoritySha256 !==
      EXPECTED_COMPATIBILITY.source.authoritySha256 ||
    JSON.stringify(authority.baseline.provenanceBoundary) !==
      JSON.stringify({
        officialNpmRuntimeTarget: true,
        sourceCrossBuildIndependent: true,
        sourceCrossBuildIsRuntimeReceipt: false,
        binarySourceEquivalenceClaimed: false,
      })
  ) {
    fail('baseline or provenance boundary differs from alpha.2');
  }

  exactKeys(
    authority.candidateSet,
    ['counts', 'canonicalAlgorithm', 'tupleSetSha256', 'tuples'],
    'candidateSet'
  );
  exactKeys(
    authority.candidateSet.counts,
    [
      'themes',
      'fullSkins',
      'total',
      'version2Candidates',
      'version1NewOrUpgradedSkins',
    ],
    'candidateSet.counts'
  );
  sameValue(
    authority.candidateSet.counts,
    {
      themes: 6,
      fullSkins: 48,
      total: 54,
      version2Candidates: 45,
      version1NewOrUpgradedSkins: 9,
    },
    'candidateSet.counts'
  );
  if (
    authority.candidateSet.canonicalAlgorithm !==
      'public-id-tab-kind-tab-slug-tab-version-tab-artifact-sha256-tab-manifest-sha256-lf' ||
    authority.candidateSet.tupleSetSha256 !==
      'e5bc3aec7191f1f9958d35dd5a7caec5a0d01e628e7737bcfa5a72cddb0b06cf' ||
    !Array.isArray(authority.candidateSet.tuples) ||
    authority.candidateSet.tuples.length !== 54 ||
    sha256(`${authority.candidateSet.tuples.join('\n')}\n`) !==
      authority.candidateSet.tupleSetSha256
  ) {
    fail('candidate tuple closure differs from the frozen 54-item set');
  }
  const candidates = authority.candidateSet.tuples.map(parseTuple);
  const uniqueFields = [
    ['publicId', new Set(candidates.map((entry) => entry.publicId))],
    ['slug', new Set(candidates.map((entry) => entry.slug))],
    ['artifactSha256', new Set(candidates.map((entry) => entry.artifactSha256))],
    ['manifestSha256', new Set(candidates.map((entry) => entry.manifestSha256))],
  ];
  for (const [label, values] of uniqueFields) {
    if (values.size !== candidates.length) fail(`candidate ${label} values are not unique`);
  }
  if (
    candidates.filter((entry) => entry.kind === 'theme').length !== 6 ||
    candidates.filter((entry) => entry.kind === 'full-skin').length !== 48 ||
    candidates.filter((entry) => entry.version === '2.0.0').length !== 45 ||
    candidates.filter((entry) => entry.version === '1.0.0').length !== 9 ||
    candidates.some((entry) => !['1.0.0', '2.0.0'].includes(entry.version)) ||
    candidates.some((entry) => entry.catalogId === 2042)
  ) {
    fail('candidate kind, version, or public-ID cohort differs');
  }
  const executableDigests = new Set([
    ...CURRENT_INSTALLABLE_HOSTED_ARTIFACTS.values(),
    ...LEGACY_ROLLBACK_HOSTED_ARTIFACTS.values(),
  ]);
  if (candidates.some((entry) => executableDigests.has(entry.artifactSha256))) {
    fail('candidate bytes collide with current or rollback executable authority');
  }

  exactKeys(authority.manifestContract, ['schemaVersion', 'compatibility'], 'manifestContract');
  if (authority.manifestContract.schemaVersion !== '4.0') {
    fail('manifest contract is not V4');
  }
  sameValue(
    authority.manifestContract.compatibility,
    EXPECTED_COMPATIBILITY,
    'manifestContract.compatibility'
  );

  exactKeys(
    authority.releaseGate,
    [
      'requiredJobs',
      'completedJobs',
      'requiredPlatforms',
      'requiredNodeVersions',
      'runtimeReceiptSetSha256',
      'promotionReceiptSha256',
      'blockers',
    ],
    'releaseGate'
  );
  if (
    authority.releaseGate.requiredJobs !== 6 ||
    authority.releaseGate.completedJobs !== 0 ||
    JSON.stringify(authority.releaseGate.requiredPlatforms) !==
      JSON.stringify(['darwin-arm64', 'linux-x64', 'win32-x64']) ||
    JSON.stringify(authority.releaseGate.requiredNodeVersions) !==
      JSON.stringify(['22.19.0', '24.15.0']) ||
    authority.releaseGate.runtimeReceiptSetSha256 !== null ||
    authority.releaseGate.promotionReceiptSha256 !== null ||
    !Array.isArray(authority.releaseGate.blockers) ||
    authority.releaseGate.blockers.length < 2
  ) {
    fail('release gate contains fabricated or incomplete evidence');
  }
  exactKeys(
    authority.scope,
    [
      'profile',
      'managesPlugins',
      'managesCommunitySkins',
      'rc8V3OperationalAuthorityUnchanged',
      'legacyRollbackAuthorityUnchanged',
    ],
    'scope'
  );
  if (
    authority.scope.profile !== 'web' ||
    authority.scope.managesPlugins !== false ||
    authority.scope.managesCommunitySkins !== false ||
    authority.scope.rc8V3OperationalAuthorityUnchanged !== true ||
    authority.scope.legacyRollbackAuthorityUnchanged !== true
  ) {
    fail('candidate scope widens Manager or changes historical authority');
  }
  return { authority, candidates };
}

export async function loadAlpha2V4CandidateAuthority() {
  const bytes = await readFile(authorityPath);
  if (sha256(bytes) !== EXPECTED_AUTHORITY_SHA256) {
    fail('candidate authority digest changed');
  }
  const result = validateAlpha2V4CandidateAuthority(
    JSON.parse(bytes.toString('utf8'))
  );
  const harnessPath = resolve(
    skillDir,
    result.authority.baseline.publicHarnessAuthorityPath
  );
  validateHarnessProjection(result.authority, await readFile(harnessPath));
  return { ...result, authorityBytes: bytes, authoritySha256: sha256(bytes) };
}

function validateTokens(tokens) {
  exactKeys(tokens, TOKEN_NAMES, 'manifest.tokens');
  for (const name of TOKEN_NAMES) {
    exactKeys(tokens[name], ['light', 'dark'], `manifest.tokens.${name}`);
    if (!HEX_COLOR.test(tokens[name].light) || !HEX_COLOR.test(tokens[name].dark)) {
      fail(`manifest.tokens.${name} must contain light and dark hex colors`);
    }
  }
}

function validatePreview(manifest) {
  if (manifest.kind === 'theme') {
    allowedKeys(
      manifest.preview,
      ['light', 'dark', 'surface'],
      ['light', 'dark'],
      'manifest.preview'
    );
    for (const mode of ['light', 'dark']) {
      localAssetUrl(manifest.preview[mode], `manifest.preview.${mode}`);
    }
    if ('surface' in manifest.preview) {
      safeText(manifest.preview.surface, 'manifest.preview.surface', 120);
    }
    return;
  }
  exactKeys(manifest.preview, ['light', 'dark'], 'manifest.preview');
  for (const mode of ['light', 'dark']) {
    const preview = manifest.preview[mode];
    exactKeys(
      preview,
      ['url', 'sha256', 'width', 'height', 'source'],
      `manifest.preview.${mode}`
    );
    localAssetUrl(preview.url, `manifest.preview.${mode}.url`);
    if (
      !SHA256.test(preview.sha256) ||
      !Number.isInteger(preview.width) ||
      preview.width < 1 ||
      !Number.isInteger(preview.height) ||
      preview.height < 1 ||
      !['simulated', 'runtime'].includes(preview.source)
    ) {
      fail(`manifest.preview.${mode} is malformed`);
    }
  }
}

function validateFullSkinFields(manifest) {
  allowedKeys(
    manifest.copyright,
    ['source', 'sourceUrl', 'attribution', 'aiGenerated'],
    ['source', 'aiGenerated'],
    'manifest.copyright'
  );
  if (
    !['original', 'user-owned', 'licensed', 'public-domain', 'generated'].includes(
      manifest.copyright.source
    ) ||
    typeof manifest.copyright.aiGenerated !== 'boolean'
  ) {
    fail('manifest.copyright is malformed');
  }
  if ('sourceUrl' in manifest.copyright) {
    strictHttpsUrl(
      manifest.copyright.sourceUrl,
      'manifest.copyright.sourceUrl'
    );
  }
  if ('attribution' in manifest.copyright) {
    safeText(
      manifest.copyright.attribution,
      'manifest.copyright.attribution'
    );
  }
  if (
    manifest.copyright.source === 'licensed' &&
    !('sourceUrl' in manifest.copyright) &&
    !('attribution' in manifest.copyright)
  ) {
    fail('licensed artwork requires a source URL or attribution');
  }
  if (
    manifest.copyright.source === 'generated' &&
    manifest.copyright.aiGenerated !== true
  ) {
    fail('generated artwork must declare aiGenerated');
  }
  exactKeys(
    manifest.visual,
    [
      'preset',
      'focus',
      'surfaceOpacity',
      'overlayOpacity',
      'borderStrength',
      'glowStrength',
    ],
    'manifest.visual'
  );
  exactKeys(manifest.visual.focus, ['x', 'y'], 'manifest.visual.focus');
  if (
    !['glass', 'outline', 'glow'].includes(manifest.visual.preset) ||
    !Number.isInteger(manifest.visual.focus.x) ||
    manifest.visual.focus.x < 0 ||
    manifest.visual.focus.x > 100 ||
    !Number.isInteger(manifest.visual.focus.y) ||
    manifest.visual.focus.y < 0 ||
    manifest.visual.focus.y > 100 ||
    ['surfaceOpacity', 'overlayOpacity', 'borderStrength', 'glowStrength'].some(
      (key) =>
        typeof manifest.visual[key] !== 'number' ||
        manifest.visual[key] < 0 ||
        manifest.visual[key] > 1
    )
  ) {
    fail('manifest.visual is malformed');
  }
  if (!Array.isArray(manifest.assets) || manifest.assets.length !== 5) {
    fail('full-skin manifest must contain five exact asset roles');
  }
  const roles = [];
  for (const [index, asset] of manifest.assets.entries()) {
    exactKeys(
      asset,
      ['role', 'path', 'url', 'sha256', 'mimeType', 'sizeBytes', 'width', 'height'],
      `manifest.assets[${index}]`
    );
    roles.push(asset.role);
    localAssetUrl(asset.url, `manifest.assets[${index}].url`);
    if (
      typeof asset.path !== 'string' ||
      !new RegExp(`^assets/${asset.sha256}\\.webp$`, 'u').test(asset.path) ||
      !SHA256.test(asset.sha256) ||
      asset.mimeType !== 'image/webp' ||
      !Number.isInteger(asset.sizeBytes) ||
      asset.sizeBytes < 1 ||
      !Number.isInteger(asset.width) ||
      asset.width < 1 ||
      !Number.isInteger(asset.height) ||
      asset.height < 1
    ) {
      fail(`manifest.assets[${index}] is malformed`);
    }
  }
  sameValue(
    [...roles].sort(),
    ['background', 'card', 'preview-dark', 'preview-light', 'sidebar'],
    'manifest asset roles'
  );
  for (const mode of ['light', 'dark']) {
    const asset = manifest.assets.find(
      (entry) => entry.role === `preview-${mode}`
    );
    sameValue(
      {
        url: manifest.preview[mode].url,
        sha256: manifest.preview[mode].sha256,
        width: manifest.preview[mode].width,
        height: manifest.preview[mode].height,
      },
      {
        url: asset.url,
        sha256: asset.sha256,
        width: asset.width,
        height: asset.height,
      },
      `manifest.preview.${mode} asset binding`
    );
  }
}

export function validateAlpha2V4Manifest(manifest, loaded) {
  const { authority } = loaded;
  const { candidates } = validateAlpha2V4CandidateAuthority(authority);
  allowedKeys(
    manifest,
    [
      'schemaVersion',
      'kind',
      'slug',
      'name',
      'description',
      'category',
      'author',
      'license',
      'version',
      'compatibility',
      'tokens',
      'preview',
      'copyright',
      'visual',
      'assets',
      'artifact',
      'payload',
    ],
    [
      'schemaVersion',
      'kind',
      'slug',
      'name',
      'description',
      'author',
      'license',
      'version',
      'compatibility',
      'tokens',
      'preview',
      'artifact',
      'payload',
    ],
    'manifest'
  );
  if (
    manifest.schemaVersion !== '4.0' ||
    !['theme', 'full-skin'].includes(manifest.kind) ||
    !SLUG.test(manifest.slug) ||
    !EXACT_VERSION.test(manifest.version)
  ) {
    fail('manifest is not an exact V4 theme or full-skin');
  }
  const candidate = candidates.find((entry) => entry.slug === manifest.slug);
  if (
    !candidate ||
    candidate.kind !== manifest.kind ||
    candidate.version !== manifest.version
  ) {
    fail('manifest identity is not in the frozen 54-item candidate set');
  }
  sameValue(
    manifest.compatibility,
    authority.manifestContract.compatibility,
    'manifest.compatibility'
  );
  allowedKeys(manifest.author, ['name', 'url'], ['name'], 'manifest.author');
  if ('category' in manifest) {
    safeText(manifest.category, 'manifest.category', 120);
  }
  if ('url' in manifest.author) {
    strictHttpsUrl(manifest.author.url, 'manifest.author.url');
  }
  if (
    typeof manifest.name !== 'string' ||
    manifest.name.length === 0 ||
    typeof manifest.description !== 'string' ||
    manifest.description.length === 0 ||
    typeof manifest.author.name !== 'string' ||
    manifest.author.name.length === 0 ||
    typeof manifest.license !== 'string' ||
    manifest.license.length === 0
  ) {
    fail('manifest descriptive identity is incomplete');
  }
  validateTokens(manifest.tokens);
  validatePreview(manifest);

  exactKeys(
    manifest.artifact,
    ['name', 'version', 'fileName', 'sha256', 'integrity', 'digestScope'],
    'manifest.artifact'
  );
  if (
    manifest.artifact.name !== `@dsh-themes/${manifest.slug}` ||
    manifest.artifact.version !== manifest.version ||
    manifest.artifact.fileName !== `${manifest.slug}-${manifest.version}.tgz` ||
    manifest.artifact.sha256 !== candidate.artifactSha256 ||
    manifest.artifact.integrity !== integrityFor(candidate.artifactSha256) ||
    manifest.artifact.digestScope !== 'artifact-tgz'
  ) {
    fail('manifest artifact differs from the frozen candidate bytes');
  }
  exactKeys(
    manifest.payload,
    ['fileName', 'sha256', 'integrity', 'digestScope'],
    'manifest.payload'
  );
  if (
    manifest.payload.fileName !==
      `${manifest.slug}-${manifest.version}.payload.tar` ||
    !SHA256.test(manifest.payload.sha256) ||
    manifest.payload.integrity !== integrityFor(manifest.payload.sha256) ||
    manifest.payload.digestScope !==
      'canonical-tar-payload-excluding-manifest'
  ) {
    fail('manifest payload is malformed');
  }

  if (manifest.kind === 'theme') {
    if (
      'copyright' in manifest ||
      'visual' in manifest ||
      'assets' in manifest
    ) {
      fail('token themes cannot claim full-skin visual fields');
    }
  } else {
    for (const key of ['copyright', 'visual', 'assets']) {
      if (!(key in manifest)) fail(`full-skin manifest is missing ${key}`);
    }
    validateFullSkinFields(manifest);
  }
  return {
    status: 'candidate-manifest-validated-not-installable',
    installable: false,
    promotionAllowed: false,
    publicId: candidate.publicId,
    slug: candidate.slug,
    version: candidate.version,
    artifactSha256: candidate.artifactSha256,
    expectedManifestSha256: candidate.manifestSha256,
  };
}

export function validateAlpha2V4ManifestBytes(bytes, loaded) {
  const manifest = JSON.parse(bytes.toString('utf8'));
  const result = validateAlpha2V4Manifest(manifest, loaded);
  if (sha256(bytes) !== result.expectedManifestSha256) {
    fail('manifest bytes differ from the frozen candidate digest');
  }
  return result;
}

function parseArgs(argv) {
  if (argv.length === 0 || (argv.length === 1 && argv[0] === 'inspect')) {
    return { command: 'inspect' };
  }
  if (
    argv.length === 3 &&
    argv[0] === 'validate-manifest' &&
    argv[1] === '--input'
  ) {
    return { command: 'validate-manifest', input: resolve(argv[2]) };
  }
  fail(
    'only inspect or validate-manifest --input <absolute-or-relative-path> is allowed; installation and promotion are disabled'
  );
}

async function main(argv) {
  const options = parseArgs(argv);
  const loaded = await loadAlpha2V4CandidateAuthority();
  if (options.command === 'validate-manifest') {
    return validateAlpha2V4ManifestBytes(await readFile(options.input), loaded);
  }
  return {
    status: loaded.authority.status,
    installable: false,
    promotionAllowed: false,
    baselineId: loaded.authority.baseline.baselineId,
    authoritySha256: loaded.authoritySha256,
    candidateCount: loaded.candidates.length,
    themeCount: loaded.candidates.filter((entry) => entry.kind === 'theme').length,
    fullSkinCount: loaded.candidates.filter(
      (entry) => entry.kind === 'full-skin'
    ).length,
    completedJobs: loaded.authority.releaseGate.completedJobs,
    requiredJobs: loaded.authority.releaseGate.requiredJobs,
    blockers: loaded.authority.releaseGate.blockers,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(await main(process.argv.slice(2)))}\n`);
}
