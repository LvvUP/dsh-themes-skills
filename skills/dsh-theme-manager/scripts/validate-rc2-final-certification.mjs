#!/usr/bin/env node

import { isAbsolute, resolve } from 'node:path';

import { validateFinalCertificationBundle } from './rc2-final-evidence.mjs';

function fail(message) {
  throw new Error(`RC.2 final certification validation refused: ${message}`);
}

function parseArgs(argv) {
  if (argv.length !== 2 || argv[0] !== '--bundle' || !argv[1]) {
    fail('usage: validate-rc2-final-certification.mjs --bundle <absolute-directory>');
  }
  if (!isAbsolute(argv[1])) fail('bundle directory must be absolute');
  return resolve(argv[1]);
}

const bundleDirectory = parseArgs(process.argv.slice(2));
const result = await validateFinalCertificationBundle(bundleDirectory);
process.stdout.write(`${JSON.stringify(result)}\n`);
