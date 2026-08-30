#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { lstat, readFile, readdir, realpath } from 'node:fs/promises';
import { isAbsolute, join, relative } from 'node:path';

import { validateWebProfile } from './profile-snapshot.mjs';

const MAX_PACKAGE_MANIFESTS = 20_000;

function fail(message) {
  throw new Error(message);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

async function installedPackageSet(profile, dependencies) {
  const modules = join(profile, 'node_modules');
  let modulesRoot;
  try {
    const stat = await lstat(modules);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail('profile node_modules must be a real directory');
    modulesRoot = await realpath(modules);
  } catch (error) {
    if (error.code === 'ENOENT' && Object.keys(dependencies).length === 0) return [];
    throw error;
  }
  const packages = new Set();
  const pending = [modulesRoot];
  let manifests = 0;
  while (pending.length > 0) {
    const directory = pending.pop();
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const path = join(directory, entry.name);
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        pending.push(path);
      } else if (entry.isFile() && entry.name === 'package.json') {
        manifests += 1;
        if (manifests > MAX_PACKAGE_MANIFESTS) fail('profile dependency closure exceeds the package-manifest limit');
        let manifest;
        try {
          manifest = JSON.parse(await readFile(path, 'utf8'));
        } catch (error) {
          fail(`installed package manifest is invalid: ${error.message}`);
        }
        if (typeof manifest.name === 'string' && typeof manifest.version === 'string') {
          packages.add(`${manifest.name}@${manifest.version}`);
        }
      }
    }
  }
  for (const name of Object.keys(dependencies)) {
    const packageManifest = join(modulesRoot, ...name.split('/'), 'package.json');
    const target = await realpath(packageManifest);
    const inside = relative(modulesRoot, target);
    if (inside.startsWith('..') || isAbsolute(inside)) fail(`installed dependency ${name} escapes node_modules`);
    const installed = JSON.parse(await readFile(target, 'utf8'));
    if (installed.name !== name || typeof installed.version !== 'string') {
      fail(`installed dependency ${name} has the wrong identity`);
    }
  }
  return [...packages].sort();
}

export async function captureProfileClosure(profileInput) {
  const profile = await validateWebProfile(profileInput);
  const manifest = JSON.parse(await readFile(join(profile, 'package.json'), 'utf8'));
  const dependencies = manifest.dependencies ?? {};
  if (dependencies === null || typeof dependencies !== 'object' || Array.isArray(dependencies) ||
      Object.entries(dependencies).some(([name, version]) =>
        typeof name !== 'string' || typeof version !== 'string')) {
    fail('profile dependencies must be a string-to-string mapping');
  }
  const state = {
    dependencies: stable(dependencies),
    bundles: [...manifest.dsh.profile.bundles],
    lockfileSha256: sha256(await readFile(join(profile, 'pnpm-lock.yaml'))),
    installedPackages: await installedPackageSet(profile, dependencies),
  };
  const bytes = Buffer.from(`${JSON.stringify(stable(state))}\n`, 'utf8');
  return { ...state, closureSha256: sha256(bytes) };
}

export async function verifyProfileClosure(profile, expected) {
  const actual = await captureProfileClosure(profile);
  return {
    matches: JSON.stringify(actual) === JSON.stringify(expected),
    actual,
  };
}
