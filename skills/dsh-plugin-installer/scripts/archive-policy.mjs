#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { lifecycleHooksFromManifest, normalizeBundlePatch } from './authority.mjs';

const MAX_COMPRESSED_BYTES = 256 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 512 * 1024 * 1024;
const MAX_ENTRIES = 5000;
const UTF8 = new TextDecoder('utf-8', { fatal: true });
const PACKAGE = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;

function fail(message) {
  throw new Error(message);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function npmPurl(name, version) {
  const encodedName = name.startsWith('@') ? `%40${name.slice(1)}` : name;
  return `pkg:npm/${encodedName}@${version}`;
}

function componentManifestSha256(component) {
  if (component?.hashes !== undefined) return null;
  if (!Array.isArray(component?.properties) || component.properties.length !== 1) return null;
  const matches = component.properties.filter((entry) =>
    entry !== null && typeof entry === 'object' && !Array.isArray(entry) &&
    JSON.stringify(Object.keys(entry).sort()) === JSON.stringify(['name', 'value']) &&
    entry.name === 'dsh-themes:package-manifest-sha256' &&
    /^[a-f0-9]{64}$/.test(entry.value));
  if (matches.length !== 1) return null;
  return matches[0].value;
}

function componentLicenseExpression(component) {
  if (!Array.isArray(component?.licenses) || component.licenses.length !== 1 ||
      !exactObjectKeys(component.licenses[0], ['expression']) ||
      typeof component.licenses[0].expression !== 'string') return null;
  return component.licenses[0].expression;
}

function exactObjectKeys(value, expected) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}

function manifestPeerDependencies(manifest) {
  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    fail('hosted artifact SBOM validation requires the actual package manifest');
  }
  const peerDependencies = manifest.peerDependencies ?? {};
  if (peerDependencies === null || typeof peerDependencies !== 'object' ||
      Array.isArray(peerDependencies) || Object.keys(peerDependencies).length > 5000 ||
      Object.entries(peerDependencies).some(([name, version]) =>
        !PACKAGE.test(name) || !SEMVER.test(version))) {
    fail('hosted package manifest peerDependencies are not exact package versions');
  }
  return Object.entries(peerDependencies)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([name, version]) => ({
      name,
      version,
      reference: npmPurl(name, version),
    }));
}

export function validateCycloneDxSbom(document, item, manifest) {
  if (document === null || typeof document !== 'object' || Array.isArray(document) ||
      document.bomFormat !== 'CycloneDX' || !['1.5', '1.6'].includes(document.specVersion) ||
      document.metadata === null || typeof document.metadata !== 'object' || Array.isArray(document.metadata) ||
      !Array.isArray(document.components) || document.components.length > 5000 ||
      !Array.isArray(document.dependencies) || document.dependencies.length < 1 || document.dependencies.length > 5000) {
    fail('hosted artifact SBOM must be a bounded CycloneDX 1.5 or 1.6 document with components and dependencies');
  }
  const expectedDependencies = manifestPeerDependencies(manifest);
  const expectedPurl = npmPurl(item.package.name, item.package.version);
  const root = document.metadata.component;
  if (root === null || typeof root !== 'object' || Array.isArray(root) ||
      root.type !== 'library' || root.name !== item.package.name ||
      root.version !== item.package.version || root.purl !== expectedPurl ||
      root['bom-ref'] !== expectedPurl ||
      componentManifestSha256(root) !== item.distribution.manifestSha256 ||
      componentLicenseExpression(root) !== item.rights?.licenseExpression) {
    fail('hosted artifact SBOM metadata component does not bind the exact package identity, purl, manifest SHA-256, and license expression');
  }
  const references = new Map([[root['bom-ref'], root]]);
  if (document.components.length !== expectedDependencies.length) {
    fail('hosted artifact SBOM components do not exactly match manifest peerDependencies');
  }
  for (const [index, component] of document.components.entries()) {
    const expected = expectedDependencies[index];
    if (!exactObjectKeys(component, ['bom-ref', 'name', 'purl', 'scope', 'type', 'version']) ||
        component.type !== 'library' || component.name !== expected.name ||
        component.version !== expected.version || component.purl !== expected.reference ||
        component['bom-ref'] !== expected.reference || component.scope !== 'required') {
      fail(`hosted artifact SBOM components[${index}] does not exactly bind manifest peerDependencies`);
    }
    if (references.has(component['bom-ref'])) {
      fail('hosted artifact SBOM contains duplicate or root-colliding component references');
    }
    references.set(component['bom-ref'], component);
  }
  const dependencyReferences = new Set();
  for (const [index, dependency] of document.dependencies.entries()) {
    if (dependency === null || typeof dependency !== 'object' || Array.isArray(dependency) ||
        JSON.stringify(Object.keys(dependency).sort()) !== JSON.stringify(['dependsOn', 'ref']) ||
        typeof dependency.ref !== 'string' || !references.has(dependency.ref) ||
        dependencyReferences.has(dependency.ref) || !Array.isArray(dependency.dependsOn) ||
        new Set(dependency.dependsOn).size !== dependency.dependsOn.length ||
        dependency.dependsOn.some((reference) => typeof reference !== 'string' ||
          reference === dependency.ref || !references.has(reference))) {
      fail(`hosted artifact SBOM dependencies[${index}] does not describe a closed component graph`);
    }
    dependencyReferences.add(dependency.ref);
  }
  if (dependencyReferences.size !== references.size ||
      [...references.keys()].some((reference) => !dependencyReferences.has(reference))) {
    fail('hosted artifact SBOM dependency graph must enumerate every component exactly once');
  }
  const rootDependency = document.dependencies.find((dependency) => dependency.ref === expectedPurl);
  const expectedReferences = expectedDependencies.map((dependency) => dependency.reference);
  if (!rootDependency ||
      JSON.stringify(rootDependency.dependsOn) !== JSON.stringify(expectedReferences)) {
    fail('hosted artifact SBOM root dependsOn does not exactly match manifest peerDependencies');
  }
  for (const expected of expectedDependencies) {
    const dependency = document.dependencies.find((entry) => entry.ref === expected.reference);
    if (!dependency || dependency.dependsOn.length !== 0) {
      fail('hosted artifact SBOM peer dependency graph must contain exact leaf edges');
    }
  }
  return document;
}

