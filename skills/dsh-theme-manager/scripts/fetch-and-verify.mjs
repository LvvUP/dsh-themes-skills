#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';

const MAX_BYTES = 25 * 1024 * 1024;
const SHA256 = /^[0-9a-f]{64}$/;

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

async function readRemote(source, originValue) {
  const initial = new URL(source);
  if (initial.protocol !== 'https:') throw new Error('Remote package URLs must use HTTPS');
  const origin = trustedOrigin(originValue);
  if (initial.origin !== origin) throw new Error('Remote package URL must match the trusted origin');
  const response = await fetch(initial, { redirect: 'follow', signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`Download failed with HTTP ${response.status}`);
  if (new URL(response.url).origin !== origin) throw new Error('Redirected package URL must remain on the trusted origin');
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
  const actual = createHash('sha256').update(bytes).digest('hex');
  if (actual !== args.sha256) throw new Error(`SHA-256 mismatch: expected ${args.sha256}, received ${actual}`);

  const output = resolve(args.output);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, bytes, { flag: 'wx', mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ output, bytes: bytes.byteLength, sha256: actual })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
