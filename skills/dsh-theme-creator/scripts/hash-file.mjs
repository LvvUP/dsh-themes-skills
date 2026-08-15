#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--input' || !isAbsolute(args[1])) {
  throw new Error('Usage: hash-file.mjs --input <absolute-file>');
}
const path = resolve(args[1]);
const metadata = await stat(path);
if (!metadata.isFile() || metadata.size > 25 * 1024 * 1024) throw new Error('Input must be a regular file no larger than 25MB');
const bytes = await readFile(path);
const digest = createHash('sha256').update(bytes).digest();
process.stdout.write(`${JSON.stringify({ bytes: bytes.length, sha256: digest.toString('hex'), integrity: `sha256-${digest.toString('base64')}` })}\n`);