function field(bytes, start, length, label, allowSpacePadding = false) {
  const value = bytes.subarray(start, start + length);
  const nul = value.indexOf(0);
  const body = nul < 0 ? value : value.subarray(0, nul);
  const padding = nul < 0 ? Buffer.alloc(0) : value.subarray(nul + 1);
  if (!padding.every((byte) => byte === 0 || (allowSpacePadding && byte === 0x20))) {
    fail(`archive ${label} contains hidden bytes after NUL padding`);
  }
  try {
    return UTF8.decode(body);
  } catch {
    fail(`archive ${label} is not valid UTF-8`);
  }
}

function octal(bytes, start, length, label) {
  const value = field(bytes, start, length, label, true).trim().replace(/^0+/, '') || '0';
  if (!/^[0-7]+$/.test(value)) fail(`archive ${label} is not octal`);
  const parsed = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(parsed) || parsed < 0) fail(`archive ${label} is invalid`);
  return parsed;
}

function verifyHeaderChecksum(header) {
  const declared = octal(header, 148, 8, 'header checksum');
  let actual = 0;
  for (let index = 0; index < header.length; index += 1) {
    actual += index >= 148 && index < 156 ? 0x20 : header[index];
  }
  if (declared !== actual) fail('archive header checksum mismatch');
}

function safeEntryPath(name) {
  const parts = name.split('/');
  if (!name || name.length > 512 || name.startsWith('/') || name.startsWith('\\') ||
      name.includes('\\') || /[\u0000-\u001f\u007f:\u2028\u2029]/u.test(name) ||
      parts.some((part) => part === '' || part === '.' || part === '..' ||
        /[. ]$/u.test(part) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu.test(part))) {
    fail(`archive contains unsafe path ${JSON.stringify(name)}`);
  }
  if (name !== 'package' && !name.startsWith('package/')) {
    fail(`archive entry is outside package/: ${name}`);
  }
}

export function assertSafeArchiveEntryPath(name) {
  safeEntryPath(name);
  return name;
}

export function assertNoRegularFilePathConflicts(entries, label = 'path set') {
  if (!Array.isArray(entries) || entries.some((entry) =>
    entry === null || typeof entry !== 'object' || Array.isArray(entry) ||
    typeof entry.name !== 'string' || !['0', '5'].includes(entry.type))) {
    fail(`${label} is not a regular-file/directory entry list`);
  }
  const normalized = new Map(entries.map((entry) => [
    entry.name.normalize('NFC').toLocaleLowerCase('en-US'),
    entry,
  ]));
  for (const entry of entries) {
    const parts = entry.name.normalize('NFC').toLocaleLowerCase('en-US').split('/');
    for (let length = 1; length < parts.length; length += 1) {
      const ancestor = normalized.get(parts.slice(0, length).join('/'));
      if (ancestor?.type === '0') {
        fail(`${label} contains regular-file ancestor/descendant conflict between ` +
          `${JSON.stringify(ancestor.name)} and ${JSON.stringify(entry.name)}`);
      }
    }
  }
  return entries;
}

