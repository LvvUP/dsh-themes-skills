#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from 'yaml';

const runtimeDir = dirname(fileURLToPath(import.meta.url));
const lockPath = resolve(runtimeDir, 'pnpm-lock.yaml');
const outputPath = resolve(runtimeDir, 'attestation.json');

const sha256 = (value) =>
  createHash('sha256').update(value).digest('hex');

function packageIdentity(key) {
  const match = /^(@deepseek-ai\/[^@]+)@([^()]+)(?:\(.*\))?$/.exec(key);
  if (!match) return null;
  return { name: match[1], version: match[2] };
}

const lockBytes = await readFile(lockPath);
const lock = parse(lockBytes.toString('utf8'));
const packages = Object.entries(lock.packages ?? {})
  .map(([key, value]) => {
    const identity = packageIdentity(key);
    if (!identity) return null;
    const integrity = value?.resolution?.integrity;
    if (typeof integrity !== 'string' || !integrity.startsWith('sha512-')) {
      throw new Error(`missing sha512 integrity for ${key}`);
    }
    return { ...identity, integrity };
  })
  .filter(Boolean)
  .sort((left, right) =>
    left.name.localeCompare(right.name) ||
    left.version.localeCompare(right.version)
  );

if (packages.length < 100) {
  throw new Error('critical @deepseek-ai dependency closure is unexpectedly small');
}

const attestation = {
  schemaVersion: 1,
  baseline: '@deepseek-ai/dsh@0.1.0-rc.6',
  capturedAt: '2026-08-15T00:00:00.000Z',
  packageManager: {
    name: 'pnpm',
    version: '11.7.0',
    integrity:
      'sha512-GcyFLBIMcSV2DyRD7mvgyltA+fUFmN4aCaHxd1A+AQ5Xwjx3ZG4B52HeWb+HT7IqM5jDOrlpH8E+uUa28PTWIA==',
    shasum: 'bea54364524dadf0a42dae28dbfeeab25ff177e5',
  },
  lockfile: {
    path: 'runtime/pnpm-lock.yaml',
    sha256: sha256(lockBytes),
  },
  dshPackage: {
    name: '@deepseek-ai/dsh',
    version: '0.1.0-rc.6',
    integrity:
      'sha512-brpZfED7ieRa2PQ5tUxMhHrM1pb2CmKFVM/f6yMULBDMicahk+Z2OsHgTwTDnoiZm23Ftu9rQz0NN4pflaoJcg==',
    shasum: 'de9fbf39056c7f4e658a3e284cb1d66ebc86d040',
  },
  uiThemePackage: {
    name: '@deepseek-ai/dsh-client-ui-theme',
    version: '0.1.0-rc.6',
    integrity:
      'sha512-Wu+bvnuti/gLA+t5a2cWUMQJ5UCqxt6oEK+OJiJ68gN0ixs2skpaN0nFdFoY2exC5KByXrNlN1rRrD+FsZSBLA==',
    shasum: '8d5ce1a68e594897aab93d29bec8b2b933533035',
  },
  webFrontend: {
    name: '@deepseek-ai/dsh-web-frontend',
    version: '0.1.0-rc.6',
    integrity:
      'sha512-+RpdDF11FqUZSbJGoZ4oLIk/4PJR+ynTS4ELMn9QqucbYZ8tv0Itq9ZtG2o6pKIe7NO0lj/eBjCR2EoRKx7L+g==',
    mainBundlePath: 'dist/assets/index-Dqw48FrP.js',
    mainBundleSha256:
      'a40165a9916acf9c5710e440842c9a56bc472ae9991f37f4675a7664ae784d68',
    mainStylesheetPath: 'dist/assets/index-CSGf6Qzd.css',
    mainStylesheetSha256:
      '8ecb4b25268f5acae7e6f1b9e5cc8d14e5c5fa17da70a6a7863c896496f257ea',
  },
  criticalPackages: packages,
  acceptance: {
    profile: 'web',
    telemetry: 'disabled',
    allowedHosts: ['127.0.0.1', '::1'],
    forbiddenHosts: ['0.0.0.0'],
  },
};

await writeFile(outputPath, `${JSON.stringify(attestation, null, 2)}\n`, {
  mode: 0o644,
});
process.stdout.write(
  `${JSON.stringify({ output: outputPath, sha256: sha256(await readFile(outputPath)), criticalPackages: packages.length })}\n`
);
