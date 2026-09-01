#!/usr/bin/env node

import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { lstat, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve as resolvePath } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isAlias, isMap, isPair, isScalar, isSeq, parseDocument } from 'yaml';

import { validateItem } from './authority.mjs';
import { pnpmCommandShimShell } from './pnpm-binding.mjs';
import { validateWebProfile } from './profile-snapshot.mjs';

const MAX_WORKSPACE_YAML_BYTES = 64 * 1024;
const MAX_WORKSPACE_YAML_LINES = 2048;
const MAX_WORKSPACE_YAML_LINE_BYTES = 4096;
const MAX_WORKSPACE_YAML_AST_DEPTH = 32;
const MAX_WORKSPACE_YAML_AST_NODES = 2048;
const MAX_LOCKFILE_BYTES = 16 * 1024 * 1024;
const MAX_LOCKFILE_LINES = 400_000;
const MAX_LOCKFILE_LINE_BYTES = 16 * 1024;
const MAX_LOCKFILE_AST_DEPTH = 64;
const MAX_LOCKFILE_AST_NODES = 400_000;
const MAX_PNPM_CONFIG_OUTPUT_BYTES = 64 * 1024;
const INSTALLER_OWNED_ALLOW_BUILDS_COMMENT = 'dsh-plugin-installer-owned-v1';
const EFFECTIVE_POLICY_KEYS = new Set([
  'allowBuilds',
  'dangerouslyAllowAllBuilds',
  'strictDepBuilds',
]);

function fail(message) {
  throw new Error(message);
}

function policyKey(key, label) {
  if (typeof key !== 'string' || key.length < 1 || key.length > 4096 ||
      /[\0\r\n\t]/u.test(key)) {
    fail(`${label} is malformed`);
  }
  return key;
}

function validateResolvedPolicy(items, resolvedPolicy) {
  if (!Array.isArray(items)) fail('lifecycle policy items must be an array');
  for (const [index, item] of items.entries()) validateItem(item, index);
  if (items.length === 0 && resolvedPolicy === undefined) {
    return { authorized: [], denied: [], direct: [] };
  }
  if (resolvedPolicy === null || typeof resolvedPolicy !== 'object' || Array.isArray(resolvedPolicy) ||
      JSON.stringify(Object.keys(resolvedPolicy).sort()) !==
      JSON.stringify(['authorizedKeys', 'deniedKeys', 'directKeys', 'schemaVersion'].sort()) ||
      resolvedPolicy.schemaVersion !== 2 || !Array.isArray(resolvedPolicy.authorizedKeys) ||
      !Array.isArray(resolvedPolicy.deniedKeys) || !Array.isArray(resolvedPolicy.directKeys)) {
    fail('resolved pnpm lifecycle policy is malformed');
  }
  const canonicalKeys = (values, label) => {
    const keys = values.map((key) => policyKey(key, label));
    const canonical = [...new Set(keys)].sort();
    if (JSON.stringify(keys) !== JSON.stringify(canonical)) {
      fail(`${label} must be sorted and unique`);
    }
    return canonical;
  };
  const authorized = canonicalKeys(resolvedPolicy.authorizedKeys, 'authorized pnpm depPath');
  const denied = canonicalKeys(resolvedPolicy.deniedKeys, 'denied pnpm depPath');
  if (authorized.some((key) => denied.includes(key))) {
    fail('one pnpm depPath cannot be both lifecycle-authorized and lifecycle-denied');
  }
  const direct = resolvedPolicy.directKeys.map((entry) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry) ||
        JSON.stringify(Object.keys(entry).sort()) !==
          JSON.stringify(['catalogId', 'packageName', 'policyKey', 'snapshotKey'].sort()) ||
        !Number.isSafeInteger(entry.catalogId)) {
      fail('resolved direct pnpm depPath entry is malformed');
    }
    return {
      catalogId: entry.catalogId,
      policyKey: policyKey(entry.policyKey, 'resolved direct pnpm policy depPath'),
      packageName: entry.packageName,
      snapshotKey: policyKey(entry.snapshotKey, 'resolved direct pnpm snapshot depPath'),
    };
  });
  const expectedIds = items.map((item) => item.catalogId).sort((left, right) => left - right);
  const actualIds = direct.map((entry) => entry.catalogId).sort((left, right) => left - right);
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds) ||
      new Set(direct.map((entry) => entry.catalogId)).size !== direct.length) {
    fail('resolved direct pnpm depPaths do not cover the exact authority items');
  }
  if (JSON.stringify(direct.map((entry) => entry.catalogId)) !== JSON.stringify(expectedIds)) {
    fail('resolved direct pnpm depPaths must follow canonical catalog order');
  }
  for (const item of items) {
    const entry = direct.find((candidate) => candidate.catalogId === item.catalogId);
    if (entry.packageName !== item.package.name) {
      fail(`resolved direct pnpm depPath package mismatch for #${item.catalogId}`);
    }
    if (entry.policyKey !== removePeersSuffix(entry.snapshotKey)) {
      fail(`resolved direct pnpm policy identity mismatch for #${item.catalogId}`);
    }
    const required = item.package.lifecycleAuthorization.required;
    if ((required && (!authorized.includes(entry.policyKey) || denied.includes(entry.policyKey))) ||
        (!required && (!denied.includes(entry.policyKey) || authorized.includes(entry.policyKey)))) {
      fail(`resolved direct pnpm depPath policy mismatch for #${item.catalogId}`);
    }
  }
  if (authorized.some((key) => !direct.some((entry) => entry.policyKey === key))) {
    fail('only direct reviewed plugin depPaths may be lifecycle-authorized');
  }
  return { authorized, denied, direct };
}

