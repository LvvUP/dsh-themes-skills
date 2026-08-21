#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

const runtimeDir = dirname(fileURLToPath(import.meta.url));
const lockPath = resolve(runtimeDir, 'pnpm-lock.yaml');
const outputPath = resolve(runtimeDir, 'attestation.json');
const SHA512 = /^sha512-[A-Za-z0-9+/]+={0,2}$/;

const sha256 = (value) =>
  createHash('sha256').update(value).digest('hex');

function packageIdentity(key) {
  const match = /^(@[^/]+\/[^@]+|[^@/]+)@([^()]+)(?:\(.*\))?$/.exec(key);
  if (!match) return null;
  return { name: match[1], version: match[2] };
}

function closureDigest(packages) {
  return sha256(
    packages
      .map((entry) => `${entry.name}@${entry.version}\t${entry.integrity}\n`)
      .join('')
  );
}

function compareCanonicalText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

const lockBytes = await readFile(lockPath);
const lock = parse(lockBytes.toString('utf8'));
const byIdentity = new Map();
for (const [key, value] of Object.entries(lock.packages ?? {})) {
  const identity = packageIdentity(key);
  if (!identity) continue;
  const integrity = value?.resolution?.integrity;
  if (typeof integrity !== 'string' || !SHA512.test(integrity)) {
    throw new Error(`missing SHA-512 registry integrity for ${key}`);
  }
  const identityKey = `${identity.name}@${identity.version}`;
  const previous = byIdentity.get(identityKey);
  if (previous && previous.integrity !== integrity) {
    throw new Error(`conflicting registry integrity for ${identityKey}`);
  }
  byIdentity.set(identityKey, { ...identity, integrity });
}

const packages = [...byIdentity.values()].sort(
  (left, right) =>
    compareCanonicalText(left.name, right.name) ||
    compareCanonicalText(left.version, right.version)
);
if (packages.length < 500) {
  throw new Error('production dependency closure is unexpectedly small');
}
const dshPackages = packages.filter((entry) =>
  entry.name.startsWith('@deepseek-ai/dsh')
);
if (dshPackages.length < 180) {
  throw new Error('DeepSeek Harness package closure is unexpectedly small');
}
const mixed = dshPackages.filter((entry) => entry.version !== '0.1.0-rc.8');
if (mixed.length > 0) {
  throw new Error(
    `mixed DSH release closure refused at ${mixed[0].name}@${mixed[0].version}`
  );
}

const exactPackage = (name, integrity) => {
  const entry = byIdentity.get(`${name}@0.1.0-rc.8`);
  if (!entry || entry.integrity !== integrity) {
    throw new Error(`${name}@0.1.0-rc.8 differs from certified evidence`);
  }
  return entry;
};

exactPackage(
  '@deepseek-ai/dsh',
  'sha512-VQU5NlomrKLRgcXuOf+sxWFvqxPA8q9vMhrKPlPPXiOJEhGlGlAdiyxZvZxkCVI+v0zbhe21cY3/luLyxpSzzA=='
);
exactPackage(
  '@deepseek-ai/dsh-client-ui-theme',
  'sha512-orLl5eoWOnvjj76lI6xucE+lT+o+ouniRMSFsuYwF1DNH2pbyfVPQYJWL3iM55gE28yyZJGgmtmABnQBiEF5iA=='
);
exactPackage(
  '@deepseek-ai/dsh-web-frontend',
  'sha512-GxWJtkNEniYtSH19XWIJvMO2RSP2bMAZvs3Z6m9cEr9OFbngCY5XCXwqsJMYqOJIao0eSePp/eRCPeXNvqeGXA=='
);

