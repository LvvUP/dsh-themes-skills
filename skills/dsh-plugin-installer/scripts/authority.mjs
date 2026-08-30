#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import { validateTop10ReleaseSet } from './top10-authority.mjs';

const authorityUrl = new URL('../references/plugin-authority.json', import.meta.url);
const schemaUrl = new URL('../references/plugin-authority.schema.json', import.meta.url);
const harnessAuthorityUrl = new URL('../../dsh-harness-installer/references/alpha1-source-authority.json', import.meta.url);
const top10ReleaseSetUrl = new URL('../references/top10-release-set.json', import.meta.url);

const SHA40 = /^[a-f0-9]{40}$/;
const SHA64 = /^[a-f0-9]{64}$/;
const PACKAGE = /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SAFE_ENTRY_ID = /^[A-Za-z0-9][A-Za-z0-9._\/-]{0,127}$/;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const SAFE_TEXT = /^[^\u0000-\u001f\u007f]{1,160}$/u;
const SAFE_LIFECYCLE_TEXT = /^[^\u0000-\u001f\u007f]{1,200}$/u;
const DISTRIBUTIONS = ['hosted-plugin-verified', 'upstream-plugin-verified'];
export const LIFECYCLE_HOOKS = [
  'prepublish', 'prepare', 'prepublishOnly', 'prepack', 'postpack', 'dependencies',
  'preinstall', 'install', 'postinstall', 'preversion', 'version', 'postversion',
  'prestart', 'start', 'poststart', 'prestop', 'stop', 'poststop',
  'prerestart', 'restart', 'postrestart',
];
const TRANSITIVE_LIFECYCLE_RISK = 'pnpm-may-run-transitive-dependency-lifecycle-scripts';

function fail(message) {
  throw new Error(message);
}

function object(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  return value;
}

function exactKeys(value, keys, label) {
  const actual = Object.keys(object(value, label)).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail(`${label} keys must be exactly ${expected.join(', ')}`);
  }
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function integrity(sha) {
  return `sha256-${Buffer.from(sha, 'hex').toString('base64')}`;
}

function validSha512Integrity(value) {
  if (typeof value !== 'string' || !value.startsWith('sha512-')) return false;
  try {
    const encoded = value.slice('sha512-'.length);
    const bytes = Buffer.from(encoded, 'base64');
    return bytes.length === 64 && bytes.toString('base64') === encoded;
  } catch {
    return false;
  }
}

function safeHttpsUrl(value, label, expectedOrigin = null) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 500 ||
      /[\u0000-\u001f\u007f]/u.test(value)) fail(`${label} must be bounded single-line text`);
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(`${label} is not a valid URL`);
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      (expectedOrigin && url.origin !== expectedOrigin)) fail(`${label} must be fixed credential-free HTTPS`);
  return url;
}

export function lifecycleHooksFromManifest(manifest) {
  const scripts = object(manifest?.scripts ?? {}, 'package scripts');
  return Object.fromEntries(LIFECYCLE_HOOKS.map((hook) => {
    const value = Object.hasOwn(scripts, hook) ? scripts[hook] : null;
    if (value !== null && (typeof value !== 'string' || !SAFE_LIFECYCLE_TEXT.test(value))) {
      fail(`package lifecycle hook ${hook} must be bounded single-line text`);
    }
    return [hook, value];
  }));
}

export function lifecycleHooksSha256(hooks) {
  exactKeys(hooks, LIFECYCLE_HOOKS, 'package.lifecycle.hooks');
  return sha256(Buffer.from(`${JSON.stringify(hooks)}\n`, 'utf8'));
}

function validateHostedEvidence(evidence, label) {
  exactKeys(evidence, ['path', 'sha256'], label);
  safeRelativePath(evidence.path, `${label}.path`, { file: true });
  if (!SHA64.test(evidence.sha256)) fail(`${label}.sha256 is malformed`);
}

function safeRelativePath(value, label, { file = false } = {}) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 240 ||
      value.startsWith('/') || value.startsWith('\\') || value.includes('\\') ||
      value.split('/').some((part) => part === '' || part === '.' || part === '..')) {
    fail(`${label} must be a safe relative POSIX path`);
  }
  if (file && value.endsWith('/')) fail(`${label} must name a file`);
}

