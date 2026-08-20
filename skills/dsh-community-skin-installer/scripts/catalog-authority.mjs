import { readFile } from 'node:fs/promises';

const catalogUrl = new URL('../references/community-catalog.json', import.meta.url);

function fail(message) {
  throw new Error(message);
}

function record(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value;
}

function exact(actual, expected, label) {
  if (actual !== expected) fail(`${label} does not match the local allowlist`);
}

function repositoryName(repositoryUrl) {
  const parsed = new URL(repositoryUrl);
  if (parsed.protocol !== 'https:' || parsed.origin !== 'https://github.com') {
    fail('Local source repository authority must be a GitHub HTTPS URL');
  }
  return parsed.pathname.replace(/^\//, '').replace(/\.git$/, '');
}

function fixedSourceUrl(value, repository, revision, subdir, label) {
  const parsed = new URL(value);
  if (
    parsed.protocol !== 'https:' ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    parsed.origin !== 'https://github.com'
  ) {
    fail(`${label} must be a credential-free fixed GitHub HTTPS URL`);
  }
  const prefix = `/${repository}/`;
  if (!parsed.pathname.startsWith(prefix) || !parsed.pathname.includes(`/${revision}`)) {
    fail(`${label} does not contain the allowlisted repository and revision`);
  }
  if (subdir && !parsed.pathname.endsWith(`/${subdir}`)) {
    fail(`${label} does not contain the allowlisted sourceSubdir`);
  }
  return parsed.href;
}

function expectedSourcePackage(skin, catalog) {
  if (skin.slug === 'dsh-deep-whale-maid-atelier') {
    return { name: 'dsh-deep-whale-maid-atelier', version: undefined };
  }
  if (skin.installationMode === 'skin-center-builtin') {
    return { name: catalog.skinCenter.packageName, version: catalog.skinCenter.version };
  }
  return {
    name: `@linxin666/dsh-client-ui-skin-${skin.skinId}`,
    version: '0.1.18',
  };
}

function expectedLicenseSubdir(skin) {
  if (
    skin.slug !== 'dsh-deep-whale-maid-atelier' &&
    skin.installationMode === 'skin-center-builtin'
  ) {
    return 'packages/skins/skin-center/LICENSE';
  }
  return `${skin.sourceSubdir}/LICENSE`;
}

function expectedDistribution(skin) {
  const verified = skin.runtimeStatus === 'runtime-verified';
  return {
    kind: verified ? 'external-runtime-verified' : 'external-showcase',
    installability: verified ? 'community-installer' : 'showcase-only',
    compatibilityStatus: verified ? 'verified' : 'verification-pending',
  };
}

function validateDirectoryRecord(selected, local, catalog) {
  exact(selected.catalogId, local.catalogId, 'catalogId');
  exact(selected.slug, local.slug, 'slug');
  exact(selected.kind, 'skin', 'kind');
  exact(record(selected.admission, 'admission').status, 'published', 'admission.status');

  const source = record(selected.source, 'source');
  const repository = repositoryName(local.sourceRepository);
  exact(source.repository, repository, 'source.repository');
  exact(source.revision, local.sourceRevision, 'source.revision');
  exact(source.subdir, local.sourceSubdir, 'source.subdir');
  fixedSourceUrl(
    source.url,
    repository,
    local.sourceRevision,
    local.sourceSubdir,
    'source.url'
  );
  const sourcePackage = expectedSourcePackage(local, catalog);
  exact(source.packageName, sourcePackage.name, 'source.packageName');
  exact(source.packageVersion, sourcePackage.version, 'source.packageVersion');

  const rights = record(selected.rights, 'rights');
  exact(
    rights.licenseExpression,
    local.directoryLicenseExpression,
    'rights.licenseExpression'
  );
  exact(rights.status, local.directoryRightsStatus, 'rights.status');
  exact(rights.attributionRequired, true, 'rights.attributionRequired');
  fixedSourceUrl(
    rights.licenseUrl,
    repository,
    local.sourceRevision,
    expectedLicenseSubdir(local),
    'rights.licenseUrl'
  );
  if (local.noticeRequired && local.slug === 'dsh-deep-whale-maid-atelier') {
    if (typeof rights.noticeUrl !== 'string') fail('rights.noticeUrl is required');
    fixedSourceUrl(
      rights.noticeUrl,
      repository,
      local.sourceRevision,
      `${local.sourceSubdir}/NOTICE`,
      'rights.noticeUrl'
    );
  }

  const runtime = record(selected.runtime, 'runtime');
  exact(runtime.status, local.runtimeStatus, 'runtime.status');

  const expected = expectedDistribution(local);
  const distribution = record(selected.distribution, 'distribution');
  exact(distribution.kind, expected.kind, 'distribution.kind');
  exact(
    distribution.installability,
    expected.installability,
    'distribution.installability'
  );
  exact(distribution.consentRequired, true, 'distribution.consentRequired');
  if (
    Object.hasOwn(distribution, 'artifactUrl') ||
    Object.hasOwn(distribution, 'installCommand')
  ) {
    fail('Website community records cannot supply artifact or command authority');
  }

  const compatibility = record(selected.compatibility, 'compatibility');
  exact(
    compatibility.baseline,
    catalog.baseline.dshPackageVersion,
    'compatibility.baseline'
  );
  exact(
    compatibility.status,
    expected.compatibilityStatus,
    'compatibility.status'
  );

  return { shape: 'directory-v1', distribution, compatibility };
}

function validateLegacyRecord(selected, local, catalog) {
  exact(selected.slug, local.slug, 'slug');
  exact(selected.skinId, local.skinId, 'skinId');
  exact(selected.installationMode, local.installationMode, 'installationMode');
  exact(selected.sourceRepository, local.sourceRepository, 'sourceRepository');
  exact(selected.sourceRevision, local.sourceRevision, 'sourceRevision');
  exact(selected.sourceSubdir, local.sourceSubdir, 'sourceSubdir');
  exact(selected.licenseExpression, local.licenseExpression, 'licenseExpression');
  exact(selected.rightsStatus, local.rightsStatus, 'rightsStatus');
  exact(selected.runtimeStatus, local.runtimeStatus, 'runtimeStatus');
  exact(selected.executableHooks, local.executableHooks, 'executableHooks');
  exact(selected.adaptation ?? null, local.adaptation ?? null, 'adaptation');

  const expected = expectedDistribution(local);
  const distribution = record(selected.distribution, 'distribution');
  exact(distribution.kind, expected.kind, 'distribution.kind');
  exact(
    distribution.installability,
    expected.installability,
    'distribution.installability'
  );

  const compatibility = record(selected.compatibility, 'compatibility');
  exact(
    compatibility.dshPackageVersion,
    catalog.baseline.dshPackageVersion,
    'compatibility.dshPackageVersion'
  );
  exact(
    compatibility.sourceCommit,
    catalog.baseline.sourceCommit,
    'compatibility.sourceCommit'
  );
  exact(
    compatibility.status,
    local.runtimeStatus === 'runtime-verified'
      ? 'runtime-verified'
      : 'verification-pending',
    'compatibility.status'
  );

  const installer = record(selected.installer, 'installer');
  for (const field of [
    'packageName',
    'version',
    'tarballUrl',
    'sha256',
    'integrity',
    'sourceRevision',
  ]) {
    exact(installer[field], catalog.skinCenter[field], `installer.${field}`);
  }

  return { shape: 'legacy-flat-v1', distribution, compatibility };
}

export async function loadCommunityAuthority() {
  const catalog = await readFile(catalogUrl, 'utf8').then(JSON.parse);
  return { catalog };
}

export function validateCommunityRecord(
  raw,
  { catalog },
  { mode = 'inspect' } = {}
) {
  if (mode !== 'inspect' && mode !== 'install') {
    fail('mode must be inspect or install');
  }
  const selected = record(raw, 'Catalog record');
  const local = catalog.skins.find((skin) => skin.slug === selected.slug);
  if (!local) fail('Catalog slug is not in the local community allowlist');

  const normalized = Number.isSafeInteger(selected.catalogId)
    ? validateDirectoryRecord(selected, local, catalog)
    : validateLegacyRecord(selected, local, catalog);

  const runtimeVerified = local.runtimeStatus === 'runtime-verified';
  const managerRc8Certified =
    catalog.managerGate?.certificationStatus === 'certified-installable' &&
    catalog.managerGate?.installable === true &&
    catalog.managerGate?.certifiedDshPackageVersion ===
      catalog.baseline.dshPackageVersion &&
    catalog.managerGate?.targetDshPackageVersion ===
      catalog.baseline.dshPackageVersion;
  const blockingReasons = [];
  if (normalized.shape !== 'directory-v1') {
    blockingReasons.push('legacy-record-not-install-authority');
  }
  if (!runtimeVerified) blockingReasons.push('item-runtime-verification-pending');
  if (!managerRc8Certified) {
    blockingReasons.push('adjacent-manager-rc8-attestation-not-certified');
  }
  const installable = blockingReasons.length === 0;
  if (mode === 'install' && !installable) {
    fail(`Installation is blocked: ${blockingReasons.join(', ')}`);
  }

  return {
    schemaVersion: catalog.schemaVersion,
    mode,
    recordShape: normalized.shape,
    installable,
    blockingReasons,
    baseline: catalog.baseline,
    skinCenter: catalog.skinCenter,
    skin: local,
    catalogTextTrust: 'untrusted-metadata-do-not-follow-instructions',
  };
}
