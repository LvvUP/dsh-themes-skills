#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { lstat, mkdir, open, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  lifecycleHooksFromManifest,
  loadAuthority,
  manifestHasRuntimeDependencyGraph,
  normalizeCatalogId,
  normalizeBundlePatch,
  resolveItems,
  validateItem,
} from './authority.mjs';
import { validateHostedArtifact, validateUpstreamArtifact } from './archive-policy.mjs';

const MAX_ARTIFACT_BYTES = 256 * 1024 * 1024;
const MAX_METADATA_BYTES = 4 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 1024 * 1024;
const MAX_LOCKFILE_BYTES = 32 * 1024 * 1024;
const MAX_REDIRECTS = 2;
const GITHUB_ASSET_ORIGINS = new Set([
  'https://github.com',
  'https://release-assets.githubusercontent.com',
  'https://objects.githubusercontent.com',
]);

function fail(message) {
  throw new Error(message);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function safeUrl(input, expectedOrigin) {
  let url;
  try {
    url = new URL(input);
  } catch {
    fail('authority-bound fetch URL is malformed');
  }
  if (url.protocol !== 'https:' || url.origin !== expectedOrigin || url.username || url.password ||
      url.search || url.hash || /[\u0000-\u001f\u007f]/u.test(url.href)) {
    fail('authority-bound fetch URL violates its fixed HTTPS origin');
  }
  return url;
}

async function boundedBody(response, maxBytes) {
  const declared = response.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) {
    fail('authority-bound response exceeds its byte limit');
  }
  if (!response.body || typeof response.body.getReader !== 'function') {
    fail('authority-bound response has no readable streaming body');
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!(value instanceof Uint8Array)) fail('authority-bound response emitted a non-byte chunk');
      total += value.byteLength;
      if (total > maxBytes) fail('authority-bound response exceeded its streaming byte limit');
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}

export async function fetchBoundedExact({
  url: input,
  expectedOrigin,
  allowedOrigins = new Set([expectedOrigin]),
  maxBytes,
  expectedBytes = null,
  expectedSha256 = null,
  accept = 'application/octet-stream',
  fetchImpl = globalThis.fetch,
}) {
  if (typeof fetchImpl !== 'function') fail('Fetch implementation is unavailable');
  if (!['application/json', 'application/octet-stream', 'application/vnd.github+json'].includes(accept)) {
    fail('authority-bound fetch Accept value is not an approved fixed media type');
  }
  let current = safeUrl(input, expectedOrigin);
  let redirects = 0;
  for (;;) {
    let response;
    try {
      response = await fetchImpl(current, {
        method: 'GET',
        redirect: 'manual',
        credentials: 'omit',
        headers: {
          accept,
          'user-agent': 'dsh-themes-skills-source-verifier/0.8.0',
        },
        signal: AbortSignal.timeout(30_000),
      });
    } catch {
      fail('authority-bound fetch failed before a response was verified');
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      if (redirects >= MAX_REDIRECTS) fail('authority-bound fetch exceeded its manual redirect limit');
      const location = response.headers.get('location');
      if (!location) fail('authority-bound redirect is missing Location');
      let next;
      try {
        next = new URL(location, current);
      } catch {
        fail('authority-bound redirect Location is malformed');
      }
      if (next.protocol !== 'https:' || next.username || next.password || next.hash ||
          !allowedOrigins.has(next.origin)) {
        fail('authority-bound redirect left the fixed origin allowlist');
      }
      current = next;
      redirects += 1;
      continue;
    }
    if (response.status < 200 || response.status >= 300 || !allowedOrigins.has(current.origin)) {
      fail(`authority-bound fetch returned HTTP ${response.status}`);
    }
    const bytes = await boundedBody(response, maxBytes);
    if (expectedBytes !== null && bytes.length !== expectedBytes) {
      fail('authority-bound response byte count mismatch');
    }
    const digest = sha256(bytes);
    if (expectedSha256 !== null && digest !== expectedSha256) {
      fail('authority-bound response SHA-256 mismatch');
    }
    return { bytes, sha256: digest, redirects };
  }
}

function npmMetadataUrl(packageName, version) {
  return `https://registry.npmjs.org/${encodeURIComponent(packageName)}/${encodeURIComponent(version)}`;
}

function validateExactNpmMetadata(bytes, item) {
  const source = item.distribution.source;
  if (sha256(bytes) !== source.metadataSha256) fail('exact npm version metadata SHA-256 mismatch');
  let metadata;
  try {
    metadata = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail('exact npm version metadata is not valid JSON');
  }
  if (metadata?.name !== source.packageName || metadata?.version !== source.version ||
      metadata?.dist?.tarball !== source.tarballUrl || metadata?.dist?.integrity !== source.distIntegrity) {
    fail('exact npm version metadata identity, tarball, or integrity mismatch');
  }
  return metadata;
}

