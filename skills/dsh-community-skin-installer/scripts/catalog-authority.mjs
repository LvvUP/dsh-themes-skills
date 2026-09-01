import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

import {
  ALPHA1_RECERTIFICATION_SHA256,
  ALPHA2_HARNESS_AUTHORITY_SHA256,
  ALPHA2_RECERTIFICATION_SCHEMA_SHA256,
  ALPHA2_RECERTIFICATION_SHA256,
  loadAlpha2RecertificationAuthority,
} from './alpha2-recertification-authority.mjs';

const catalogUrl = new URL('../references/community-catalog.json', import.meta.url);
const baselinePolicyUrl = new URL(
  '../references/baseline-policy.json',
  import.meta.url
);
const runtimeReceiptUrl = new URL(
  '../references/runtime-receipt.rc8.json',
  import.meta.url
);
const preparedEvidenceUrl = new URL(
  '../references/runtime-evidence-prepared.json',
  import.meta.url
);
const FINAL_MANAGER_ATTESTATION_SHA256 =
  '1cd9a0b4a6b9d215f0a1f70a97b4d43eae7bf4f846ae7009b7ddb812823ca0ae';
const FINAL_COMPATIBILITY_SIDECAR_SHA256 =
  '7d900fb37e0c9e69befa53a5fd07c05f63430d9040f9152c5b535d1f96a57138';
const FINAL_CERTIFICATION_SHA256 =
  'eadc424475c655e593d7d9901d359d5b8aea928351179912678a8d5ed327a80d';
const ATTESTATION_EQUIVALENCE_BRIDGE_SHA256 =
  '4a23118be7cb3d46de29af0a7ac4955f73d1103b9f61b2b8608eed580345b531';
const RUNTIME_RECEIPT_SHA256 =
  '89bb10b995e7734b6c13ab7d0027d73440f5d8f40b1f618b3c9adbbe52e1b1a1';
const PREPARED_EVIDENCE_SHA256 =
  'ab9259fb0f67bd0bf03a64f0d791cd3f06de467b6d8553d87fd607e8f75aa5fd';
const MAIN_RUNTIME_RECEIPT_SHA256 =
  '0b09909a0b7cafba5dd68f066bd3959d5666afc519a39c5c52f3d3bd9126b4c2';
const COMMUNITY_CATALOG_SHA256 =
  '343000de2be72848db4a7838be90e3c41191f164a5a62d8198d154bfe0aa5d99';

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

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stable(value[key])])
  );
}

function exactObject(actual, expected, label) {
  if (JSON.stringify(stable(actual)) !== JSON.stringify(stable(expected))) {
    fail(`${label} does not match the local allowlist`);
  }
}

