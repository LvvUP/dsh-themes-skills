#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { lstat, mkdir, open, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, parse, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  lifecycleHooksFromManifest,
  loadAuthority,
  normalizeCatalogId,
  resolveItems,
  validateItem,
} from './authority.mjs';
import { validateHostedArtifact, validateUpstreamArtifact } from './archive-policy.mjs';

function fail(message) {
  throw new Error(message);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function git(checkout, args) {
  const result = spawnSync('git', ['-C', checkout, ...args], { encoding: 'utf8', shell: false });
  if (result.status !== 0) fail(`git ${args.join(' ')} failed: ${(result.stderr || result.stdout).trim()}`);
  return result.stdout.trim();
}

async function canonicalFile(input, label) {
  if (!isAbsolute(input)) fail(`${label} must be absolute`);
  const path = resolve(input);
  if (path === parse(path).root) fail(`${label} cannot be a filesystem root`);
  const stat = await lstat(path);
  if (!stat.isFile() || stat.isSymbolicLink()) fail(`${label} must be a regular file, not a symlink`);
  return realpath(path);
}

async function canonicalDirectory(input, label) {
  if (!isAbsolute(input)) fail(`${label} must be absolute`);
  const path = resolve(input);
  if (path === parse(path).root) fail(`${label} cannot be a filesystem root`);
  const stat = await lstat(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail(`${label} must be a real directory, not a symlink`);
  return realpath(path);
}

async function newOutput(input) {
  if (!isAbsolute(input)) fail('--output must be absolute');
  const requested = resolve(input);
  if (requested === parse(requested).root) fail('--output cannot be a filesystem root');
  const output = join(await realpath(dirname(requested)), basename(requested));
  try {
    await lstat(output);
    fail('--output must not already exist');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await mkdir(output, { recursive: false, mode: 0o700 });
  return realpath(output);
}

async function writePrepared(output, record) {
  const handle = await open(join(output, 'prepared.json'), 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(record, null, 2)}\n`);
  } finally {
    await handle.close();
  }
}

function baseRecord(item) {
  return {
    schemaVersion: 2,
    catalogId: item.catalogId,
    distributionKind: item.distribution.kind,
    package: {
      name: item.package.name,
      version: item.package.version,
      bundlePatch: item.package.bundlePatch,
    },
    lifecycle: structuredClone(item.package.lifecycle),
    lifecycleAuthorization: structuredClone(item.package.lifecycleAuthorization),
  };
}

export async function prepareHosted({ item, artifact, output: outputInput }) {
  validateItem(item);
  if (item.distribution.kind !== 'hosted-plugin-verified') fail('selected authority item is not hosted');
  const artifactPath = await canonicalFile(artifact, 'artifact');
  const bytes = await readFile(artifactPath);
  validateHostedArtifact(bytes, item);
  const output = await newOutput(outputInput);
  try {
    const artifactFile = `${item.catalogId}-${item.distribution.artifactSha256}.tgz`;
    await writeFile(join(output, artifactFile), bytes, { mode: 0o600, flag: 'wx' });
    const record = {
      ...baseRecord(item),
      sourceType: null,
      install: { artifactFile, installSpec: null },
      evidence: {
        artifactBytes: bytes.length,
        artifactSha256: item.distribution.artifactSha256,
        metadataSha256: null,
        licenseSha256: item.distribution.licenseFile.sha256,
        sbomSha256: item.distribution.sbom.sha256,
        sourceCommit: null,
        sourceTree: null,
        manifestSha256: item.distribution.manifestSha256,
        lockfileSha256: null,
      },
    };
    await writePrepared(output, record);
    return record;
  } catch (error) {
    await rm(output, { recursive: true, force: true });
    throw error;
  }
}

function validateNpmMetadata(bytes, item) {
  const source = item.distribution.source;
  if (sha256(bytes) !== source.metadataSha256) fail('npm registry metadata digest mismatch');
  let metadata;
  try {
    metadata = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    fail(`npm registry metadata is invalid JSON: ${error.message}`);
  }
  const resolved = metadata?.version === source.version ? metadata : metadata?.versions?.[source.version];
  if (metadata?.name !== source.packageName || resolved?.name !== source.packageName ||
      resolved?.version !== source.version || resolved?.dist?.tarball !== source.tarballUrl ||
      resolved?.dist?.integrity !== source.distIntegrity) {
    fail('npm registry metadata did not resolve the exact package identity, version, tarball, and integrity');
  }
}

export async function prepareUpstream({
  item,
  artifact: artifactInput,
  checkout: checkoutInput,
  resolution: resolutionInput,
  output: outputInput,
}) {
  validateItem(item);
  if (item.distribution.kind !== 'upstream-plugin-verified') fail('selected authority item is not upstream');
  const source = item.distribution.source;
  if (source.type === 'git-commit') {
    if (!checkoutInput || artifactInput || resolutionInput) fail('Git commit preparation requires only one clean checkout');
    const checkout = await canonicalDirectory(checkoutInput, 'checkout');
    if (git(checkout, ['remote', 'get-url', 'origin']) !== source.repository ||
        git(checkout, ['rev-parse', 'HEAD']) !== source.commit ||
        git(checkout, ['rev-parse', 'HEAD^{tree}']) !== source.tree ||
        git(checkout, ['status', '--porcelain=v1', '--untracked-files=all']) !== '') {
      fail('upstream checkout repository, commit, tree, or clean state mismatch');
    }
    const packageRoot = resolve(checkout, source.subdir);
    const inside = relative(checkout, packageRoot);
    if (inside.startsWith('..') || isAbsolute(inside)) fail('upstream package root escapes checkout');
    const packageStat = await lstat(packageRoot);
    if (!packageStat.isDirectory() || packageStat.isSymbolicLink() || await realpath(packageRoot) !== checkout) {
      fail('upstream package must be the real repository root');
    }
    const manifestPath = await canonicalFile(join(packageRoot, 'package.json'), 'upstream package manifest');
    const lockfilePath = await canonicalFile(join(packageRoot, source.lockfilePath), 'upstream lockfile');
    for (const [path, label] of [[manifestPath, 'manifest'], [lockfilePath, 'lockfile']]) {
      const relativePath = relative(checkout, path);
      if (relativePath.startsWith('..') || isAbsolute(relativePath)) fail(`upstream ${label} escapes checkout`);
    }
    const manifestBytes = await readFile(manifestPath);
    const lockfileBytes = await readFile(lockfilePath);
    if (sha256(manifestBytes) !== source.manifestSha256 ||
        sha256(lockfileBytes) !== source.lockfileSha256) fail('upstream manifest or lockfile digest mismatch');
    const manifest = JSON.parse(manifestBytes.toString('utf8'));
    if (manifest.name !== item.package.name || manifest.version !== item.package.version ||
        manifest.dsh?.bundle?.patch !== item.package.bundlePatch) fail('upstream package identity or bundle patch mismatch');
    const lifecycle = lifecycleHooksFromManifest(manifest);
    if (JSON.stringify(lifecycle) !== JSON.stringify(item.package.lifecycle.hooks)) {
      fail('upstream lifecycle hook map does not match its complete reviewed authority');
    }
    const output = await newOutput(outputInput);
    try {
      const record = {
        ...baseRecord(item),
        sourceType: source.type,
        install: { artifactFile: null, installSpec: source.installSpec },
        evidence: {
          artifactBytes: null,
          artifactSha256: null,
          metadataSha256: null,
          licenseSha256: null,
          sbomSha256: null,
          sourceCommit: source.commit,
          sourceTree: source.tree,
          manifestSha256: source.manifestSha256,
          lockfileSha256: source.lockfileSha256,
        },
      };
      await writePrepared(output, record);
      return record;
    } catch (error) {
      await rm(output, { recursive: true, force: true });
      throw error;
    }
  }

  if (!artifactInput || checkoutInput || (source.type === 'npm-package-version') !== Boolean(resolutionInput)) {
    fail('npm preparation requires artifact plus metadata; GitHub Release preparation requires only its asset');
  }
  const artifact = await canonicalFile(artifactInput, 'upstream artifact');
  const bytes = await readFile(artifact);
  validateUpstreamArtifact(bytes, item);
  if (source.type === 'npm-package-version') {
    const resolution = await canonicalFile(resolutionInput, 'npm registry metadata');
    validateNpmMetadata(await readFile(resolution), item);
  }
  const output = await newOutput(outputInput);
  try {
    const digest = source.type === 'npm-package-version' ? source.tarballSha256 : source.assetSha256;
    const artifactFile = `${item.catalogId}-${digest}.tgz`;
    await writeFile(join(output, artifactFile), bytes, { mode: 0o600, flag: 'wx' });
    const record = {
      ...baseRecord(item),
      sourceType: source.type,
      install: { artifactFile, installSpec: null },
      evidence: {
        artifactBytes: bytes.length,
        artifactSha256: digest,
        metadataSha256: source.type === 'npm-package-version' ? source.metadataSha256 : null,
        licenseSha256: null,
        sbomSha256: null,
        sourceCommit: null,
        sourceTree: null,
        manifestSha256: source.type === 'github-release-asset' ? source.manifestSha256 : null,
        lockfileSha256: null,
      },
    };
    await writePrepared(output, record);
    return record;
  } catch (error) {
    await rm(output, { recursive: true, force: true });
    throw error;
  }
}

export async function validatePrepared(preparedDirectoryInput, item) {
  validateItem(item);
  const directory = await canonicalDirectory(preparedDirectoryInput, 'prepared directory');
  const preparedRecordPath = await canonicalFile(join(directory, 'prepared.json'), 'prepared record');
  const recordInside = relative(directory, preparedRecordPath);
  if (recordInside.startsWith('..') || isAbsolute(recordInside)) fail('prepared record escapes its directory');
  const recordBytes = await readFile(preparedRecordPath);
  if (recordBytes.length > 64 * 1024) fail('prepared record is oversized');
  const record = JSON.parse(recordBytes.toString('utf8'));
  const expectedKeys = [
    'catalogId', 'distributionKind', 'evidence', 'install', 'lifecycle',
    'lifecycleAuthorization', 'package', 'schemaVersion', 'sourceType',
  ];
  if (JSON.stringify(Object.keys(record).sort()) !== JSON.stringify(expectedKeys)) fail('prepared record keys are invalid');
  if (record.schemaVersion !== 2 || record.catalogId !== item.catalogId ||
      record.distributionKind !== item.distribution.kind ||
      JSON.stringify(record.package) !== JSON.stringify({
        name: item.package.name,
        version: item.package.version,
        bundlePatch: item.package.bundlePatch,
      }) || JSON.stringify(record.lifecycleAuthorization) !== JSON.stringify(item.package.lifecycleAuthorization) ||
      JSON.stringify(record.lifecycle) !== JSON.stringify(item.package.lifecycle)) {
    fail('prepared record does not match authority');
  }
  if (item.distribution.kind === 'hosted-plugin-verified') {
    if (record.sourceType !== null) fail('hosted prepared source type is invalid');
    if (record.install.installSpec !== null || basename(record.install.artifactFile) !== record.install.artifactFile) {
      fail('hosted prepared install fields are unsafe');
    }
    const artifact = await canonicalFile(join(directory, record.install.artifactFile), 'prepared artifact');
    const inside = relative(directory, artifact);
    if (inside.startsWith('..') || isAbsolute(inside)) fail('prepared artifact escapes its directory');
    validateHostedArtifact(await readFile(artifact), item);
    if (JSON.stringify(record.evidence) !== JSON.stringify({
      artifactBytes: item.distribution.artifactBytes,
      artifactSha256: item.distribution.artifactSha256,
      metadataSha256: null,
      licenseSha256: item.distribution.licenseFile.sha256,
      sbomSha256: item.distribution.sbom.sha256,
      sourceCommit: null,
      sourceTree: null,
      manifestSha256: item.distribution.manifestSha256,
      lockfileSha256: null,
    })) fail('hosted prepared evidence mismatch');
    return { record, installSpec: artifact };
  }
  const source = item.distribution.source;
  if (record.sourceType !== source.type) fail('upstream prepared source type mismatch');
  if (source.type === 'git-commit') {
    if (record.install.artifactFile !== null || record.install.installSpec !== source.installSpec ||
        JSON.stringify(record.evidence) !== JSON.stringify({
          artifactBytes: null,
          artifactSha256: null,
          metadataSha256: null,
          licenseSha256: null,
          sbomSha256: null,
          sourceCommit: source.commit,
          sourceTree: source.tree,
          manifestSha256: source.manifestSha256,
          lockfileSha256: source.lockfileSha256,
        })) fail('upstream Git prepared evidence mismatch');
    return { record, installSpec: source.installSpec };
  }
  if (record.install.installSpec !== null || basename(record.install.artifactFile) !== record.install.artifactFile) {
    fail('upstream artifact prepared install fields are unsafe');
  }
  const artifact = await canonicalFile(join(directory, record.install.artifactFile), 'prepared upstream artifact');
  const inside = relative(directory, artifact);
  if (inside.startsWith('..') || isAbsolute(inside)) fail('prepared upstream artifact escapes its directory');
  validateUpstreamArtifact(await readFile(artifact), item);
  const expectedDigest = source.type === 'npm-package-version' ? source.tarballSha256 : source.assetSha256;
  const expectedBytes = source.type === 'npm-package-version' ? source.tarballBytes : source.assetBytes;
  if (JSON.stringify(record.evidence) !== JSON.stringify({
        artifactBytes: expectedBytes,
        artifactSha256: expectedDigest,
        metadataSha256: source.type === 'npm-package-version' ? source.metadataSha256 : null,
        licenseSha256: null,
        sbomSha256: null,
        sourceCommit: null,
        sourceTree: null,
        manifestSha256: source.type === 'github-release-asset' ? source.manifestSha256 : null,
        lockfileSha256: null,
      })) fail('upstream artifact prepared evidence mismatch');
  return { record, installSpec: artifact };
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!['--id', '--artifact', '--checkout', '--resolution', '--output'].includes(key) || !argv[index + 1]) fail('invalid prepare-plugin argument');
    const name = key.slice(2);
    if (Object.hasOwn(options, name)) fail(`duplicate prepare-plugin argument ${key}`);
    options[name] = argv[++index];
  }
  if (!options.id || !options.output || (!options.artifact && !options.checkout) ||
      (options.artifact && options.checkout)) {
    fail('usage: prepare-plugin.mjs --id <#3NNN> (--artifact <absolute-tgz> [--resolution <absolute-npm-metadata.json>] | --checkout <absolute-git-checkout>) --output <new-absolute-directory>');
  }
  normalizeCatalogId(options.id);
  return options;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const loaded = await loadAuthority();
    const [item] = resolveItems(loaded.authority, [options.id], {
      top10ReleaseSet: loaded.top10ReleaseSet,
      validationOptions: {
        harnessAuthorityBytes: loaded.harnessAuthorityBytes,
        top10ReleaseSetBytes: loaded.top10ReleaseSetBytes,
      },
    });
    if (item.distribution.kind === 'hosted-plugin-verified' &&
        (!options.artifact || options.checkout || options.resolution)) {
      fail('hosted preparation requires only one authority-bound artifact');
    }
    const record = item.distribution.kind === 'hosted-plugin-verified'
      ? await prepareHosted({ item, artifact: options.artifact, output: options.output })
      : await prepareUpstream({
          item,
          artifact: options.artifact,
          checkout: options.checkout,
          resolution: options.resolution,
          output: options.output,
        });
    process.stdout.write(`${JSON.stringify({ prepared: true, catalogId: record.catalogId, kind: record.distributionKind }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
