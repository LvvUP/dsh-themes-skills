#!/usr/bin/env node

import {
  assertPlannedMatrixTarget,
  loadAlpha2RecertificationAuthority,
} from './alpha2-recertification-authority.mjs';

function fail(message) {
  throw new Error(`alpha2 community recertification refused: ${message}`);
}

function parseArgs(argv) {
  let target;
  let nodeVersion;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--planned-target') target = argv[++index];
    else if (arg === '--node-version') nodeVersion = argv[++index];
    else fail(`unknown argument: ${arg}`);
  }
  if (Boolean(target) !== Boolean(nodeVersion)) {
    fail('--planned-target and --node-version must be supplied together');
  }
  return { target, nodeVersion };
}

const args = parseArgs(process.argv.slice(2));
const { authority, summary } = await loadAlpha2RecertificationAuthority();
if (args.target) {
  assertPlannedMatrixTarget(authority, args.target, args.nodeVersion);
}
process.stdout.write(
  `${JSON.stringify(
    {
      ...summary,
      validationMode: args.target ? 'planned-matrix-static-guard' : 'pending-authority',
      plannedTarget: args.target,
      nodeVersion: args.nodeVersion,
      runtimeExecuted: false,
      receiptProduced: false,
    },
    null,
    2
  )}\n`
);
