#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';

const authorityUrl = new URL(
  '../references/rc8-v3-candidate.json',
  import.meta.url
);
const SHA256 = /^[a-f0-9]{64}$/;
const SHA1 = /^[a-f0-9]{40}$/;
const EXPECTED_ARTIFACTS = Object.freeze({
  dsh: {
    name: '@deepseek-ai/dsh',
    path: '/@deepseek-ai/dsh/-/dsh-0.1.0-rc.8.tgz',
  },
  uiTheme: {
    name: '@deepseek-ai/dsh-client-ui-theme',
    path: '/@deepseek-ai/dsh-client-ui-theme/-/dsh-client-ui-theme-0.1.0-rc.8.tgz',
  },
  webFrontend: {
    name: '@deepseek-ai/dsh-web-frontend',
    path: '/@deepseek-ai/dsh-web-frontend/-/dsh-web-frontend-0.1.0-rc.8.tgz',
  },
});

function fail(message) {
  throw new Error(message);
}

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--input' || !isAbsolute(args[1])) {
  fail('Usage: validate-rc8-candidate.mjs --input <absolute-candidate.json>');
}

const [authority, candidate] = await Promise.all([
  readFile(authorityUrl, 'utf8').then(JSON.parse),
  readFile(args[1], 'utf8').then(JSON.parse),
]);

if (JSON.stringify(candidate) !== JSON.stringify(authority)) {
  fail('RC.8 candidate differs from the bundled pending-evidence authority');
}
if (
  authority.schemaVersion !== 3 ||
  authority.certificationStatus !== 'pending' ||
  authority.officialRelease?.tag !== 'dsh-v0.1.0-rc.8' ||
  authority.officialRelease?.sourceCommit !==
    '141eb6fef83422698aef7a981029e843e8161534' ||
  authority.npmProvenance !== 'registry-digest-only' ||
  authority.selectorCatalogSha256 !== null ||
  authority.runtimeAttestationSha256 !== null ||
  authority.acceptance?.status !== 'pending' ||
  !Array.isArray(authority.acceptance?.blockers) ||
  authority.acceptance.blockers.length === 0
) {
  fail('Bundled RC.8 candidate must remain explicitly pending and incomplete');
}
if (
  Object.keys(authority.npmArtifacts ?? {}).sort().join(',') !==
  Object.keys(EXPECTED_ARTIFACTS).sort().join(',')
) fail('RC.8 npm candidate must contain the exact three-package closure');
for (const [key, expected] of Object.entries(EXPECTED_ARTIFACTS)) {
  const artifact = authority.npmArtifacts[key];
  let registryUrl;
  try {
    registryUrl = new URL(artifact?.registryUrl);
  } catch {
    fail('RC.8 npm candidate registry URL is malformed');
  }
  if (
    artifact?.name !== expected.name ||
    artifact?.version !== '0.1.0-rc.8' ||
    !/^sha512-[A-Za-z0-9+/]+={0,2}$/.test(artifact.integrity ?? '') ||
    !SHA1.test(artifact.shasum ?? '') ||
    !SHA256.test(artifact.tarballSha256 ?? '') ||
    registryUrl.protocol !== 'https:' ||
    registryUrl.origin !== 'https://registry.npmjs.org' ||
    registryUrl.username ||
    registryUrl.password ||
    registryUrl.search ||
    registryUrl.hash ||
    registryUrl.pathname !== expected.path
  ) {
    fail('RC.8 npm candidate evidence is malformed');
  }
}
if (
  !SHA256.test(authority.uiThemeClientBundleSha256 ?? '') ||
  Object.keys(authority.webEntrypoints ?? {}).sort().join(',') !==
    [
      'indexHtmlSha256',
      'mainJavaScriptSha256',
      'mainStylesheetSha256',
      'vendorJavaScriptSha256',
      'vendorStylesheetSha256',
    ].sort().join(',') ||
  !Object.values(authority.webEntrypoints).every((value) => SHA256.test(value)) ||
  authority.webAssetSet?.algorithm !==
    'sorted-path-tab-size-tab-sha256-lf' ||
  authority.webAssetSet?.scope !== 'dist/assets/**' ||
  authority.webAssetSet?.fileCount !== 86 ||
  !SHA256.test(authority.webAssetSet?.sha256 ?? '') ||
  !SHA256.test(authority.tokenCatalogSha256 ?? '')
) fail('RC.8 static candidate evidence is malformed');
if (
  authority.releaseGate?.certifiedDshPackageVersion !== '0.1.0-rc.6' ||
  authority.releaseGate?.upstreamTargetDshPackageVersion !== '0.1.0-rc.8' ||
  authority.releaseGate?.targetCertificationStatus !== 'pending' ||
  authority.releaseGate?.targetInstallable !== false
) fail('Bundled release gate must keep RC.8 pending and RC.6 certified');

process.stdout.write(
  `${JSON.stringify(
    {
      status: 'candidate-evidence-validated-not-installable',
      dshPackageVersion: '0.1.0-rc.8',
      certificationStatus: 'pending',
      blockers: authority.acceptance.blockers,
    },
    null,
    2
  )}\n`
);
