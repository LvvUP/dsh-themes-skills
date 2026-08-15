#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse } from '../runtime/node_modules/yaml/dist/index.js';

const skillDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeDir = resolve(skillDir, 'runtime');
const EXPECTED_ATTESTATION_SHA256 =
  '2400606c5cb6534e09a65020e4ae12a0df4c1d08f15918d714bc5037c2ed99ba';
const EXPECTED_LOCK_SHA256 =
  '22f995efe8338c2a3cd97bd731853d010363531145c35073adb2dca3773f6053';
const SHA512 = /^sha512-[A-Za-z0-9+/]+={0,2}$/;
const quiet = process.argv.length === 3 && process.argv[2] === '--quiet';
if (process.argv.length > (quiet ? 3 : 2)) {
  throw new Error('Usage: verify-runner.mjs [--quiet]');
}

const sha256 = (value) =>
  createHash('sha256').update(value).digest('hex');

function fail(message) {
  throw new Error(message);
}

function packageIdentity(key) {
  const match = /^(@deepseek-ai\/[^@]+)@([^()]+)(?:\(.*\))?$/.exec(key);
  return match ? { name: match[1], version: match[2] } : null;
}

const [attestationBytes, lockBytes, dshPackage, pnpmPackage] =
  await Promise.all([
    readFile(resolve(runtimeDir, 'attestation.json')),
    readFile(resolve(runtimeDir, 'pnpm-lock.yaml')),
    readFile(resolve(runtimeDir, 'node_modules/@deepseek-ai/dsh/package.json'), 'utf8'),
    readFile(resolve(runtimeDir, 'node_modules/pnpm/package.json'), 'utf8'),
  ]).catch(() =>
    fail(
      'verified runner is not bootstrapped; run the exact frozen installation command from compatibility.md'
    )
  );

if (sha256(attestationBytes) !== EXPECTED_ATTESTATION_SHA256) {
  fail('runner attestation digest does not match the certified baseline');
}
if (sha256(lockBytes) !== EXPECTED_LOCK_SHA256) {
  fail('runner lockfile digest does not match the certified baseline');
}

const attestation = JSON.parse(attestationBytes.toString('utf8'));
if (
  attestation?.schemaVersion !== 1 ||
  attestation?.lockfile?.sha256 !== EXPECTED_LOCK_SHA256 ||
  attestation?.packageManager?.version !== '11.7.0' ||
  attestation?.packageManager?.integrity !==
    'sha512-GcyFLBIMcSV2DyRD7mvgyltA+fUFmN4aCaHxd1A+AQ5Xwjx3ZG4B52HeWb+HT7IqM5jDOrlpH8E+uUa28PTWIA==' ||
  attestation?.dshPackage?.version !== '0.1.0-rc.6' ||
  attestation?.dshPackage?.integrity !==
    'sha512-brpZfED7ieRa2PQ5tUxMhHrM1pb2CmKFVM/f6yMULBDMicahk+Z2OsHgTwTDnoiZm23Ftu9rQz0NN4pflaoJcg=='
) {
  fail('runner attestation fields do not match the certified baseline');
}

const lock = parse(lockBytes.toString('utf8'));
const lockedPackages = new Map();
for (const [key, value] of Object.entries(lock.packages ?? {})) {
  const identity = packageIdentity(key);
  if (!identity) continue;
  const integrity = value?.resolution?.integrity;
  if (!SHA512.test(integrity ?? '')) {
    fail(`lockfile is missing SHA-512 integrity for ${key}`);
  }
  lockedPackages.set(`${identity.name}@${identity.version}`, integrity);
}

if (
  !Array.isArray(attestation.criticalPackages) ||
  attestation.criticalPackages.length !== lockedPackages.size ||
  lockedPackages.size < 100
) {
  fail('critical dependency closure is incomplete');
}
for (const entry of attestation.criticalPackages) {
  const key = `${entry.name}@${entry.version}`;
  if (lockedPackages.get(key) !== entry.integrity) {
    fail(`critical dependency closure differs at ${key}`);
  }
}

if (JSON.parse(dshPackage).version !== '0.1.0-rc.6') {
  fail('installed DSH CLI version differs from the attested runner');
}
if (JSON.parse(pnpmPackage).version !== '11.7.0') {
  fail('installed pnpm version differs from the attested runner');
}

if (!quiet) {
  process.stdout.write(
    `${JSON.stringify({
      status: 'verified',
      attestationSha256: EXPECTED_ATTESTATION_SHA256,
      lockfileSha256: EXPECTED_LOCK_SHA256,
      pnpmVersion: '11.7.0',
      dshVersion: '0.1.0-rc.6',
      criticalPackages: lockedPackages.size,
    })}\n`
  );
}