function inspectYamlNode(
  node,
  state = {
    seen: new Set(), nodes: 0,
    maxDepth: MAX_WORKSPACE_YAML_AST_DEPTH,
    maxNodes: MAX_WORKSPACE_YAML_AST_NODES,
    label: 'profile workspace YAML',
  },
  depth = 0
) {
  if (node === null || node === undefined) return;
  if (isAlias(node)) fail('profile workspace YAML aliases are forbidden');
  if (typeof node !== 'object') return;
  if (depth > state.maxDepth) fail(`${state.label} AST is too deep`);
  state.nodes += 1;
  if (state.nodes > state.maxNodes) fail(`${state.label} has too many AST nodes`);
  if (state.seen.has(node)) fail(`${state.label} contains a cyclic node`);
  state.seen.add(node);
  if (node.tag) fail(`${state.label} custom or explicit tags are forbidden`);
  if (isPair(node)) {
    if (isScalar(node.key) && node.key.value === '<<') fail(`${state.label} merge keys are forbidden`);
    inspectYamlNode(node.key, state, depth + 1);
    inspectYamlNode(node.value, state, depth + 1);
  } else if (Array.isArray(node.items)) {
    for (const item of node.items) inspectYamlNode(item, state, depth + 1);
  }
  state.seen.delete(node);
}

function parseStrictDocument(source, limits) {
  if (typeof source !== 'string' || source.includes('\0') || source.includes('\r') || source.includes('\t')) {
    fail(`${limits.label} must be LF-only text without tabs or NUL`);
  }
  const bytes = Buffer.byteLength(source, 'utf8');
  if (bytes < 1 || bytes > limits.maxBytes) {
    fail(`${limits.label} byte size is outside its strict limit`);
  }
  const lines = source.split('\n');
  if (lines.length > limits.maxLines ||
      lines.some((line) => Buffer.byteLength(line, 'utf8') > limits.maxLineBytes)) {
    fail(`${limits.label} has too many lines or an oversized line`);
  }
  let document;
  try {
    document = parseDocument(source, {
      merge: false,
      prettyErrors: false,
      strict: true,
      uniqueKeys: true,
    });
  } catch (error) {
    fail(`${limits.label} parse failed: ${error.message}`);
  }
  if (document.errors.length > 0) {
    fail(`${limits.label} is invalid: ${document.errors[0].message}`);
  }
  if (!isMap(document.contents)) fail(`${limits.label} root must be a mapping`);
  inspectYamlNode(document.contents, {
    seen: new Set(),
    nodes: 0,
    maxDepth: limits.maxDepth,
    maxNodes: limits.maxNodes,
    label: limits.label,
  });
  return document;
}

function parseWorkspace(source) {
  return parseStrictDocument(source, {
    label: 'profile workspace YAML',
    maxBytes: MAX_WORKSPACE_YAML_BYTES,
    maxLines: MAX_WORKSPACE_YAML_LINES,
    maxLineBytes: MAX_WORKSPACE_YAML_LINE_BYTES,
    maxDepth: MAX_WORKSPACE_YAML_AST_DEPTH,
    maxNodes: MAX_WORKSPACE_YAML_AST_NODES,
  });
}

function assertCanonicalWorkspaceShape(document) {
  const allowed = new Set([
    'allowBuilds', 'autoInstallPeers', 'dangerouslyAllowAllBuilds', 'nodeLinker',
    'packages', 'strictDepBuilds',
  ]);
  for (const pair of document.contents.items) {
    const key = strictScalarString(pair.key, 'profile workspace top-level key');
    if (!allowed.has(key)) {
      fail(`profile workspace setting ${key} is outside the fixed resolution surface`);
    }
  }
  const packages = document.get('packages', true);
  if (!isSeq(packages) || packages.items.length !== 1 ||
      !isScalar(packages.items[0]) || packages.items[0].value !== '.') {
    fail('profile workspace packages must be exactly the profile root');
  }
  const nodeLinker = document.get('nodeLinker', true);
  if (!isScalar(nodeLinker) || nodeLinker.value !== 'hoisted') {
    fail('profile workspace nodeLinker must be hoisted');
  }
  const autoInstallPeers = document.get('autoInstallPeers', true);
  if (!isScalar(autoInstallPeers) || autoInstallPeers.value !== false) {
    fail('profile workspace autoInstallPeers must be false');
  }
  allowBuildEntries(document);
  for (const [key, expected] of [
    ['dangerouslyAllowAllBuilds', false],
    ['strictDepBuilds', true],
  ]) {
    const node = document.get(key, true);
    if (node !== undefined && (!isScalar(node) || node.value !== expected)) {
      fail(`profile workspace ${key} must be the literal boolean ${expected}`);
    }
  }
}

