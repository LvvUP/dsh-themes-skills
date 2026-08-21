#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';

import {
  loadCommunityAuthority,
  validateCommunityRecord,
} from './catalog-authority.mjs';

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  let input;
  let mode = 'inspect';
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--input') input = argv[++index];
    else if (arg === '--mode') mode = argv[++index];
    else fail(`Unknown argument: ${arg}`);
  }
  if (!input || !isAbsolute(input)) fail('--input must be an absolute path');
  if (mode !== 'inspect' && mode !== 'install') {
    fail('--mode must be inspect or install');
  }
  return { input, mode };
}

const { input, mode } = parseArgs(process.argv.slice(2));
const raw = JSON.parse(await readFile(input, 'utf8'));
const authority = await loadCommunityAuthority();
const result = validateCommunityRecord(raw, authority, { mode });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