const attestation = {
  schemaVersion: 2,
  certificationStatus: 'verified',
  baseline: '@deepseek-ai/dsh@0.1.0-rc.8',
  capturedAt: '2026-08-20T16:43:34.000Z',
  officialRelease: {
    tag: 'dsh-v0.1.0-rc.8',
    sourceCommit: '141eb6fef83422698aef7a981029e843e8161534',
  },
  packageManager: {
    name: 'pnpm',
    version: '11.7.0',
    integrity:
      'sha512-GcyFLBIMcSV2DyRD7mvgyltA+fUFmN4aCaHxd1A+AQ5Xwjx3ZG4B52HeWb+HT7IqM5jDOrlpH8E+uUa28PTWIA==',
    shasum: 'bea54364524dadf0a42dae28dbfeeab25ff177e5',
  },
  lockfile: {
    path: 'runtime-rc8/pnpm-lock.yaml',
    sha256: sha256(lockBytes),
  },
  productionClosure: {
    algorithm: 'sorted-name-at-version-tab-integrity-lf',
    packageCount: packages.length,
    sha256: closureDigest(packages),
    dshPackageCount: dshPackages.length,
    dshPackagesSha256: closureDigest(dshPackages),
    packages,
  },
  compatibility: {
    dshPackageVersion: '0.1.0-rc.8',
    officialRelease: {
      tag: 'dsh-v0.1.0-rc.8',
      sourceCommit: '141eb6fef83422698aef7a981029e843e8161534',
    },
    npmArtifacts: {
      dsh: {
        name: '@deepseek-ai/dsh',
        version: '0.1.0-rc.8',
        integrity:
          'sha512-VQU5NlomrKLRgcXuOf+sxWFvqxPA8q9vMhrKPlPPXiOJEhGlGlAdiyxZvZxkCVI+v0zbhe21cY3/luLyxpSzzA==',
        shasum: '61bb2c44f1279329b128d47068240c36b32afa05',
        tarballSha256:
          'b8b0db6f3bcf3aed77c25bb901fdb9d0ef0f79bd8ca403b52e34c14a71d1487f',
        registryUrl:
          'https://registry.npmjs.org/@deepseek-ai/dsh/-/dsh-0.1.0-rc.8.tgz',
        provenance: 'registry-digest-only',
      },
      uiTheme: {
        name: '@deepseek-ai/dsh-client-ui-theme',
        version: '0.1.0-rc.8',
        integrity:
          'sha512-orLl5eoWOnvjj76lI6xucE+lT+o+ouniRMSFsuYwF1DNH2pbyfVPQYJWL3iM55gE28yyZJGgmtmABnQBiEF5iA==',
        shasum: '136c788b415268bee8a096832068fa8fdcf7a055',
        tarballSha256:
          'afc4602f2442e79fc4aa3d850a5f439fb9e7e10c1296b4c35d462fe31515dc35',
        registryUrl:
          'https://registry.npmjs.org/@deepseek-ai/dsh-client-ui-theme/-/dsh-client-ui-theme-0.1.0-rc.8.tgz',
        provenance: 'registry-digest-only',
      },
      webFrontend: {
        name: '@deepseek-ai/dsh-web-frontend',
        version: '0.1.0-rc.8',
        integrity:
          'sha512-GxWJtkNEniYtSH19XWIJvMO2RSP2bMAZvs3Z6m9cEr9OFbngCY5XCXwqsJMYqOJIao0eSePp/eRCPeXNvqeGXA==',
        shasum: '30241a5914b6ecc41a3921ec390256b46a528820',
        tarballSha256:
          '528215483f5581550033a98b154e83a947cce3553f869f9d2f6977d36225a02d',
        registryUrl:
          'https://registry.npmjs.org/@deepseek-ai/dsh-web-frontend/-/dsh-web-frontend-0.1.0-rc.8.tgz',
        provenance: 'registry-digest-only',
      },
    },
    uiThemeClientBundleSha256:
      '86f6ae4775ca2f4af29b7abaf200a18833b6675aa8446942f819342829eba6a5',
    tokenCatalogSha256:
      'fe38fdb18dae76f3cc93e3ca3a37bb1916f207180781b1aa8321ee2ddadcb926',
    selectorCatalogSha256:
      '663aa5927591ac99076f924ee9cd6f9bd09e6a8a9ee1e6b8b1b0d9e3093df807',
    webEntrypoints: {
      indexHtml: {
        path: 'dist/index.html',
        sha256:
          '1af3332985a498e11b8a4b34e29304c59beedf0838eea3b3d61b676f0288c7f0',
      },
      mainJavaScript: {
        path: 'dist/assets/index-CA9Bpko5.js',
        sha256:
          'fc0a9239bcd0712fb8b15bb8147667763e670763aa8f56e7db4031a6d6fd8d15',
      },
      mainStylesheet: {
        path: 'dist/assets/index-BNMwCG9c.css',
        sha256:
          'b56df4902c9374fee34ef013943c87f4eab81d6a92751b8b76af147fd454d70e',
      },
      vendorJavaScript: {
        path: 'dist/assets/vendor-D22_Mp1f.js',
        sha256:
          'a999d26735448a40f2a8a21bf9cf9748b7815634fae4c5ca51d929843da9a907',
      },
      vendorStylesheet: {
        path: 'dist/assets/vendor-CjyC-hUb.css',
        sha256:
          '8b86a22c0e3551fb5c3ec2af2b2515232614f75fd1e7ce76d62bec9ce12a6686',
      },
    },
    webAssetSet: {
      algorithm: 'sorted-path-tab-size-tab-sha256-lf',
      scope: 'dist/assets/**',
      fileCount: 86,
      sha256:
        'b225f316eacc754b41ffdc1402f4de92c742cf5d9b7e460923092aad65800f06',
    },
  },
  certificationRun: {
    provider: 'github-actions',
    repository: 'LvvUP/DSH-Themes',
    workflow: 'RC.8 candidate certification',
    event: 'push',
    runId: 32393288849,
    runUrl:
      'https://github.com/LvvUP/DSH-Themes/actions/runs/32393288849',
    headBranch: 'codex/gallery-ui-extensions',
    headSha: 'e3fe9ac465b8db8070efbdb83ddc6c821f923a73',
    conclusion: 'success',
    completedAt: '2026-08-20T16:43:34.000Z',
    matrix: [
      {
        runner: 'ubuntu-latest',
        platform: 'linux',
        nodeVersion: '22.19.0',
        jobId: 96504210180,
        jobUrl:
          'https://github.com/LvvUP/DSH-Themes/actions/runs/32393288849/job/96504210180',
        conclusion: 'success',
      },
      {
        runner: 'ubuntu-latest',
        platform: 'linux',
        nodeVersion: '24.15.0',
        jobId: 96504210276,
        jobUrl:
          'https://github.com/LvvUP/DSH-Themes/actions/runs/32393288849/job/96504210276',
        conclusion: 'success',
      },
      {
        runner: 'macos-latest',
        platform: 'darwin',
        nodeVersion: '22.19.0',
        jobId: 96504210427,
        jobUrl:
          'https://github.com/LvvUP/DSH-Themes/actions/runs/32393288849/job/96504210427',
        conclusion: 'success',
      },
      {
        runner: 'macos-latest',
        platform: 'darwin',
        nodeVersion: '24.15.0',
        jobId: 96504210354,
        jobUrl:
          'https://github.com/LvvUP/DSH-Themes/actions/runs/32393288849/job/96504210354',
        conclusion: 'success',
      },
      {
        runner: 'windows-latest',
        platform: 'win32',
        nodeVersion: '22.19.0',
        jobId: 96504210390,
        jobUrl:
          'https://github.com/LvvUP/DSH-Themes/actions/runs/32393288849/job/96504210390',
        conclusion: 'success',
      },
      {
        runner: 'windows-latest',
        platform: 'win32',
        nodeVersion: '24.15.0',
        jobId: 96504210356,
        jobUrl:
          'https://github.com/LvvUP/DSH-Themes/actions/runs/32393288849/job/96504210356',
        conclusion: 'success',
      },
    ],
  },
  acceptance: {
    profile: 'web',
    telemetry: 'disabled',
    webNoOpen: true,
    allowedHosts: ['127.0.0.1', '::1'],
    forbiddenHosts: ['0.0.0.0'],
    nodeVersions: ['22.19.0', '24.15.0'],
    platforms: ['darwin', 'linux', 'win32'],
    uiEvidenceSha256:
      '056ab031d6605420adeb4219eaea1a402344cef080007d79558439845b00ea3d',
    selectorScope: 'published-artifact-allowlist',
    lifecycle: {
      strategy: 'managed-cold-restart',
      installSwitchRemoveRollback: 'verified',
      restartReproducibility: 'verified',
      officialFiveStyleCleanupFixture: 'verified',
      productionLiveUnload: 'unsupported-by-upstream-rc8',
      productionLiveHmr: 'not-certified-or-promised',
    },
  },
};

await writeFile(outputPath, `${JSON.stringify(attestation, null, 2)}\n`, {
  mode: 0o644,
});
process.stdout.write(
  `${JSON.stringify({
    output: outputPath,
    sha256: sha256(await readFile(outputPath)),
    lockfileSha256: attestation.lockfile.sha256,
    packageCount: packages.length,
    dshPackageCount: dshPackages.length,
  })}\n`
);