export async function validateProfileResolutionSurface(profileInput) {
  const profile = await validateWebProfile(profileInput);
  const workspace = join(profile, 'pnpm-workspace.yaml');
  const document = parseWorkspace(await readFile(workspace, 'utf8'));
  assertCanonicalWorkspaceShape(document);
  const manifestBytes = await readFile(join(profile, 'package.json'));
  if (manifestBytes.length < 2 || manifestBytes.length > 256 * 1024) {
    fail('profile package manifest is outside its strict size limit');
  }
  let manifest;
  try {
    manifest = JSON.parse(manifestBytes.toString('utf8'));
  } catch (error) {
    fail(`profile package manifest is invalid JSON: ${error.message}`);
  }
  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    fail('profile package manifest root must be an object');
  }
  const forbiddenManifestKeys = [
    'bundleDependencies', 'bundledDependencies', 'devDependencies', 'optionalDependencies',
    'packageManager', 'pnpm', 'resolutions', 'scripts',
  ];
  const forbidden = forbiddenManifestKeys.find((key) => Object.hasOwn(manifest, key));
  if (forbidden) fail(`profile package manifest ${forbidden} is outside the fixed resolution surface`);
  for (const name of [
    '.npmrc', '.pnpmfile.cjs', '.pnpmfile.js', 'pnpmfile.cjs', 'pnpmfile.js', 'pnpmfile.mjs',
  ]) {
    try {
      await lstat(join(profile, name));
      fail(`profile project configuration ${name} is forbidden during verified installation`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  return { profile, workspace };
}

function strictMapEntry(map, key, label) {
  if (!isMap(map)) fail(`${label} must be a mapping`);
  const value = map.get(key, true);
  if (value === undefined) fail(`${label} is missing ${key}`);
  return value;
}

function strictScalarString(node, label) {
  if (!isScalar(node) || typeof node.value !== 'string') fail(`${label} must be a string scalar`);
  return node.value;
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  }
  return value;
}

function nodeFingerprint(node) {
  return JSON.stringify(stableValue(node.toJSON()));
}

// Mirrors pnpm 11.7.0's removePeersSuffix/indexOfDepPathSuffix behavior.
// A trailing patch hash stays part of the package identity; only the peer
// graph suffix is removed when matching a packages entry.
function removePeersSuffix(depPath) {
  if (!depPath.endsWith(')')) return depPath;
  let open = 1;
  for (let index = depPath.length - 2; index >= 0; index -= 1) {
    if (depPath[index] === '(') open -= 1;
    else if (depPath[index] === ')') open += 1;
    else if (open === 0) {
      const suffixStart = index + 1;
      if (depPath.slice(suffixStart).startsWith('(patch_hash=')) {
        const peersIndex = depPath.indexOf('(', suffixStart + 1);
        return peersIndex === -1 ? depPath : depPath.slice(0, peersIndex);
      }
      return depPath.slice(0, suffixStart);
    }
  }
  return depPath;
}

// Mirrors pnpm 11.7.0's refToRelative. The importer version may already be a
// complete depPath (including an alias); blindly prefixing the package name
// would create a different authority key.
function refToRelative(reference, packageName) {
  if (reference.startsWith('link:')) return null;
  if (reference[0] === '@') return reference;
  const atIndex = reference.indexOf('@');
  if (atIndex === -1) return `${packageName}@${reference}`;
  const colonIndex = reference.indexOf(':');
  const bracketIndex = reference.indexOf('(');
  if ((colonIndex === -1 || atIndex < colonIndex) &&
      (bracketIndex === -1 || atIndex < bracketIndex)) {
    return reference;
  }
  return `${packageName}@${reference}`;
}

function strictLockMap(root, key, { optional = false } = {}) {
  const value = root.get(key, true);
  if (value === undefined && optional) return new Map();
  if (value === undefined) fail(`profile pnpm lockfile is missing ${key}`);
  if (!isMap(value)) fail(`profile pnpm lockfile ${key} must be a mapping`);
  const entries = new Map();
  for (const pair of value.items) {
    const entryKey = strictScalarString(pair.key, `profile pnpm lockfile ${key} key`);
    policyKey(entryKey, `profile pnpm lockfile ${key} key`);
    if (!isMap(pair.value)) {
      fail(`profile pnpm lockfile ${key} entry ${entryKey} must be a mapping`);
    }
    entries.set(entryKey, { node: pair.value, fingerprint: nodeFingerprint(pair.value) });
  }
  return entries;
}

function expectedSpecifierSet(value) {
  const values = new Set([value]);
  if (isAbsolute(value) || /^[A-Za-z]:\\/u.test(value)) {
    values.add(`file:${value}`);
    values.add(`file:${value.replaceAll('\\', '/')}`);
  }
  if (value.startsWith('file://')) {
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      fail('expected file install spec is malformed');
    }
    if (parsed.protocol !== 'file:' || parsed.username || parsed.password || parsed.search || parsed.hash) {
      fail('expected file install spec is malformed');
    }
    values.add(`file:${parsed.pathname}`);
    try {
      values.add(`file:${decodeURIComponent(parsed.pathname)}`);
    } catch {
      fail('expected file install spec contains malformed percent encoding');
    }
  }
  return values;
}

function canonicalSha512Integrity(value, label) {
  if (typeof value !== 'string' || !/^sha512-[A-Za-z0-9+/]{86}==$/u.test(value)) {
    fail(`${label} must be one canonical SHA-512 integrity value`);
  }
  const encoded = value.slice('sha512-'.length);
  const digest = Buffer.from(encoded, 'base64');
  if (digest.length !== 64 || digest.toString('base64') !== encoded) {
    fail(`${label} must be one canonical SHA-512 integrity value`);
  }
  return value;
}

function githubSourceCoordinates(item) {
  const source = item.distribution?.source;
  if (item.distribution?.kind !== 'upstream-plugin-verified' || source?.type !== 'git-commit') {
    return null;
  }
  const match = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\.git$/u
    .exec(source.repository);
  if (!match) fail(`plugin #${item.catalogId} exact Git repository is malformed`);
  const [, owner, repository] = match;
  return {
    normalizedSpecifier: `github:${owner}/${repository}#${source.commit}`,
    tarball: `https://codeload.github.com/${owner}/${repository}/tar.gz/${source.commit}`,
  };
}

