#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { writeSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';

const MAX_BYTES = 25 * 1024 * 1024;
const SHA256 = /^[0-9a-f]{64}$/;
const CONTROLLED_DOWNLOAD =
  /^\/api\/themes\/[a-z0-9]+(?:-[a-z0-9]+)*\/download\/(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value == null) {
      throw new Error('Usage: fetch-and-verify.mjs --source <url-or-path> --sha256 <hex> --output <path>');
    }
    values[key.slice(2)] = value;
  }
  return values;
}

async function readLocal(source) {
  if (!isAbsolute(source)) throw new Error('Local package sources must use an absolute path');
  const path = resolve(source);
  const metadata = await stat(path);
  if (!metadata.isFile()) throw new Error('Local package source must be a regular file');
  if (metadata.size > MAX_BYTES) throw new Error(`Package exceeds ${MAX_BYTES} bytes`);
  return readFile(path);
}

function trustedOrigin(value) {
  if (!value) throw new Error('--origin is required for remote package sources');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('origin must be a credential-free HTTPS origin such as https://themes.example');
  }
  return url.origin;
}

function validateRemoteUrl(value, origin, expectedPath) {
  const url = new URL(value);
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.origin !== origin ||
    url.search ||
    url.hash
  ) {
    throw new Error('Remote package URL must be credential-free HTTPS on the trusted origin');
  }
  if (!CONTROLLED_DOWNLOAD.test(url.pathname)) {
    throw new Error('Remote package URL must use the controlled theme download route');
  }
  if (expectedPath && url.pathname !== expectedPath) {
    throw new Error('Redirected package URL must remain on the same controlled theme download path');
  }
  return url;
}

async function readRemote(source, originValue) {
  const origin = trustedOrigin(originValue);
  const current = validateRemoteUrl(source, origin);
  const controlledPath = current.pathname;

  let response = await fetch(current, {
    redirect: 'manual',
    signal: AbortSignal.timeout(30_000),
  });

  if (response.status >= 300 && response.status < 400) {
    if (response.status !== 307) {
      throw new Error('Only one HTTP 307 cookie bootstrap redirect is allowed');
    }
    const location = response.headers.get('location');
    const setCookie = response.headers.get('set-cookie');
    if (!location || !setCookie) {
      throw new Error('HTTP 307 bootstrap requires both Location and Set-Cookie');
    }
    const next = validateRemoteUrl(
      new URL(location, current).toString(),
      origin,
      controlledPath
    );
    const pair = setCookie.split(';', 1)[0];
    if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+=[^;\r\n]*$/.test(pair)) {
      throw new Error('Download bootstrap returned an invalid cookie');
    }
    await response.body?.cancel();
    response = await fetch(next, {
      redirect: 'manual',
      headers: { cookie: pair },
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status >= 300 && response.status < 400) {
      throw new Error('A second download redirect is not allowed');
    }
  }

  if (!response.ok) throw new Error(`Download failed with HTTP ${response.status}`);
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_BYTES) throw new Error(`Package exceeds ${MAX_BYTES} bytes`);
    if (!response.body) throw new Error('Download returned no response body');

    const chunks = [];
    let total = 0;
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) {
        await reader.cancel();
        throw new Error(`Package exceeds ${MAX_BYTES} bytes`);
      }
      chunks.push(Buffer.from(value));
    }
    return Buffer.concat(chunks, total);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.source || !args.sha256 || !args.output) throw new Error('source, sha256, and output are required');
  if (!SHA256.test(args.sha256)) throw new Error('sha256 must be 64 lowercase hexadecimal characters');
  if (!isAbsolute(args.output)) throw new Error('output must use an absolute path');

  const bytes = /^https?:\/\//i.test(args.source) ? await readRemote(args.source, args.origin) : await readLocal(args.source);
  if (bytes.byteLength > MAX_BYTES) throw new Error(`Package exceeds ${MAX_BYTES} bytes`);
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== args.sha256) throw new Error(`SHA-256 mismatch: expected ${args.sha256}, received ${actual}`);

  const output = resolve(args.output);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, bytes, { flag: 'wx', mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ output, bytes: bytes.byteLength, sha256: actual })}\n`);
}

main().catch((error) => {
  writeSync(
    process.stderr.fd,
    `${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
});