export function normalizeBundlePatch(value, label = 'package bundle patch') {
  const normalized = typeof value === 'string' && value.startsWith('./')
    ? value.slice(2)
    : value;
  safeRelativePath(normalized, label, { file: true });
  if (!/\.ya?ml$/u.test(normalized)) fail(`${label} must be a YAML file`);
  return normalized;
}

export function normalizeCatalogId(input) {
  if (typeof input === 'number' && Number.isSafeInteger(input) && input >= 3000 && input <= 3999) return input;
  if (typeof input === 'string' && /^#[3]\d{3}$/.test(input)) return Number(input.slice(1));
  fail('plugin selection must be an exact #3NNN public ID');
}

export function assertSafeInstallSpec(item) {
  const distribution = item.distribution;
  if (distribution.kind === 'hosted-plugin-verified') return;
  const source = distribution.source;
  if (source.type === 'npm-package-version') {
    if (source.installSpec !== `${item.package.name}@${item.package.version}` ||
        /(?:^|@)(?:latest|next|beta|canary)$/iu.test(source.installSpec)) {
      fail(`plugin #${item.catalogId} has an unsafe or non-canonical npm install spec`);
    }
    return;
  }
  if (source.type === 'github-release-asset') return;
  const expected = `git+${source.repository}#${source.commit}`;
  if (source.installSpec !== expected ||
      !/^git\+https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git#[a-f0-9]{40}$/.test(expected)) {
    fail(`plugin #${item.catalogId} has an unsafe or non-canonical install spec`);
  }
}

export function validateItem(item, index = 0) {
  const label = `items[${index}]`;
  exactKeys(item, [
    'catalogId', 'slug', 'title', 'status', 'profile', 'distribution', 'package',
    'runtimeAcceptance', 'safety', 'rights', 'rollback', 'receipts',
  ], label);
  normalizeCatalogId(item.catalogId);
  if (!SLUG.test(item.slug)) fail(`${label}.slug is malformed`);
  if (!SAFE_TEXT.test(item.title) || item.title.length > 100) fail(`${label}.title is malformed`);
  if (item.status !== 'verified-installable' || item.profile !== 'web') fail(`${label} is not a verified web-profile item`);

  if (item.distribution?.kind === 'hosted-plugin-verified') {
    exactKeys(item.distribution, [
      'kind', 'assetName', 'artifactUrl', 'artifactBytes', 'artifactSha256',
      'artifactIntegrity', 'manifestSha256', 'licenseFile', 'sbom',
    ], `${label}.distribution`);
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}\.tgz$/.test(item.distribution.assetName)) {
      fail(`${label} hosted release asset name is malformed`);
    }
    const expectedUrl = `https://github.com/LvvUP/dsh-themes-skills/releases/download/v0.8.0/${item.distribution.assetName}`;
    if (item.distribution.artifactUrl !== expectedUrl) {
      fail(`${label} hosted artifact must use the fixed LvvUP/dsh-themes-skills v0.8.0 Release coordinate`);
    }
    if (!Number.isSafeInteger(item.distribution.artifactBytes) || item.distribution.artifactBytes < 1 ||
        item.distribution.artifactBytes > 256 * 1024 * 1024) fail(`${label} artifact byte count is invalid`);
    if (!SHA64.test(item.distribution.artifactSha256) ||
        item.distribution.artifactIntegrity !== integrity(item.distribution.artifactSha256) ||
        !SHA64.test(item.distribution.manifestSha256)) {
      fail(`${label} artifact digest or integrity mismatch`);
    }
    validateHostedEvidence(item.distribution.licenseFile, `${label}.distribution.licenseFile`);
    exactKeys(item.distribution.sbom, ['format', 'path', 'sha256'], `${label}.distribution.sbom`);
    if (item.distribution.sbom.format !== 'cyclonedx-json') fail(`${label} hosted SBOM format mismatch`);
    safeRelativePath(item.distribution.sbom.path, `${label}.distribution.sbom.path`, { file: true });
    if (!SHA64.test(item.distribution.sbom.sha256)) fail(`${label}.distribution.sbom.sha256 is malformed`);
    if (new Set([
      item.package?.bundlePatch,
      item.distribution.licenseFile.path,
      item.distribution.sbom.path,
    ]).size !== 3) fail(`${label} hosted patch, license, and SBOM paths must be distinct`);
  } else if (item.distribution?.kind === 'upstream-plugin-verified') {
    exactKeys(item.distribution, ['kind', 'source'], `${label}.distribution`);
    const source = object(item.distribution.source, `${label}.distribution.source`);
    if (source.type === 'npm-package-version') {
      exactKeys(source, [
        'type', 'registry', 'packageName', 'version', 'installSpec', 'metadataSha256',
        'tarballUrl', 'tarballBytes', 'tarballSha256', 'distIntegrity',
      ], `${label}.distribution.source`);
      const tarball = safeHttpsUrl(source.tarballUrl, `${label} npm tarball URL`, 'https://registry.npmjs.org');
      if (source.registry !== 'https://registry.npmjs.org' || source.packageName !== item.package?.name ||
          source.version !== item.package?.version || source.installSpec !== `${source.packageName}@${source.version}` ||
          !tarball.pathname.endsWith('.tgz') || !Number.isSafeInteger(source.tarballBytes) ||
          source.tarballBytes < 1 || source.tarballBytes > 256 * 1024 * 1024 ||
          !SHA64.test(source.metadataSha256) || !SHA64.test(source.tarballSha256) ||
          !validSha512Integrity(source.distIntegrity)) fail(`${label} exact npm source is malformed`);
    } else if (source.type === 'github-release-asset') {
      exactKeys(source, [
        'type', 'repository', 'tag', 'assetName', 'assetUrl', 'assetBytes',
        'assetSha256', 'assetIntegrity', 'manifestSha256',
      ], `${label}.distribution.source`);
      const repository = safeHttpsUrl(source.repository, `${label} GitHub Release repository`, 'https://github.com');
      const asset = safeHttpsUrl(source.assetUrl, `${label} GitHub Release asset`, 'https://github.com');
      const expectedAsset = `${repository.href.replace(/\/$/u, '')}/releases/download/${source.tag}/${source.assetName}`;
      if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(source.repository) ||
          !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(source.tag) || /latest/iu.test(source.tag) ||
          !/^[A-Za-z0-9][A-Za-z0-9._-]{0,159}\.tgz$/.test(source.assetName) ||
          asset.href !== expectedAsset || !Number.isSafeInteger(source.assetBytes) ||
          source.assetBytes < 1 || source.assetBytes > 256 * 1024 * 1024 ||
          !SHA64.test(source.assetSha256) || source.assetIntegrity !== integrity(source.assetSha256) ||
          !SHA64.test(source.manifestSha256)) fail(`${label} exact GitHub Release source is malformed`);
    } else if (source.type === 'git-commit') {
      exactKeys(source, [
        'type', 'repository', 'commit', 'tree', 'subdir', 'installSpec',
        'manifestSha256', 'lockfilePath', 'lockfileSha256',
      ], `${label}.distribution.source`);
      safeHttpsUrl(source.repository, `${label} Git repository`, 'https://github.com');
      if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git$/.test(source.repository) ||
          !SHA40.test(source.commit) || !SHA40.test(source.tree) || !SHA64.test(source.manifestSha256) ||
          !['pnpm-lock.yaml', 'package-lock.json', 'yarn.lock', 'npm-shrinkwrap.json'].includes(source.lockfilePath) ||
          !SHA64.test(source.lockfileSha256) || source.subdir !== '.') {
        fail(`${label} exact Git commit source is malformed`);
      }
    } else {
      fail(`${label} upstream source type is unsupported`);
    }
  } else {
    fail(`${label} has an unsupported distribution kind`);
  }

  exactKeys(item.package, [
    'name', 'version', 'bundlePatch', 'lifecycle', 'lifecycleAuthorization',
  ], `${label}.package`);
  if (!PACKAGE.test(item.package.name) || !SEMVER.test(item.package.version)) fail(`${label} package identity is malformed`);
  if (
    normalizeBundlePatch(item.package.bundlePatch, `${label}.package.bundlePatch`) !==
    item.package.bundlePatch
  ) {
    fail(`${label}.package.bundlePatch must use canonical relative form without ./`);
  }
  exactKeys(item.package.lifecycle, [
    'hooks', 'hooksSha256', 'transitiveDependencyRisk',
  ], `${label}.package.lifecycle`);
  const lifecycle = lifecycleHooksFromManifest({ scripts: item.package.lifecycle.hooks });
  if (JSON.stringify(lifecycle) !== JSON.stringify(item.package.lifecycle.hooks) ||
      lifecycleHooksSha256(lifecycle) !== item.package.lifecycle.hooksSha256) {
    fail(`${label} lifecycle hook map or digest mismatch`);
  }
  if (item.package.lifecycle.transitiveDependencyRisk !== TRANSITIVE_LIFECYCLE_RISK) {
    fail(`${label} must disclose transitive dependency lifecycle risk`);
  }
  const executableHooks = LIFECYCLE_HOOKS.filter((hook) => lifecycle[hook] !== null);
  const authorization = item.package.lifecycleAuthorization;
  exactKeys(authorization, [
    'required', 'packageKey', 'authorizedHooks', 'hooksSha256',
  ], `${label}.package.lifecycleAuthorization`);
  if (!Array.isArray(authorization.authorizedHooks) ||
      JSON.stringify(authorization.authorizedHooks) !== JSON.stringify(executableHooks)) {
    fail(`${label} lifecycle authorization must enumerate every declared hook in standard order`);
  }
  if (executableHooks.length > 0) {
    if (item.distribution.kind !== 'upstream-plugin-verified' || authorization.required !== true ||
        authorization.packageKey !== item.package.name ||
        authorization.hooksSha256 !== item.package.lifecycle.hooksSha256) {
      fail(`${label} lifecycle authorization is incomplete or has the wrong digest`);
    }
  } else if (authorization.required !== false || authorization.packageKey !== null ||
      authorization.hooksSha256 !== null) {
    fail(`${label} package without lifecycle hooks must use explicit null authorization fields`);
  }
  if (item.distribution.kind === 'hosted-plugin-verified' &&
      Object.values(lifecycle).some((value) => value !== null)) {
    fail(`${label} hosted artifacts cannot contain lifecycle hooks`);
  }

  exactKeys(item.runtimeAcceptance, [
    'schemaVersion', 'dumpConfig', 'functionalProbe',
  ], `${label}.runtimeAcceptance`);
  if (item.runtimeAcceptance.schemaVersion !== 1) {
    fail(`${label}.runtimeAcceptance.schemaVersion must be 1`);
  }
  exactKeys(item.runtimeAcceptance.dumpConfig, [
    'kind', 'entryId', 'packageName', 'occurrence',
  ], `${label}.runtimeAcceptance.dumpConfig`);
  if (item.runtimeAcceptance.dumpConfig.kind !== 'exact-cordis-entry' ||
      !SAFE_ENTRY_ID.test(item.runtimeAcceptance.dumpConfig.entryId) ||
      item.runtimeAcceptance.dumpConfig.packageName !== item.package.name ||
      item.runtimeAcceptance.dumpConfig.occurrence !== 'exactly-one') {
    fail(`${label} dump-config acceptance contract is malformed or does not match the package`);
  }
  exactKeys(item.runtimeAcceptance.functionalProbe, [
    'kind', 'packageName', 'version', 'unauthenticatedRootStatus',
  ], `${label}.runtimeAcceptance.functionalProbe`);
  if (item.runtimeAcceptance.functionalProbe.kind !== 'cold-web-start-with-plugin-inventory' ||
      item.runtimeAcceptance.functionalProbe.packageName !== item.package.name ||
      item.runtimeAcceptance.functionalProbe.version !== item.package.version ||
      item.runtimeAcceptance.functionalProbe.unauthenticatedRootStatus !== 401) {
    fail(`${label} functional acceptance contract is malformed or does not match the package`);
  }

  exactKeys(item.safety, ['consentRequired', 'permissions', 'network', 'processes', 'files'], `${label}.safety`);
  if (item.safety.consentRequired !== true) fail(`${label} must require consent`);
  for (const field of ['permissions', 'network', 'processes', 'files']) {
    if (!Array.isArray(item.safety[field]) || item.safety[field].some((entry) => !SAFE_TEXT.test(entry))) {
      fail(`${label}.safety.${field} must contain bounded single-line disclosures`);
    }
  }
  if (['permissions', 'network', 'processes', 'files']
      .every((field) => item.safety[field].length === 0)) {
    fail(`${label}.safety must contain at least one concrete capability disclosure`);
  }

  exactKeys(item.rights, ['licenseExpression', 'sourceUrl', 'redistribution'], `${label}.rights`);
  safeHttpsUrl(item.rights.sourceUrl, `${label}.rights.sourceUrl`);
  if (!SAFE_TEXT.test(item.rights.licenseExpression) ||
      !['allowed', 'upstream-only'].includes(item.rights.redistribution)) fail(`${label} rights record is malformed`);
  if (item.distribution.kind === 'hosted-plugin-verified' && item.rights.redistribution !== 'allowed') {
    fail(`${label} hosted artifact lacks redistribution authority`);
  }

  exactKeys(item.rollback, ['removePackageName', 'coldRestartRequired'], `${label}.rollback`);
  if (item.rollback.removePackageName !== item.package.name || item.rollback.coldRestartRequired !== true) {
    fail(`${label} rollback contract mismatch`);
  }
  exactKeys(item.receipts, ['status', 'runtimeReceiptSha256', 'platformNodeMatrixSha256'], `${label}.receipts`);
  if (item.receipts.status !== 'verified' || !SHA64.test(item.receipts.runtimeReceiptSha256) ||
      !SHA64.test(item.receipts.platformNodeMatrixSha256)) fail(`${label} item receipts are incomplete`);
  assertSafeInstallSpec(item);
  return item;
}