function expectedSourceBindings(items, expectedInstallSpecs, context) {
  if (context === null || typeof context !== 'object' || Array.isArray(context) ||
      JSON.stringify(Object.keys(context).sort()) !==
        JSON.stringify(['artifactIntegrities', 'profile'].sort()) ||
      typeof context.profile !== 'string' || !isAbsolute(context.profile) ||
      context.profile.includes('\0') || !Array.isArray(context.artifactIntegrities) ||
      context.artifactIntegrities.length !== items.length) {
    fail('resolved pnpm lockfile source-binding context is malformed');
  }
  return items.map((item, index) => {
    const installSpec = expectedInstallSpecs[index];
    const git = githubSourceCoordinates(item);
    if (git !== null) {
      if (installSpec !== item.distribution.source.installSpec ||
          context.artifactIntegrities[index] !== null) {
        fail(`resolved pnpm Git source binding is malformed for #${item.catalogId}`);
      }
      return {
        kind: 'github-git',
        packageLocator: git.tarball,
        resolutionIntegrity: null,
        resolutionTarball: git.tarball,
        specifiers: new Set([installSpec, git.normalizedSpecifier]),
      };
    }
    if (!isAbsolute(installSpec)) {
      fail(`resolved pnpm artifact source must be absolute for #${item.catalogId}`);
    }
    const artifactRelative = relative(context.profile, installSpec);
    if (artifactRelative === '' || isAbsolute(artifactRelative) ||
        /^[A-Za-z]:[\\/]/u.test(artifactRelative) || artifactRelative.includes('\0')) {
      fail(`resolved pnpm artifact source must be profile-relative for #${item.catalogId}`);
    }
    const locator = `file:${artifactRelative.replaceAll('\\', '/')}`;
    return {
      kind: 'local-tarball',
      packageLocator: locator,
      resolutionIntegrity: canonicalSha512Integrity(
        context.artifactIntegrities[index],
        `resolved pnpm artifact integrity for #${item.catalogId}`
      ),
      resolutionTarball: locator,
      specifiers: expectedSpecifierSet(installSpec),
    };
  });
}

function exactMapKeys(map, expected, label) {
  if (!isMap(map)) fail(`${label} must be a mapping`);
  const actual = map.items.map((pair) => strictScalarString(pair.key, `${label} key`)).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
    fail(`${label} fields do not match the exact source type`);
  }
}

function validateDirectSourceResolution(item, binding, packageKey, packageEntry) {
  const expectedPackageKey = `${item.package.name}@${binding.packageLocator}`;
  if (packageKey !== expectedPackageKey) {
    fail(`profile pnpm lockfile source locator mismatch for #${item.catalogId}`);
  }
  const label = `profile pnpm lockfile package ${packageKey} resolution`;
  const resolution = strictMapEntry(packageEntry, 'resolution', `profile pnpm lockfile package ${packageKey}`);
  const expectedFields = binding.kind === 'github-git'
    ? ['gitHosted', 'integrity', 'tarball']
    : ['integrity', 'tarball'];
  exactMapKeys(resolution, expectedFields, label);
  const tarball = strictScalarString(strictMapEntry(resolution, 'tarball', label), `${label} tarball`);
  const integrity = strictScalarString(strictMapEntry(resolution, 'integrity', label), `${label} integrity`);
  if (tarball !== binding.resolutionTarball) {
    fail(`profile pnpm lockfile resolution tarball mismatch for #${item.catalogId}`);
  }
  canonicalSha512Integrity(integrity, `${label} integrity`);
  if (binding.kind === 'local-tarball' && integrity !== binding.resolutionIntegrity) {
    fail(`profile pnpm lockfile resolution integrity mismatch for #${item.catalogId}`);
  }
  if (binding.kind === 'github-git') {
    const gitHosted = strictMapEntry(resolution, 'gitHosted', label);
    if (!isScalar(gitHosted) || gitHosted.value !== true) {
      fail(`profile pnpm lockfile resolution gitHosted mismatch for #${item.catalogId}`);
    }
  }
}

