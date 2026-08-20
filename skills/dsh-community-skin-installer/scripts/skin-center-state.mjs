#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { isAbsolute } from 'node:path';

const PACKAGE = '@linxin666/dsh-client-ui-skin-center';
const LEGACY_AGGREGATE = '@linxin666/dsh-skins';
const VERSION = '0.2.5';

function fail(message) {
  throw new Error(message);
}

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--input' || !isAbsolute(args[1])) {
  fail('Usage: skin-center-state.mjs --input <absolute-plugin-list.json>');
}
const parsed = JSON.parse(await readFile(args[1], 'utf8'));
if (!Array.isArray(parsed)) fail('Plugin list must be the DSH root array');
const profiles = parsed.filter((entry) => entry?.name === 'dsh-profile-web');
if (profiles.length !== 1) fail('Expected exactly one dsh-profile-web record');
const dependencies = profiles[0]?.dependencies;
if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)) {
  fail('dsh-profile-web dependencies are missing');
}
if (dependencies[LEGACY_AGGREGATE]) {
  fail(
    dependencies[PACKAGE]
      ? 'Legacy aggregate and standalone Skin Center are both direct dependencies'
      : 'Legacy aggregate is a direct dependency; do not add standalone Skin Center'
  );
}
const dependency = dependencies[PACKAGE];
if (!dependency) {
  process.stdout.write(`${JSON.stringify({ installed: false, package: PACKAGE }, null, 2)}\n`);
  process.exit(0);
}
const version = typeof dependency === 'string' ? dependency : dependency.version;
if (version !== VERSION) fail(`Skin Center must be exact ${VERSION}`);
if (/^[~^*><=]|\s|\|/.test(version)) fail('Skin Center version ranges are forbidden');
process.stdout.write(
  `${JSON.stringify({ installed: true, package: PACKAGE, version, legacyAggregateDirect: Boolean(dependencies[LEGACY_AGGREGATE]) }, null, 2)}\n`
);