export function validateAuthority(authority, options = {}) {
  exactKeys(authority, [
    'schemaVersion', 'capturedAt', 'purpose', 'harness', 'supportedDistributionKinds',
    'publication', 'top10ReleaseSet', 'items',
  ], 'authority');
  if (authority.schemaVersion !== 2 || authority.purpose !== 'dsh-plugin-install-authority' ||
      !/^\d{4}-\d{2}-\d{2}$/.test(authority.capturedAt)) fail('authority header mismatch');
  if (JSON.stringify(authority.supportedDistributionKinds) !== JSON.stringify(DISTRIBUTIONS)) {
    fail('supported distribution kinds mismatch');
  }
  exactKeys(authority.harness, [
    'tag', 'commit', 'tree', 'lockfileSha256', 'sourceBuildAuthoritySha256',
    'runtimeStatus', 'runtimeReceiptSetSha256', 'installable',
  ], 'harness');
  if (authority.harness.tag !== 'dsh-v0.1.2-alpha.1' ||
      authority.harness.commit !== 'cd5ef8148158c3a752a658978873241fdf8e2bbc' ||
      authority.harness.tree !== 'a712eec535b48badc4fefb4df5176a7002e4280b' ||
      authority.harness.lockfileSha256 !== '506ad1fc7c40f71ce8c6afe08724fdd55020c1a527d7a7a185c559d39ecfcaf1' ||
      !SHA64.test(authority.harness.sourceBuildAuthoritySha256)) fail('Harness source authority mismatch');
  const runtimeVerified = authority.harness.runtimeStatus === 'runtime-receipt-verified';
  if (runtimeVerified !== authority.harness.installable ||
      (runtimeVerified ? !SHA64.test(authority.harness.runtimeReceiptSetSha256) : authority.harness.runtimeReceiptSetSha256 !== null)) {
    fail('Harness runtime receipt gate is inconsistent');
  }

  exactKeys(authority.publication, [
    'status', 'publishedInstallable', 'publishedCatalogPluginCount',
    'requiredVerifiedInstallableCount', 'verifiedInstallableCount', 'authorityItemCount',
  ], 'publication');
  if (!Number.isSafeInteger(authority.publication.publishedCatalogPluginCount) ||
      !Number.isSafeInteger(authority.publication.verifiedInstallableCount) ||
      !Number.isSafeInteger(authority.publication.authorityItemCount) ||
      authority.publication.publishedCatalogPluginCount !== 80 ||
      authority.publication.requiredVerifiedInstallableCount !== 80 ||
      authority.publication.verifiedInstallableCount < 0 ||
      authority.publication.verifiedInstallableCount > 80 ||
      authority.publication.authorityItemCount < 0 ||
      authority.publication.authorityItemCount > 80) fail('publication counts are invalid');
  if (!Array.isArray(authority.items)) fail('authority.items must be an array');
  if (authority.items.length > 80) fail('plugin authority cannot stage more than 80 verified items');
  authority.items.forEach(validateItem);
  const ids = authority.items.map((item) => item.catalogId);
  if (new Set(ids).size !== ids.length) fail('plugin authority contains duplicate catalog IDs');
  if (new Set(authority.items.map((item) => item.package.name)).size !== authority.items.length) {
    fail('plugin authority contains duplicate package names');
  }
  if (new Set(authority.items.map((item) => item.slug)).size !== authority.items.length) {
    fail('plugin authority contains duplicate slugs');
  }
  if (authority.publication.authorityItemCount !== authority.items.length ||
      authority.publication.verifiedInstallableCount !== authority.items.length) {
    fail('publication counts do not match verified authority items');
  }
  const published = authority.publication.publishedInstallable === true;
  if (authority.publication.status !== (published ? 'verified-installable' : 'plugin-evidence-pending') ||
      (published && (!runtimeVerified || authority.publication.verifiedInstallableCount !== 80 ||
        authority.publication.authorityItemCount !== 80 || authority.items.length !== 80))) {
    fail('plugin publication gate is inconsistent');
  }

  exactKeys(authority.top10ReleaseSet, ['path', 'sha256'], 'top10ReleaseSet');
  if (authority.top10ReleaseSet.path !== 'top10-release-set.json' ||
      !SHA64.test(authority.top10ReleaseSet.sha256) ||
      !Buffer.isBuffer(options.top10ReleaseSetBytes) ||
      sha256(options.top10ReleaseSetBytes) !== authority.top10ReleaseSet.sha256) {
    fail('Plugin authority is not bound to the exact Top10 release-set bytes');
  }
  let top10ReleaseSet;
  try {
    top10ReleaseSet = JSON.parse(options.top10ReleaseSetBytes);
  } catch {
    fail('Top10 release-set bytes are not valid JSON');
  }
  validateTop10ReleaseSet(top10ReleaseSet, { authority });
  if (!Buffer.isBuffer(options.harnessAuthorityBytes) ||
      sha256(options.harnessAuthorityBytes) !== authority.harness.sourceBuildAuthoritySha256) {
    fail('plugin authority is not bound to the bundled Harness source authority bytes');
  }
  return authority;
}