function parsePnpmLock(
  source,
  items = [],
  expectedInstallSpecs = null,
  expectedSourceContext = null
) {
  const document = parseStrictDocument(source, {
    label: 'profile pnpm lockfile',
    maxBytes: MAX_LOCKFILE_BYTES,
    maxLines: MAX_LOCKFILE_LINES,
    maxLineBytes: MAX_LOCKFILE_LINE_BYTES,
    maxDepth: MAX_LOCKFILE_AST_DEPTH,
    maxNodes: MAX_LOCKFILE_AST_NODES,
  });
  const root = document.contents;
  const lockfileVersion = root.get('lockfileVersion', true);
  if (!isScalar(lockfileVersion) || lockfileVersion.value !== '9.0') {
    fail("profile pnpm lockfile version must be exactly '9.0'");
  }
  const packageEntries = strictLockMap(root, 'packages', { optional: items.length === 0 });
  const snapshotEntries = strictLockMap(root, 'snapshots', { optional: items.length === 0 });
  const directKeys = [];
  if (items.length > 0) {
    if (expectedInstallSpecs !== null &&
        (!Array.isArray(expectedInstallSpecs) || expectedInstallSpecs.length !== items.length ||
          expectedInstallSpecs.some((value) => typeof value !== 'string' || value.length < 1 ||
            value.length > 4096 || /[\0\r\n\t]/u.test(value)))) {
      fail('resolved pnpm lockfile requires exact install specs for every authority item');
    }
    const sourceBindings = expectedInstallSpecs === null
      ? null
      : expectedSourceBindings(items, expectedInstallSpecs, expectedSourceContext);
    const importers = strictMapEntry(root, 'importers', 'profile pnpm lockfile');
    const rootImporter = strictMapEntry(importers, '.', 'profile pnpm lockfile importers');
    const dependencies = strictMapEntry(rootImporter, 'dependencies', 'profile pnpm lockfile root importer');
    for (const item of items) {
      const dependency = strictMapEntry(
        dependencies,
        item.package.name,
        'profile pnpm lockfile root importer dependencies'
      );
      if (!isMap(dependency)) {
        fail(`profile pnpm lockfile direct dependency ${item.package.name} must be a mapping`);
      }
      const specifier = strictScalarString(
        strictMapEntry(dependency, 'specifier', `profile pnpm lockfile dependency ${item.package.name}`),
        `profile pnpm lockfile dependency ${item.package.name} specifier`
      );
      const sourceBinding = sourceBindings?.[directKeys.length] ?? null;
      if (sourceBinding !== null && !sourceBinding.specifiers.has(specifier)) {
        fail(`profile pnpm lockfile install specifier mismatch for #${item.catalogId}`);
      }
      const versionReference = strictScalarString(
        strictMapEntry(dependency, 'version', `profile pnpm lockfile dependency ${item.package.name}`),
        `profile pnpm lockfile dependency ${item.package.name} version`
      );
      const relative = refToRelative(versionReference, item.package.name);
      if (relative === null) fail(`profile pnpm lockfile link dependency is forbidden for #${item.catalogId}`);
      const snapshotKey = policyKey(relative, `profile pnpm lockfile direct depPath for #${item.catalogId}`);
      if (!snapshotEntries.has(snapshotKey)) {
        fail(`profile pnpm lockfile has no exact snapshot entry for #${item.catalogId}`);
      }
      const packageKey = removePeersSuffix(snapshotKey);
      const packageEntry = packageEntries.get(packageKey)?.node;
      if (!isMap(packageEntry)) fail(`profile pnpm lockfile has no exact package entry for #${item.catalogId}`);
      const manifestVersion = strictScalarString(
        strictMapEntry(packageEntry, 'version', `profile pnpm lockfile package ${packageKey}`),
        `profile pnpm lockfile package ${packageKey} version`
      );
      if (manifestVersion !== item.package.version) {
        fail(`profile pnpm lockfile version mismatch for #${item.catalogId}`);
      }
      if (sourceBinding !== null) {
        validateDirectSourceResolution(item, sourceBinding, packageKey, packageEntry);
      }
      directKeys.push({
        catalogId: item.catalogId,
        packageName: item.package.name,
        policyKey: packageKey,
        snapshotKey,
      });
    }
  }
  return {
    directKeys: directKeys.sort((left, right) => left.catalogId - right.catalogId),
    packageEntries,
    snapshotEntries,
  };
}

export function resolvePnpmLifecyclePolicy(
  baselineLockSource,
  resolvedLockSource,
  items,
  expectedInstallSpecs,
  expectedSourceContext
) {
  if (!Array.isArray(items) || items.length === 0) fail('pnpm lifecycle resolution requires authority items');
  if (!Array.isArray(expectedInstallSpecs) || expectedInstallSpecs.length !== items.length) {
    fail('pnpm lifecycle resolution requires exact install specs');
  }
  for (const [index, item] of items.entries()) validateItem(item, index);
  const executable = items.find((item) => item.package.lifecycleAuthorization.required);
  if (executable) {
    fail(`plugin #${executable.catalogId} requires a live lifecycle build, which this transaction forbids`);
  }
  const baseline = parsePnpmLock(baselineLockSource);
  const resolved = parsePnpmLock(
    resolvedLockSource,
    items,
    expectedInstallSpecs,
    expectedSourceContext
  );
  const denied = new Set();
  const changedPackageKeys = new Set();
  for (const [key, entry] of resolved.packageEntries) {
    if (baseline.packageEntries.get(key)?.fingerprint !== entry.fingerprint) {
      changedPackageKeys.add(key);
    }
  }
  for (const [key, entry] of resolved.snapshotEntries) {
    if (baseline.snapshotEntries.get(key)?.fingerprint !== entry.fingerprint ||
        changedPackageKeys.has(removePeersSuffix(key))) {
      denied.add(removePeersSuffix(key));
    }
  }
  for (const packageKey of changedPackageKeys) {
    if (![...resolved.snapshotEntries.keys()].some((key) => removePeersSuffix(key) === packageKey)) {
      fail(`changed pnpm package ${packageKey} has no bound snapshot depPath`);
    }
  }
  for (const entry of resolved.directKeys) {
    denied.add(entry.policyKey);
  }
  const policy = {
    schemaVersion: 2,
    directKeys: resolved.directKeys,
    authorizedKeys: [],
    deniedKeys: [...denied].sort(),
  };
  validateResolvedPolicy(items, policy);
  return policy;
}

export function resolveCurrentDirectLifecyclePolicy(lockSource, items, expectedInstallSpecs) {
  if (!Array.isArray(items) || items.length === 0) fail('current pnpm lifecycle resolution requires authority items');
  for (const [index, item] of items.entries()) validateItem(item, index);
  const resolved = parsePnpmLock(lockSource, items, expectedInstallSpecs);
  const authorized = [];
  const denied = [];
  for (const entry of resolved.directKeys) {
    const item = items.find((candidate) => candidate.catalogId === entry.catalogId);
    (item.package.lifecycleAuthorization.required ? authorized : denied).push(entry.policyKey);
  }
  const policy = {
    schemaVersion: 2,
    directKeys: resolved.directKeys,
    authorizedKeys: authorized.sort(),
    deniedKeys: denied.sort(),
  };
  validateResolvedPolicy(items, policy);
  return policy;
}