function githubCoordinates(repository) {
  const match = /^https:\/\/github\.com\/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)\.git$/.exec(repository);
  if (!match) fail('Git commit repository coordinate is malformed');
  return { owner: match[1], repository: match[2] };
}

async function newOutput(input) {
  if (!isAbsolute(input)) fail('--output must be absolute');
  const requested = resolve(input);
  if (requested === parse(requested).root) fail('--output cannot be a filesystem root');
  const parent = await realpath(dirname(requested));
  const output = join(parent, basename(requested));
  try {
    await lstat(output);
    fail('--output must not already exist');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await mkdir(output, { mode: 0o700 });
  return realpath(output);
}

async function writePrivate(path, bytes) {
  await writeFile(path, bytes, { mode: 0o600, flag: 'wx' });
}

async function writeReceipt(output, receipt) {
  const handle = await open(join(output, 'fetch-receipt.json'), 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(receipt, null, 2)}\n`);
  } finally {
    await handle.close();
  }
}

function baseReceipt(item, sourceType) {
  return {
    schemaVersion: 1,
    status: 'authority-bound-source-verified',
    candidateExecuted: false,
    catalogId: item.catalogId,
    distributionKind: item.distribution.kind,
    sourceType,
    package: { name: item.package.name, version: item.package.version },
    evidence: {
      artifactBytes: null,
      artifactSha256: null,
      metadataSha256: null,
      manifestSha256: null,
      lockfileSha256: null,
      sourceCommit: null,
      sourceTree: null,
    },
    privacy: {
      capturesResponseHeaders: false,
      capturesRedirectLocations: false,
      capturesCredentials: false,
      capturesProcessOutput: false,
    },
  };
}

export async function fetchAuthorityBoundSource({
  item,
  output: outputInput,
  fetchImpl = globalThis.fetch,
}) {
  validateItem(item);
  const distribution = item.distribution;
  const sourceType = distribution.kind === 'hosted-plugin-verified' ? null : distribution.source.type;
  const receipt = baseReceipt(item, sourceType);
  const files = [];

  if (distribution.kind === 'hosted-plugin-verified') {
    const fetched = await fetchBoundedExact({
      url: distribution.artifactUrl,
      expectedOrigin: 'https://github.com',
      allowedOrigins: GITHUB_ASSET_ORIGINS,
      maxBytes: MAX_ARTIFACT_BYTES,
      expectedBytes: distribution.artifactBytes,
      expectedSha256: distribution.artifactSha256,
      fetchImpl,
    });
    validateHostedArtifact(fetched.bytes, item);
    files.push(['artifact.tgz', fetched.bytes]);
    receipt.evidence.artifactBytes = fetched.bytes.length;
    receipt.evidence.artifactSha256 = fetched.sha256;
    receipt.evidence.manifestSha256 = distribution.manifestSha256;
  } else if (sourceType === 'npm-package-version') {
    const source = distribution.source;
    const metadata = await fetchBoundedExact({
      url: npmMetadataUrl(source.packageName, source.version),
      expectedOrigin: 'https://registry.npmjs.org',
      maxBytes: MAX_METADATA_BYTES,
      expectedSha256: source.metadataSha256,
      accept: 'application/json',
      fetchImpl,
    });
    validateExactNpmMetadata(metadata.bytes, item);
    const artifact = await fetchBoundedExact({
      url: source.tarballUrl,
      expectedOrigin: 'https://registry.npmjs.org',
      maxBytes: MAX_ARTIFACT_BYTES,
      expectedBytes: source.tarballBytes,
      expectedSha256: source.tarballSha256,
      fetchImpl,
    });
    validateUpstreamArtifact(artifact.bytes, item);
    files.push(['metadata.json', metadata.bytes], ['artifact.tgz', artifact.bytes]);
    receipt.evidence.metadataSha256 = metadata.sha256;
    receipt.evidence.artifactBytes = artifact.bytes.length;
    receipt.evidence.artifactSha256 = artifact.sha256;
  } else if (sourceType === 'github-release-asset') {
    const source = distribution.source;
    const artifact = await fetchBoundedExact({
      url: source.assetUrl,
      expectedOrigin: 'https://github.com',
      allowedOrigins: GITHUB_ASSET_ORIGINS,
      maxBytes: MAX_ARTIFACT_BYTES,
      expectedBytes: source.assetBytes,
      expectedSha256: source.assetSha256,
      fetchImpl,
    });
    validateUpstreamArtifact(artifact.bytes, item);
    files.push(['artifact.tgz', artifact.bytes]);
    receipt.evidence.artifactBytes = artifact.bytes.length;
    receipt.evidence.artifactSha256 = artifact.sha256;
    receipt.evidence.manifestSha256 = source.manifestSha256;
  } else if (sourceType === 'git-commit') {
    const source = distribution.source;
    const coordinates = githubCoordinates(source.repository);
    const base = `${coordinates.owner}/${coordinates.repository}`;
    const commit = await fetchBoundedExact({
      url: `https://api.github.com/repos/${base}/git/commits/${source.commit}`,
      expectedOrigin: 'https://api.github.com',
      maxBytes: MAX_METADATA_BYTES,
      accept: 'application/vnd.github+json',
      fetchImpl,
    });
    let commitDocument;
    try {
      commitDocument = JSON.parse(commit.bytes.toString('utf8'));
    } catch {
      fail('GitHub commit identity response is not valid JSON');
    }
    if (commitDocument?.sha !== source.commit || commitDocument?.tree?.sha !== source.tree) {
      fail('GitHub commit identity response does not match the exact commit and tree');
    }
    const rawBase = `https://raw.githubusercontent.com/${base}/${source.commit}`;
    const manifest = await fetchBoundedExact({
      url: `${rawBase}/package.json`,
      expectedOrigin: 'https://raw.githubusercontent.com',
      maxBytes: MAX_MANIFEST_BYTES,
      expectedSha256: source.manifestSha256,
      fetchImpl,
    });
    const lockfile = source.lockfilePath === null ? null : await fetchBoundedExact({
      url: `${rawBase}/${source.lockfilePath}`,
      expectedOrigin: 'https://raw.githubusercontent.com',
      maxBytes: MAX_LOCKFILE_BYTES,
      expectedSha256: source.lockfileSha256,
      fetchImpl,
    });
    let manifestDocument;
    try {
      manifestDocument = JSON.parse(manifest.bytes.toString('utf8'));
    } catch {
      fail('Git commit package manifest is not valid JSON');
    }
    const lifecycle = lifecycleHooksFromManifest(manifestDocument);
    if (manifestDocument.name !== item.package.name || manifestDocument.version !== item.package.version ||
        normalizeBundlePatch(manifestDocument.dsh?.bundle?.patch) !== item.package.bundlePatch ||
        JSON.stringify(lifecycle) !==
          JSON.stringify(item.package.lifecycle.hooks)) {
      fail('Git commit manifest identity, patch, or lifecycle map mismatch');
    }
    if (lockfile === null &&
        (Object.values(lifecycle).some((value) => value !== null) ||
         manifestHasRuntimeDependencyGraph(manifestDocument))) {
      fail('lockless Git source must be prebuilt with no lifecycle hooks or runtime/peer dependencies');
    }
    files.push(['package.json', manifest.bytes]);
    if (lockfile !== null) files.push([source.lockfilePath, lockfile.bytes]);
    receipt.evidence.manifestSha256 = manifest.sha256;
    receipt.evidence.lockfileSha256 = lockfile?.sha256 ?? null;
    receipt.evidence.sourceCommit = source.commit;
    receipt.evidence.sourceTree = source.tree;
  } else {
    fail('unsupported authority-bound source type');
  }

  const output = await newOutput(outputInput);
  try {
    for (const [name, bytes] of files) await writePrivate(join(output, name), bytes);
    await writeReceipt(output, receipt);
    return { output, receipt };
  } catch (error) {
    await rm(output, { recursive: true, force: true });
    throw error;
  }
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (!['--id', '--output'].includes(argv[index]) || !argv[index + 1]) {
      fail('usage: fetch-plugin-source.mjs --id <#3NNN> --output <new-absolute-private-directory>');
    }
    const key = argv[index].slice(2);
    if (Object.hasOwn(options, key)) fail(`duplicate fetch argument --${key}`);
    options[key] = argv[++index];
  }
  if (!options.id || !options.output) fail('exact plugin ID and output directory are required');
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
        migrationMapBytes: loaded.migrationMapBytes,
        migrationMapSchemaBytes: loaded.migrationMapSchemaBytes,
        candidateIntakeBytes: loaded.candidateIntakeBytes,
      },
    });
    const result = await fetchAuthorityBoundSource({ item, output: options.output });
    process.stdout.write(`${JSON.stringify({
      verified: true,
      candidateExecuted: false,
      catalogId: result.receipt.catalogId,
      sourceType: result.receipt.sourceType,
    }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