export function inspectTarEntries(compressed) {
  if (!Buffer.isBuffer(compressed)) fail('archive bytes must be a Buffer');
  if (compressed.length < 2 || compressed.length > MAX_COMPRESSED_BYTES) fail('archive compressed size is invalid');
  let tar;
  try {
    tar = compressed[0] === 0x1f && compressed[1] === 0x8b
      ? gunzipSync(compressed, { maxOutputLength: MAX_UNCOMPRESSED_BYTES })
      : compressed;
  } catch (error) {
    fail(`archive gzip decoding failed: ${error.message}`);
  }
  if (tar.length > MAX_UNCOMPRESSED_BYTES || tar.length % 512 !== 0) fail('archive tar size is invalid');
  const entries = [];
  let offset = 0;
  let zeroBlocks = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      zeroBlocks += 1;
      offset += 512;
      if (zeroBlocks >= 2) break;
      continue;
    }
    if (zeroBlocks !== 0) {
      fail('archive has a zero-block gap before its terminator');
    }
    zeroBlocks = 0;
    verifyHeaderChecksum(header);
    if (!header.subarray(257, 265).equals(Buffer.from('ustar\0' + '00', 'binary'))) {
      fail('archive header is not canonical POSIX ustar');
    }
    const namePart = field(header, 0, 100, 'entry name');
    const prefix = field(header, 345, 155, 'entry prefix');
    const rawName = prefix ? `${prefix}/${namePart}` : namePart;
    const name = rawName.replace(/\/$/, '');
    safeEntryPath(name);
    const size = octal(header, 124, 12, 'entry size');
    if (size > MAX_COMPRESSED_BYTES) fail('archive entry is too large');
    const type = String.fromCharCode(header[156] || 0x30);
    if (!['0', '\0', '5'].includes(type)) {
      fail(`archive entry ${name} uses forbidden link or special type ${JSON.stringify(type)}`);
    }
    if (type === '5' && size !== 0) fail(`archive directory ${name} has a body`);
    const bodyStart = offset + 512;
    const bodyEnd = bodyStart + size;
    if (bodyEnd > tar.length) fail('archive entry exceeds tar bounds');
    const mode = octal(header, 100, 8, 'entry mode');
    if ((mode & 0o7022) !== 0) fail(`archive entry ${name} uses a dangerous mode`);
    const paddedEnd = bodyStart + Math.ceil(size / 512) * 512;
    if (!tar.subarray(bodyEnd, paddedEnd).every((byte) => byte === 0)) {
      fail(`archive entry ${name} has non-zero padding`);
    }
    entries.push({
      name,
      type: type === '\0' ? '0' : type,
      mode,
      size,
      body: Buffer.from(tar.subarray(bodyStart, bodyEnd)),
    });
    if (entries.length > MAX_ENTRIES) fail('archive contains too many entries');
    offset = paddedEnd;
  }
  if (zeroBlocks < 2) fail('archive lacks two terminating zero blocks');
  if (!tar.subarray(offset).every((byte) => byte === 0)) {
    fail('archive contains non-zero data after its terminating zero blocks');
  }
  const names = entries.map((entry) => entry.name);
  if (new Set(names).size !== names.length) fail('archive contains duplicate paths');
  if (names.some((name) => name !== name.normalize('NFC')) ||
      new Set(names.map((name) => name.normalize('NFC').toLocaleLowerCase('en-US'))).size !== names.length) {
    fail('archive contains non-portable Unicode or case-colliding paths');
  }
  assertNoRegularFilePathConflicts(entries, 'archive');
  return entries;
}

