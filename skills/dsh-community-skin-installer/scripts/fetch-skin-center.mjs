#!/usr/bin/env node

import { createHash, randomBytes } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { access, link, mkdir, readFile, stat, unlink } from 'node:fs/promises';
import https from 'node:https';
import { dirname, isAbsolute } from 'node:path';
import { pipeline } from 'node:stream/promises';

const catalogUrl = new URL('../references/community-catalog.json', import.meta.url);
const DOWNLOAD_TIMEOUT_MS = 5 * 60 * 1000;

function fail(message) {
  throw new Error(message);
}

function outputArg(argv) {
  if (argv.length !== 2 || argv[0] !== '--output' || !argv[1]) {
    fail('Usage: fetch-skin-center.mjs --output <absolute-new-file.tgz>');
  }
  if (!isAbsolute(argv[1])) fail('--output must be absolute');
  if (!argv[1].endsWith('.tgz')) fail('--output must end in .tgz');
  return argv[1];
}

function request(url, signal) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          Accept: 'application/octet-stream',
          'User-Agent': 'dsh-community-skin-installer/1',
        },
        signal,
      },
      (response) => resolve(response)
    );
    req.setTimeout(30_000, () => req.destroy(new Error('Download timed out')));
    req.on('error', reject);
  });
}

const output = outputArg(process.argv.slice(2));
const catalog = JSON.parse(await readFile(catalogUrl, 'utf8'));
const authority = catalog.skinCenter;
const parsed = new URL(authority.tarballUrl);
if (parsed.protocol !== 'https:' || parsed.username || parsed.password) {
  fail('Catalog tarball URL must be credential-free HTTPS');
}

await mkdir(dirname(output), { recursive: true, mode: 0o700 });
try {
  await access(output);
  fail('Refusing to overwrite the output file');
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const partial = `${output}.partial-${process.pid}-${randomBytes(6).toString('hex')}`;
const controller = new AbortController();
const deadline = setTimeout(
  () => controller.abort(new Error('Download exceeded the five-minute total limit')),
  DOWNLOAD_TIMEOUT_MS
);
let response;
try {
  response = await request(parsed, controller.signal);
  if (response.statusCode !== 200) {
    response.resume();
    fail(`Unexpected HTTP status ${response.statusCode}; redirects are refused`);
  }
  if (response.headers['content-encoding']) {
    response.resume();
    fail('Content-Encoding is refused because hashes cover the exact tarball bytes');
  }
  const length = Number(response.headers['content-length']);
  if (!Number.isSafeInteger(length) || length !== authority.sizeBytes) {
    response.resume();
    fail('Content-Length does not match the catalog authority');
  }
  const sha256 = createHash('sha256');
  const sha512 = createHash('sha512');
  let bytes = 0;
  response.on('data', (chunk) => {
    bytes += chunk.length;
    if (bytes > authority.sizeBytes) response.destroy(new Error('Response exceeded size limit'));
    sha256.update(chunk);
    sha512.update(chunk);
  });
  await pipeline(response, createWriteStream(partial, { flags: 'wx', mode: 0o600 }));
  const digest = sha256.digest('hex');
  const integrity = `sha512-${sha512.digest('base64')}`;
  if (bytes !== authority.sizeBytes) fail('Downloaded size does not match the catalog');
  if (digest !== authority.sha256) fail('Downloaded SHA-256 does not match the catalog');
  if (integrity !== authority.integrity) fail('Downloaded npm integrity does not match the catalog');
  const info = await stat(partial);
  if (!info.isFile() || info.size !== authority.sizeBytes) fail('Downloaded file shape is invalid');
  await link(partial, output);
  await unlink(partial);
  process.stdout.write(
    `${JSON.stringify({ output, bytes, sha256: digest, integrity, package: authority.packageName, version: authority.version }, null, 2)}\n`
  );
} catch (error) {
  response?.destroy();
  await unlink(partial).catch(() => undefined);
  throw error;
} finally {
  clearTimeout(deadline);
}