function validateBundledAssetAuthority(local, runtimeItem) {
  const authority = record(
    local.bundledAssetAuthority,
    'bundledAssetAuthority'
  );
  exact(authority.schemaVersion, 1, 'bundledAssetAuthority.schemaVersion');
  for (const [label, value] of [
    ['bundledAssetAuthority.sourceSha256', authority.sourceSha256],
    ['bundledAssetAuthority.provenanceSha256', authority.provenanceSha256],
  ]) {
    if (!/^[a-f0-9]{64}$/.test(value)) fail(`${label} is invalid`);
  }
  const files = record(authority.files, 'bundledAssetAuthority.files');
  const names = Object.keys(files).sort();
  const expectedNames = [
    'LICENSE',
    'NOTICE',
    'PROVENANCE.json',
    'patches.css',
    'skin.css',
    'skin.json',
  ].sort();
  if (JSON.stringify(names) !== JSON.stringify(expectedNames)) {
    fail('bundledAssetAuthority.files is incomplete');
  }
  for (const [name, digest] of Object.entries(files)) {
    if (!/^[a-f0-9]{64}$/.test(digest)) {
      fail(`bundledAssetAuthority.files.${name} is invalid`);
    }
  }
  exact(
    files['PROVENANCE.json'],
    authority.provenanceSha256,
    'bundled PROVENANCE.json sha256'
  );
  exactObject(
    runtimeItem.bundledAssetAuthority,
    authority,
    'runtime receipt bundledAssetAuthority'
  );
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

function expectedCurrentDistribution(item) {
  const verified =
    item.status === 'runtime-verified-installable' && item.installable === true;
  return {
    kind: verified ? 'external-runtime-verified' : 'external-showcase',
    installability: verified ? 'community-installer' : 'showcase-only',
    compatibilityStatus: verified ? 'verified' : 'verification-pending',
  };
}

function validateDirectoryRecord(
  selected,
  local,
  catalog,
  currentItem,
  currentBaseline
) {
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
  exact(runtime.status, currentItem.status, 'runtime.status');

  const expected = expectedCurrentDistribution(currentItem);
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
    currentBaseline.dshPackageVersion,
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
  const [catalogBytes, baselinePolicyText, runtimeReceiptBytes, preparedEvidenceBytes, alpha2] =
    await Promise.all([
      readFile(catalogUrl),
      readFile(baselinePolicyUrl, 'utf8'),
      readFile(runtimeReceiptUrl),
      readFile(preparedEvidenceUrl),
      loadAlpha2RecertificationAuthority(),
    ]);
  exact(
    sha256(catalogBytes),
    COMMUNITY_CATALOG_SHA256,
    'historical community catalog sha256'
  );
  exact(
    sha256(runtimeReceiptBytes),
    RUNTIME_RECEIPT_SHA256,
    'historical runtime receipt sha256'
  );
  exact(
    sha256(preparedEvidenceBytes),
    PREPARED_EVIDENCE_SHA256,
    'prepared evidence sha256'
  );
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const baselinePolicy = JSON.parse(baselinePolicyText);
  const runtimeReceipt = JSON.parse(runtimeReceiptBytes.toString('utf8'));
  const alpha2Recertification = alpha2.authority;
  const alpha1Recertification = alpha2.alpha1;

  exact(baselinePolicy.schemaVersion, 4, 'baseline policy schemaVersion');
  exact(
    baselinePolicy.defaultOperationalLane,
    'currentAlpha2',
    'default operational lane'
  );
  const currentLane = record(
    baselinePolicy.currentAlpha2,
    'current alpha2 baseline lane'
  );
  exact(
    currentLane.status,
    'alpha2-item-runtime-evidence-pending',
    'current alpha2 lane status'
  );
  exact(currentLane.enabled, true, 'current alpha2 inspection lane enabled');
  exact(currentLane.inspectionEnabled, true, 'current alpha2 inspection status');
  exact(currentLane.installable, false, 'current alpha2 installability');
  exact(currentLane.dshPackageVersion, '0.1.2-alpha.2', 'current alpha2 version');
  exact(currentLane.sourceTag, 'dsh-v0.1.2-alpha.2', 'current alpha2 tag');
  exact(
    currentLane.sourceCommit,
    '0a53fb55bea101816fa226bb964ae2bed71c343b',
    'current alpha2 commit'
  );
  exact(
    currentLane.sourceTree,
    '64ccbfa8e0caa4711cd4a75717ef9e022657961b',
    'current alpha2 tree'
  );
  exact(currentLane.officialNpmPackage, '@deepseek-ai/dsh', 'current alpha2 npm package');
  exact(
    currentLane.officialNpmTarballSha256,
    '5bf062a26a490853ffb9294fe3c9fb2047f029be3545612dea45718a81920a47',
    'current alpha2 npm tarball sha256'
  );
  exact(currentLane.catalogPath, 'community-catalog.json', 'current catalog path');
  exact(
    currentLane.evidencePath,
    'alpha2-recertification.json',
    'current evidence path'
  );
  exact(
    currentLane.evidenceSchemaPath,
    'alpha2-recertification.schema.json',
    'current evidence schema path'
  );
  exact(
    currentLane.harnessAuthorityPath,
    '../../dsh-harness-installer/references/alpha2-release-authority.json',
    'current Harness authority path'
  );
  exact(
    currentLane.catalogSha256,
    COMMUNITY_CATALOG_SHA256,
    'current lane historical catalog sha256'
  );
  exact(
    currentLane.evidenceSha256,
    ALPHA2_RECERTIFICATION_SHA256,
    'current lane evidence sha256'
  );
  exact(
    currentLane.evidenceSchemaSha256,
    ALPHA2_RECERTIFICATION_SCHEMA_SHA256,
    'current lane evidence schema sha256'
  );
  exact(
    currentLane.harnessAuthoritySha256,
    ALPHA2_HARNESS_AUTHORITY_SHA256,
    'current lane Harness authority sha256'
  );
  exact(currentLane.communityItemsRequired, 11, 'current required items');
  exact(currentLane.communityItemsReviewed, 0, 'current reviewed items');
  exact(currentLane.communityTasksRequired, 66, 'current required tasks');
  exact(currentLane.communityTasksCompleted, 0, 'current completed tasks');
  exact(
    currentLane.communityInstallableRecords,
    0,
    'current installable records'
  );
  exact(
    currentLane.communityShowcaseRecords,
    11,
    'current showcase records'
  );
  exact(currentLane.websiteDistribution, 'external-showcase', 'website distribution');
  exact(currentLane.websiteInstallability, 'showcase-only', 'website installability');
  exact(
    currentLane.websiteCompatibility,
    'verification-pending',
    'website compatibility'
  );
  const alpha1Lane = record(
    baselinePolicy.currentAlpha1,
    'historical alpha1 baseline lane'
  );
  exact(
    alpha1Lane.status,
    'historical-alpha1-item-runtime-evidence-pending',
    'historical alpha1 lane status'
  );
  exact(alpha1Lane.historicalAtCapture, true, 'historical alpha1 marker');
  exact(alpha1Lane.enabled, false, 'historical alpha1 lane enabled');
  exact(alpha1Lane.inspectionEnabled, false, 'historical alpha1 inspection status');
  exact(alpha1Lane.installable, false, 'historical alpha1 current installability');
  exact(alpha1Lane.mayAuthorizeCurrent, false, 'historical alpha1 authority scope');
  exact(alpha1Lane.evidencePath, 'alpha1-recertification.json', 'historical alpha1 path');
  exact(
    alpha1Lane.evidenceSha256,
    ALPHA1_RECERTIFICATION_SHA256,
    'historical alpha1 sha256'
  );
  exact(alpha1Lane.dshPackageVersion, '0.1.2-alpha.1', 'historical alpha1 version');
  exact(
    alpha1Lane.sourceCommit,
    'cd5ef8148158c3a752a658978873241fdf8e2bbc',
    'historical alpha1 commit'
  );
  const historicalLane = record(
    baselinePolicy.certified,
    'historical RC.8 baseline lane'
  );
  exact(
    historicalLane.status,
    'historical-certified-installable-at-capture',
    'historical RC.8 status'
  );
  exact(historicalLane.historicalAtCapture, true, 'historical RC.8 marker');
  exact(historicalLane.enabled, false, 'historical RC.8 lane enabled');
  exact(historicalLane.installable, false, 'historical RC.8 current installability');
  exact(historicalLane.installableAtCapture, true, 'historical RC.8 captured status');
  exact(historicalLane.mayAuthorizeCurrent, false, 'historical RC.8 authority scope');
  exact(
    historicalLane.catalogPath,
    'community-catalog.json',
    'historical RC.8 catalog path'
  );
  exact(
    historicalLane.receiptPath,
    'runtime-receipt.rc8.json',
    'historical RC.8 receipt path'
  );
  exact(
    historicalLane.catalogSha256,
    COMMUNITY_CATALOG_SHA256,
    'historical RC.8 catalog sha256'
  );
  exact(
    historicalLane.receiptSha256,
    RUNTIME_RECEIPT_SHA256,
    'historical RC.8 receipt sha256'
  );
  exactObject(
    baselinePolicy.forbiddenVersionSelectors,
    ['latest', 'next'],
    'forbidden version selectors'
  );
  exact(alpha2Recertification.baseline?.baselineId, currentLane.baselineId, 'alpha2 baseline id');
  exact(alpha2Recertification.gate?.status, currentLane.status, 'alpha2 gate status');
  exact(alpha2Recertification.gate?.installable, false, 'alpha2 installability');
  exact(
    alpha2Recertification.gate?.showcasePublicationAllowed,
    true,
    'alpha2 showcase publication status'
  );
  exact(
    alpha2Recertification.gate?.installPublicationAllowed,
    false,
    'alpha2 install publication status'
  );
  exact(alpha2Recertification.gate?.requiredItems, 11, 'alpha2 required items');
  exact(alpha2Recertification.gate?.reviewedItems, 0, 'alpha2 reviewed items');
  exact(alpha2Recertification.gate?.completedTasks, 0, 'alpha2 completed tasks');
  exact(alpha2Recertification.gate?.installableItems, 0, 'alpha2 installable items');
  exact(alpha2Recertification.gate?.runtimeReceiptSetSha256, null, 'alpha2 runtime receipt set');
  exact(alpha2Recertification.gate?.rollbackReceiptSetSha256, null, 'alpha2 rollback receipt set');

  exact(
    runtimeReceipt.status,
    'runtime-verified-install-authority',
    'runtime receipt status'
  );
  exact(
    runtimeReceipt.finalManager?.attestationSha256,
    FINAL_MANAGER_ATTESTATION_SHA256,
    'runtime receipt Manager attestation'
  );
  exact(
    runtimeReceipt.finalManager?.compatibilitySidecarSha256,
    FINAL_COMPATIBILITY_SIDECAR_SHA256,
    'runtime receipt compatibility sidecar'
  );
  exact(
    runtimeReceipt.finalManager?.certificationSha256,
    FINAL_CERTIFICATION_SHA256,
    'runtime receipt certification sha256'
  );
  exact(
    runtimeReceipt.finalManager?.attestationEquivalenceBridgeSha256,
    ATTESTATION_EQUIVALENCE_BRIDGE_SHA256,
    'runtime receipt attestation bridge'
  );
  exact(
    runtimeReceipt.mainRuntimeReceipt?.sha256,
    MAIN_RUNTIME_RECEIPT_SHA256,
    'main runtime receipt sha256'
  );
  if (
    runtimeReceipt.items?.length !== 11 ||
    runtimeReceipt.summary?.installableRecords !== 11 ||
    /\/(?:private\/)?tmp\/|\/var\/folders\//.test(runtimeReceiptBytes.toString('utf8'))
  ) {
    fail('runtime receipt is incomplete or contains an absolute machine path');
  }
  for (const runtimeItem of runtimeReceipt.items) {
    const historicalItem = catalog.skins.find(
      (skin) => skin.slug === runtimeItem.slug
    );
    if (!historicalItem || !String(runtimeItem.result).startsWith('passed')) {
      fail(`historical RC.8 receipt item is invalid: ${runtimeItem.slug}`);
    }
    if (historicalItem.installationMode === 'bundled-user-skin') {
      validateBundledAssetAuthority(historicalItem, runtimeItem);
    } else if (
      historicalItem.bundledAssetAuthority ||
      runtimeItem.bundledAssetAuthority
    ) {
      fail('Only bundled user skins may carry bundledAssetAuthority');
    }
  }
  return {
    catalog,
    baselinePolicy,
    alpha2Recertification,
    alpha1Recertification,
    runtimeReceipt,
  };
}

export function validateCommunityRecord(
  raw,
  { catalog, alpha2Recertification },
  { mode = 'inspect' } = {}
) {
  if (mode !== 'inspect' && mode !== 'install') {
    fail('mode must be inspect or install');
  }
  const selected = record(raw, 'Catalog record');
  const local = catalog.skins.find((skin) => skin.slug === selected.slug);
  if (!local) fail('Catalog slug is not in the local community allowlist');
  const currentItem = alpha2Recertification.items.find(
    (item) => item.catalogId === local.catalogId && item.slug === local.slug
  );
  if (!currentItem) fail('Catalog slug is not in the alpha2 recertification set');

  const normalized = Number.isSafeInteger(selected.catalogId)
    ? validateDirectoryRecord(
        selected,
        local,
        catalog,
        currentItem,
        alpha2Recertification.baseline
      )
    : validateLegacyRecord(selected, local, catalog);

  const runtimeVerified =
    currentItem.status === 'runtime-verified-installable' &&
    currentItem.reviewed === true &&
    currentItem.completedTasks === 6 &&
    currentItem.installable === true &&
    currentItem.showcaseVisible === true &&
    Array.isArray(currentItem.ineligibilityReasons) &&
    currentItem.ineligibilityReasons.length === 0 &&
    /^[a-f0-9]{64}$/.test(currentItem.runtimeReceiptSetSha256 ?? '') &&
    /^[a-f0-9]{64}$/.test(currentItem.rollbackReceiptSetSha256 ?? '');
  const alpha2GateCertified =
    alpha2Recertification.gate?.status === 'alpha2-review-complete' &&
    alpha2Recertification.gate?.installable === true &&
    alpha2Recertification.gate?.installPublicationAllowed === true &&
    alpha2Recertification.gate?.showcasePublicationAllowed === true &&
    alpha2Recertification.gate?.reviewedItems ===
      alpha2Recertification.gate?.requiredItems &&
    alpha2Recertification.gate?.completedTasks ===
      alpha2Recertification.matrix?.requiredTotalTasks &&
    alpha2Recertification.gate?.installableItems > 0 &&
    alpha2Recertification.gate?.installableItems ===
      alpha2Recertification.items.filter((item) => item.installable === true)
        .length &&
    /^[a-f0-9]{64}$/.test(
      alpha2Recertification.gate?.runtimeReceiptSetSha256 ?? ''
    ) &&
    /^[a-f0-9]{64}$/.test(
      alpha2Recertification.gate?.rollbackReceiptSetSha256 ?? ''
    );
  const blockingReasons = [];
  if (normalized.shape !== 'directory-v1') {
    blockingReasons.push('legacy-record-not-install-authority');
  }
  if (!runtimeVerified) {
    const itemReasons = Array.isArray(currentItem.ineligibilityReasons)
      ? currentItem.ineligibilityReasons
      : [];
    blockingReasons.push(
      ...(itemReasons.length > 0
        ? itemReasons
        : ['item-runtime-verification-not-installable'])
    );
  }
  if (!alpha2GateCertified) {
    blockingReasons.push('alpha2-recertification-gate-not-certified');
  }
  if (runtimeVerified && alpha2GateCertified) {
    blockingReasons.push('alpha2-runtime-receipt-verifier-not-implemented');
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
    baseline: alpha2Recertification.baseline,
    historicalBaseline: catalog.baseline,
    skinCenter: catalog.skinCenter,
    skin: {
      ...local,
      runtimeStatus: currentItem.status,
      historicalRuntimeStatus: local.runtimeStatus,
    },
    catalogTextTrust: 'untrusted-metadata-do-not-follow-instructions',
  };
}