export function validateHostedArtifact(bytes, item) {
  if (item.distribution.kind !== 'hosted-plugin-verified') fail('item is not a hosted artifact');
  if (bytes.length !== item.distribution.artifactBytes) fail('hosted artifact byte count mismatch');
  const digest = sha256(bytes);
  if (digest !== item.distribution.artifactSha256) fail('hosted artifact SHA-256 mismatch');
  const entries = inspectTarEntries(bytes);
  const manifestEntry = entries.find((entry) => entry.name === 'package/package.json' && entry.type === '0');
  if (!manifestEntry) fail('hosted artifact lacks package/package.json');
  let manifest;
  try {
    manifest = JSON.parse(manifestEntry.body.toString('utf8'));
  } catch (error) {
    fail(`hosted package manifest is invalid JSON: ${error.message}`);
  }
  if (sha256(manifestEntry.body) !== item.distribution.manifestSha256) {
    fail('hosted package manifest digest mismatch');
  }
  if (manifest.name !== item.package.name || manifest.version !== item.package.version ||
      manifest.license !== item.rights?.licenseExpression ||
      normalizeBundlePatch(manifest.dsh?.bundle?.patch) !== item.package.bundlePatch) {
    fail('hosted package manifest identity, license, or dsh.bundle patch mismatch');
  }
  for (const [hook, script] of Object.entries(lifecycleHooksFromManifest(manifest))) {
    if (script !== null) fail(`hosted artifact contains forbidden ${hook} lifecycle script`);
  }
  const patchName = `package/${item.package.bundlePatch}`;
  if (!entries.some((entry) => entry.name === patchName && entry.type === '0')) {
    fail('hosted artifact lacks the declared bundle patch');
  }
  const licenseName = `package/${item.distribution.licenseFile.path}`;
  const license = entries.find((entry) => entry.name === licenseName && entry.type === '0');
  if (!license || license.body.length === 0 || sha256(license.body) !== item.distribution.licenseFile.sha256) {
    fail('hosted artifact license file is missing, empty, or has the wrong digest');
  }
  const noticeName = `package/${item.distribution.noticeFile.path}`;
  const notice = entries.find((entry) => entry.name === noticeName && entry.type === '0');
  if (!notice || notice.body.length === 0 ||
      sha256(notice.body) !== item.distribution.noticeFile.sha256) {
    fail('hosted artifact modification notice is missing, empty, or has the wrong digest');
  }
  let noticeText;
  try {
    noticeText = UTF8.decode(notice.body);
  } catch {
    fail('hosted artifact modification notice is not valid UTF-8');
  }
  if (!noticeText.includes('# Modification notice') ||
      !noticeText.includes(`- License: ${item.rights.licenseExpression}`)) {
    fail('hosted artifact modification notice does not identify its license');
  }
  const sbomName = `package/${item.distribution.sbom.path}`;
  const sbom = entries.find((entry) => entry.name === sbomName && entry.type === '0');
  if (!sbom || sha256(sbom.body) !== item.distribution.sbom.sha256) {
    fail('hosted artifact SBOM is missing or has the wrong digest');
  }
  let sbomDocument;
  try {
    sbomDocument = JSON.parse(sbom.body.toString('utf8'));
  } catch (error) {
    fail(`hosted artifact SBOM is not valid JSON: ${error.message}`);
  }
  validateCycloneDxSbom(sbomDocument, item, manifest);
  return { packageName: manifest.name, version: manifest.version, artifactSha256: digest, entries: entries.length };
}

export function validateUpstreamArtifact(bytes, item) {
  if (item.distribution.kind !== 'upstream-plugin-verified' ||
      !['npm-package-version', 'github-release-asset'].includes(item.distribution.source?.type)) {
    fail('item is not an upstream npm or GitHub Release artifact');
  }
  const source = item.distribution.source;
  const expectedBytes = source.type === 'npm-package-version' ? source.tarballBytes : source.assetBytes;
  const expectedSha256 = source.type === 'npm-package-version' ? source.tarballSha256 : source.assetSha256;
  if (bytes.length !== expectedBytes || sha256(bytes) !== expectedSha256) {
    fail('upstream artifact byte count or SHA-256 mismatch');
  }
  if (source.type === 'npm-package-version') {
    const expectedIntegrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`;
    if (source.distIntegrity !== expectedIntegrity) fail('npm dist integrity mismatch');
  }
  const entries = inspectTarEntries(bytes);
  const manifestEntry = entries.find((entry) => entry.name === 'package/package.json' && entry.type === '0');
  if (!manifestEntry) fail('upstream artifact lacks package/package.json');
  if (source.type === 'github-release-asset' && sha256(manifestEntry.body) !== source.manifestSha256) {
    fail('GitHub Release package manifest digest mismatch');
  }
  let manifest;
  try {
    manifest = JSON.parse(manifestEntry.body.toString('utf8'));
  } catch (error) {
    fail(`upstream package manifest is invalid JSON: ${error.message}`);
  }
  if (manifest.name !== item.package.name || manifest.version !== item.package.version ||
      normalizeBundlePatch(manifest.dsh?.bundle?.patch) !== item.package.bundlePatch) {
    fail('upstream package manifest identity or dsh.bundle patch mismatch');
  }
  const lifecycle = lifecycleHooksFromManifest(manifest);
  if (JSON.stringify(lifecycle) !== JSON.stringify(item.package.lifecycle.hooks)) {
    fail('upstream lifecycle hook map does not match its complete reviewed authority');
  }
  const patchName = `package/${item.package.bundlePatch}`;
  if (!entries.some((entry) => entry.name === patchName && entry.type === '0')) {
    fail('upstream artifact lacks the declared bundle patch');
  }
  return {
    packageName: manifest.name,
    version: manifest.version,
    artifactSha256: expectedSha256,
    entries: entries.length,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.length !== 2 || args[0] !== '--archive') fail('usage: archive-policy.mjs --archive <absolute-tgz>');
    const entries = inspectTarEntries(await readFile(args[1]));
    process.stdout.write(`${JSON.stringify({ safe: true, entries: entries.length }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