function allowBuildEntries(document) {
  const allowBuilds = document.get('allowBuilds', true);
  if (allowBuilds === undefined) return null;
  if (!isMap(allowBuilds)) fail('profile allowBuilds must use a top-level block mapping');
  const entries = new Map();
  const pairs = new Map();
  for (const pair of allowBuilds.items) {
    if (!isScalar(pair.key) || typeof pair.key.value !== 'string' ||
        !isScalar(pair.value) || typeof pair.value.value !== 'boolean') {
      fail('profile allowBuilds must map literal package names to booleans');
    }
    if (entries.has(pair.key.value)) fail(`profile allowBuilds duplicates ${pair.key.value}`);
    entries.set(pair.key.value, pair.value.value);
    pairs.set(pair.key.value, pair);
  }
  return { entries, node: allowBuilds, pairs };
}

function installerOwnedFalse(pair) {
  return isScalar(pair?.value) && pair.value.value === false &&
    pair.value.comment === INSTALLER_OWNED_ALLOW_BUILDS_COMMENT;
}

function currentLockPolicyKeys(lockSource) {
  const parsed = parsePnpmLock(lockSource);
  const keys = new Set(parsed.packageEntries.keys());
  for (const snapshotKey of parsed.snapshotEntries.keys()) {
    keys.add(removePeersSuffix(snapshotKey));
  }
  return keys;
}

function requireSafeBooleanPolicy(document, key, expected) {
  const node = document.get(key, true);
  if (node === undefined) {
    document.set(key, expected);
    return;
  }
  if (!isScalar(node) || typeof node.value !== 'boolean') {
    fail(`profile ${key} must be the literal boolean ${expected}`);
  }
  if (node.value !== expected) {
    fail(`profile ${key}=${node.value} is an unsafe lifecycle build policy`);
  }
}

function enforceSafeBuildPolicy(document) {
  requireSafeBooleanPolicy(document, 'dangerouslyAllowAllBuilds', false);
  requireSafeBooleanPolicy(document, 'strictDepBuilds', true);
}

function normalizeWorkspace(document) {
  return document.toString({ lineWidth: 0 });
}

function parsePnpmConfigValue(result, key) {
  if (result?.error || result?.signal || result?.status !== 0 ||
      typeof result?.stdout !== 'string' || typeof result?.stderr !== 'string' ||
      result.stderr.trim() !== '' ||
      Buffer.byteLength(result.stdout, 'utf8') > MAX_PNPM_CONFIG_OUTPUT_BYTES) {
    fail(`unable to verify effective pnpm ${key} policy`);
  }
  try {
    return JSON.parse(result.stdout.trim());
  } catch {
    fail(`effective pnpm ${key} policy is not strict JSON`);
  }
}

function readEffectivePnpmConfig(profile, key, environment) {
  if (!EFFECTIVE_POLICY_KEYS.has(key)) fail('unsupported pnpm policy key');
  return parsePnpmConfigValue(spawnSync('pnpm', [
    'config', 'get', '--location', 'project', '--json', key,
  ], {
    cwd: profile,
    encoding: 'utf8',
    env: environment,
    maxBuffer: MAX_PNPM_CONFIG_OUTPUT_BYTES,
    // Node 24 refuses to execute Windows .cmd shims without a shell. The
    // command and every argument here come from the fixed policy-key set.
    shell: pnpmCommandShimShell(environment),
    windowsHide: true,
  }), key);
}

export function validateEffectivePnpmBuildPolicy(policy, keys, expectedAuthorized) {
  if (policy === null || typeof policy !== 'object' || Array.isArray(policy) ||
      Object.keys(policy).sort().join(',') !==
        ['allowBuilds', 'dangerouslyAllowAllBuilds', 'strictDepBuilds'].sort().join(',') ||
      !Array.isArray(keys) || typeof expectedAuthorized !== 'boolean') {
    fail('effective pnpm build policy input is malformed');
  }
  if (policy.dangerouslyAllowAllBuilds !== false || policy.strictDepBuilds !== true) {
    fail('effective pnpm build policy is unsafe');
  }
  if (policy.allowBuilds === null || typeof policy.allowBuilds !== 'object' ||
      Array.isArray(policy.allowBuilds) ||
      Object.values(policy.allowBuilds).some((value) => typeof value !== 'boolean')) {
    fail('effective pnpm allowBuilds policy is malformed');
  }
  for (const key of keys) {
    if (typeof key !== 'string' || key.length < 1 || key.length > 4096 || /[\0\r\n\t]/u.test(key)) {
      fail('effective pnpm lifecycle package key is malformed');
    }
    if (expectedAuthorized ? policy.allowBuilds[key] !== true : policy.allowBuilds[key] === true) {
      fail(`effective pnpm allowBuilds policy does not match ${key}`);
    }
  }
  return policy;
}

export function verifyEffectivePnpmBuildPolicy(
  profile,
  keys,
  expectedAuthorized,
  options
) {
  const environment = policyEnvironment(options);
  if (typeof profile !== 'string' || !isAbsolute(profile) || profile.includes('\0') ||
      environment === null || typeof environment !== 'object' || Array.isArray(environment)) {
    fail('effective pnpm policy verifier input is malformed');
  }
  const policy = {
    allowBuilds: keys.length === 0
      ? {}
      : readEffectivePnpmConfig(profile, 'allowBuilds', environment),
    dangerouslyAllowAllBuilds: readEffectivePnpmConfig(
      profile,
      'dangerouslyAllowAllBuilds',
      environment
    ),
    strictDepBuilds: readEffectivePnpmConfig(profile, 'strictDepBuilds', environment),
  };
  return validateEffectivePnpmBuildPolicy(policy, keys, expectedAuthorized);
}

