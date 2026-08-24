#!/usr/bin/env node

import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateFinalContractOffline } from './rc2-final-contract.mjs';

if (process.argv.length !== 2) {
  throw new Error('usage: validate-rc2-final-contract.mjs');
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  process.stdout.write(
    `${JSON.stringify(await validateFinalContractOffline())}\n`
  );
}