export function resolveItems(authority, selections, { top10 = false, top10ReleaseSet, validationOptions } = {}) {
  validateAuthority(authority, validationOptions);
  if (top10 && (!top10ReleaseSet || !Buffer.isBuffer(validationOptions?.top10ReleaseSetBytes) ||
      JSON.stringify(JSON.parse(validationOptions.top10ReleaseSetBytes)) !== JSON.stringify(top10ReleaseSet))) {
    fail('Top10 selection is not bound to the exact release-set bytes');
  }
  const ids = top10
    ? top10ReleaseSet?.entries?.map((entry) => entry.catalogId) ?? []
    : selections.map(normalizeCatalogId);
  if (new Set(ids).size !== ids.length) fail('plugin selection contains duplicate IDs');
  if (!authority.harness.installable || !authority.publication.publishedInstallable ||
      (top10 && (!top10ReleaseSet || top10ReleaseSet.frozen !== true ||
        top10ReleaseSet.status !== 'verified-frozen'))) {
    fail('plugin installation authority is evidence-pending');
  }
  return ids.map((id) => {
    const matches = authority.items.filter((item) => item.catalogId === id);
    if (matches.length !== 1) fail(`plugin #${id} lacks one exact verified authority record`);
    return matches[0];
  });
}

export async function loadAuthority() {
  const [authorityBytes, harnessBytes, top10ReleaseSetBytes] = await Promise.all([
    readFile(authorityUrl),
    readFile(harnessAuthorityUrl),
    readFile(top10ReleaseSetUrl),
  ]);
  const authority = JSON.parse(authorityBytes);
  return {
    authority: validateAuthority(authority, {
      harnessAuthorityBytes: harnessBytes,
      top10ReleaseSetBytes,
    }),
    authorityBytes,
    authoritySha256: sha256(authorityBytes),
    harnessAuthorityBytes: harnessBytes,
    top10ReleaseSetBytes,
    top10ReleaseSet: validateTop10ReleaseSet(JSON.parse(top10ReleaseSetBytes), { authority }),
    top10ReleaseSetSha256: sha256(top10ReleaseSetBytes),
  };
}

export async function loadSchema() {
  return JSON.parse(await readFile(schemaUrl, 'utf8'));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const loaded = await loadAuthority();
    process.stdout.write(`${JSON.stringify({
      valid: true,
      authoritySha256: loaded.authoritySha256,
      harnessRuntimeStatus: loaded.authority.harness.runtimeStatus,
      publishedCatalogPluginCount: loaded.authority.publication.publishedCatalogPluginCount,
      verifiedInstallableCount: loaded.authority.publication.verifiedInstallableCount,
      authorityItemCount: loaded.authority.items.length,
      top10Status: loaded.top10ReleaseSet.status,
      top10Frozen: loaded.top10ReleaseSet.frozen,
    }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