export function authorizePrepareText(source, items, resolvedPolicy) {
  if (typeof source !== 'string' || source.includes('\0') || source.includes('\r') || source.includes('\t')) {
    fail('profile workspace YAML must be LF-only text without tabs or NUL');
  }
  const bytes = Buffer.byteLength(source, 'utf8');
  if (bytes < 1 || bytes > MAX_WORKSPACE_YAML_BYTES) {
    fail('profile workspace YAML byte size is outside the strict 1..65536 limit');
  }
  const lines = source.split('\n');
  if (lines.length > MAX_WORKSPACE_YAML_LINES ||
      lines.some((line) => Buffer.byteLength(line, 'utf8') > MAX_WORKSPACE_YAML_LINE_BYTES)) {
    fail('profile workspace YAML has too many lines or an oversized line');
  }
  const policyKeys = validateResolvedPolicy(items, resolvedPolicy);
  const keys = policyKeys.authorized;
  const deniedKeys = policyKeys.denied;
  if (keys.length > 0) {
    fail('live lifecycle builds are forbidden; use a prebuilt or script-free artifact');
  }
  const document = parseWorkspace(source);
  enforceSafeBuildPolicy(document);
  let current = allowBuildEntries(document);
  if (current === null && (keys.length > 0 || deniedKeys.length > 0)) {
    document.set('allowBuilds', document.createNode({}));
    current = allowBuildEntries(document);
  }
  if (current !== null) {
    for (const key of deniedKeys) {
      if (current.entries.get(key) === true) {
        fail(`lifecycle scripts for ${key} have an unexpected existing authorization`);
      }
    }
    for (const key of deniedKeys) {
      if (!current.entries.has(key)) {
        const value = document.createNode(false);
        value.comment = INSTALLER_OWNED_ALLOW_BUILDS_COMMENT;
        current.node.set(document.createNode(key), value);
      }
    }
    current.node.items.sort((left, right) => String(left.key.value).localeCompare(String(right.key.value), 'en'));
  }
  const normalized = normalizeWorkspace(document);
  parseWorkspace(normalized);
  return { changed: normalized !== source, deniedKeys, keys, source: normalized };
}

export function cleanupInstallerOwnedAllowBuildsText(source, lockSource) {
  const document = parseWorkspace(source);
  enforceSafeBuildPolicy(document);
  const reachable = currentLockPolicyKeys(lockSource);
  const current = allowBuildEntries(document);
  const removedKeys = [];
  if (current !== null) {
    for (const [key, pair] of current.pairs) {
      if (installerOwnedFalse(pair) && !reachable.has(key)) {
        current.node.delete(key);
        removedKeys.push(key);
      }
    }
    current.node.items.sort((left, right) =>
      String(left.key.value).localeCompare(String(right.key.value), 'en'));
  }
  removedKeys.sort();
  if (removedKeys.length === 0) {
    return { changed: false, removedKeys, source };
  }
  const normalized = normalizeWorkspace(document);
  parseWorkspace(normalized);
  return { changed: true, removedKeys, source: normalized };
}

export function revokePrepareText(source, items, resolvedPolicy) {
  if (typeof source !== 'string' || source.includes('\0') || source.includes('\r') || source.includes('\t')) {
    fail('profile workspace YAML must be LF-only text without tabs or NUL');
  }
  const bytes = Buffer.byteLength(source, 'utf8');
  if (bytes < 1 || bytes > MAX_WORKSPACE_YAML_BYTES) {
    fail('profile workspace YAML byte size is outside the strict 1..65536 limit');
  }
  const lines = source.split('\n');
  if (lines.length > MAX_WORKSPACE_YAML_LINES ||
      lines.some((line) => Buffer.byteLength(line, 'utf8') > MAX_WORKSPACE_YAML_LINE_BYTES)) {
    fail('profile workspace YAML has too many lines or an oversized line');
  }
  const { authorized: keys } = validateResolvedPolicy(items, resolvedPolicy);
  const document = parseWorkspace(source);
  enforceSafeBuildPolicy(document);
  const current = allowBuildEntries(document);
  if (current !== null) {
    for (const item of items) {
      const legacyKey = item.package.lifecycleAuthorization.packageKey;
      if (legacyKey !== null && current.entries.get(legacyKey) === true) {
        fail(`legacy broad lifecycle authorization ${legacyKey} lacks installer provenance; explicit migration is required`);
      }
    }
    for (const key of keys) {
      if (current.entries.get(key) === true) current.node.delete(key);
    }
    current.node.items.sort((left, right) => String(left.key.value).localeCompare(String(right.key.value), 'en'));
  }
  const normalized = normalizeWorkspace(document);
  parseWorkspace(normalized);
  return { changed: normalized !== source, keys, source: normalized };
}

async function profileWorkspace(profileInput) {
  const profile = await validateWebProfile(profileInput);
  const workspace = join(profile, 'pnpm-workspace.yaml');
  const workspaceStat = await lstat(workspace);
  if (!workspaceStat.isFile() || workspaceStat.isSymbolicLink()) fail('profile pnpm-workspace.yaml must be a regular file');
  return workspace;
}

async function replaceExistingFile(temporary, target) {
  if (process.platform !== 'win32') {
    await rename(temporary, target);
    return;
  }
  const backup = `${target}.dsh-plugin-installer-${randomUUID()}.bak`;
  await rename(target, backup);
  try {
    await rename(temporary, target);
  } catch (error) {
    try {
      await rename(backup, target);
    } catch (restoreError) {
      throw new AggregateError([error, restoreError], `Windows replacement and recovery failed for ${target}`);
    }
    throw error;
  }
  await rm(backup, { force: true });
}

async function writeWorkspace(workspace, source) {
  const temporary = `${workspace}.dsh-plugin-installer-${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, source, { mode: 0o600, flag: 'wx' });
    await replaceExistingFile(temporary, workspace);
  } finally {
    await rm(temporary, { force: true });
  }
}

export async function cleanupInstallerOwnedAllowBuilds(profileInput) {
  const workspace = await profileWorkspace(profileInput);
  const profile = dirname(workspace);
  const [original, lockSource] = await Promise.all([
    readFile(workspace, 'utf8'),
    readFile(join(profile, 'pnpm-lock.yaml'), 'utf8'),
  ]);
  const result = cleanupInstallerOwnedAllowBuildsText(original, lockSource);
  if (!result.changed) return result;
  try {
    await writeWorkspace(workspace, result.source);
    const persisted = await readFile(workspace, 'utf8');
    if (persisted !== result.source) {
      fail('installer-owned allowBuilds cleanup did not persist exact workspace bytes');
    }
    parseWorkspace(persisted);
  } catch (error) {
    try {
      await writeWorkspace(workspace, original);
    } catch (restoreError) {
      throw new AggregateError(
        [error, restoreError],
        'installer-owned allowBuilds cleanup and workspace recovery both failed'
      );
    }
    throw error;
  }
  return result;
}

function policyEnvironment(options) {
  if (options === undefined || options === null || typeof options !== 'object' || Array.isArray(options) ||
      options.environment === null || typeof options.environment !== 'object' ||
      Array.isArray(options.environment)) {
    fail('prepare policy options require one controlled environment');
  }
  return options.environment;
}

async function captureExpectedSourceContext(profile, items, installSpecs) {
  if (!Array.isArray(installSpecs) || installSpecs.length !== items.length) {
    fail('prepare authorization requires one exact install spec per authority item');
  }
  const artifactIntegrities = [];
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const installSpec = installSpecs[index];
    if (githubSourceCoordinates(item) !== null) {
      artifactIntegrities.push(null);
      continue;
    }
    if (typeof installSpec !== 'string' || !isAbsolute(installSpec) ||
        resolvePath(installSpec) !== installSpec || installSpec.includes('\0')) {
      fail(`prepared artifact path is not one canonical absolute file for #${item.catalogId}`);
    }
    const [stat, canonical] = await Promise.all([lstat(installSpec), realpath(installSpec)]);
    if (!stat.isFile() || stat.isSymbolicLink() || canonical !== installSpec ||
        stat.size < 1 || stat.size > 256 * 1024 * 1024) {
      fail(`prepared artifact is not one bounded canonical regular file for #${item.catalogId}`);
    }
    const digest = createHash('sha512').update(await readFile(installSpec)).digest('base64');
    artifactIntegrities.push(`sha512-${digest}`);
  }
  return { profile, artifactIntegrities };
}

async function applyPreparePolicy(profileInput, items, operation, options) {
  const workspace = await profileWorkspace(profileInput);
  const profile = dirname(workspace);
  const environment = policyEnvironment(options);
  const original = await readFile(workspace, 'utf8');
  const lockSource = await readFile(join(profile, 'pnpm-lock.yaml'), 'utf8');
  let resolvedPolicy;
  if (operation === 'authorize') {
    if (JSON.stringify(Object.keys(options).sort()) !==
        JSON.stringify(['baselineLockSource', 'environment', 'installSpecs'].sort()) ||
        typeof options.baselineLockSource !== 'string' || !Array.isArray(options.installSpecs)) {
      fail('prepare authorization requires the baseline lockfile, exact install specs, and controlled environment');
    }
    const expectedSourceContext = await captureExpectedSourceContext(
      profile,
      items,
      options.installSpecs
    );
    resolvedPolicy = resolvePnpmLifecyclePolicy(
      options.baselineLockSource,
      lockSource,
      items,
      options.installSpecs,
      expectedSourceContext
    );
  } else {
    if (JSON.stringify(Object.keys(options).sort()) !== JSON.stringify(['environment'])) {
      fail('prepare revocation accepts only the controlled environment');
    }
    resolvedPolicy = resolveCurrentDirectLifecyclePolicy(lockSource, items);
  }
  const result = operation === 'authorize'
    ? authorizePrepareText(original, items, resolvedPolicy)
    : revokePrepareText(original, items, resolvedPolicy);
  try {
    if (result.changed) await writeWorkspace(workspace, result.source);
    verifyEffectivePnpmBuildPolicy(profile, result.keys, operation === 'authorize', { environment });
    if (operation === 'authorize') {
      verifyEffectivePnpmBuildPolicy(profile, result.deniedKeys, false, { environment });
    }
  } catch (error) {
    if (result.changed) {
      try {
        await writeWorkspace(workspace, original);
      } catch (restoreError) {
        throw new AggregateError(
          [error, restoreError],
          'pnpm build policy verification and workspace recovery both failed'
        );
      }
    }
    throw error;
  }
  return { changed: result.changed, keys: result.keys };
}

export async function authorizePrepare(profileInput, items, options) {
  return applyPreparePolicy(profileInput, items, 'authorize', options);
}

export async function revokePrepare(profileInput, items, options) {
  return applyPreparePolicy(profileInput, items, 'revoke', options);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.stderr.write('direct prepare authorization is disabled; use the consent-bound install transaction\n');
  process.exitCode = 1;
}
