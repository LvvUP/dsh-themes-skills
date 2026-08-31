import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const mapUrl = new URL(
  '../skills/dsh-plugin-installer/references/alpha1-plugin-migration-map.md',
  import.meta.url
);
const skillUrl = new URL('../skills/dsh-plugin-installer/SKILL.md', import.meta.url);
const contractUrl = new URL(
  '../skills/dsh-plugin-installer/references/plugin-install-contract.md',
  import.meta.url
);

test('plugin review instructions bind the official alpha.1 migration boundary', async () => {
  const [migrationMap, skill, contract] = await Promise.all([
    readFile(mapUrl, 'utf8'),
    readFile(skillUrl, 'utf8'),
    readFile(contractUrl, 'utf8'),
  ]);

  assert.match(migrationMap, /dsh-v0\.1\.2-alpha\.1/u);
  assert.match(migrationMap, /cd5ef8148158c3a752a658978873241fdf8e2bbc/u);
  assert.match(migrationMap, /a712eec535b48badc4fefb4df5176a7002e4280b/u);
  assert.match(migrationMap, /no aggregate client\/runtime package/u);
  assert.match(migrationMap, /no replacement central APIProxy service/u);
  assert.match(
    migrationMap,
    /const rejection = ctx\.connection\.requestRejection\(request\)[\s\S]+if \(rejection !== undefined\)[\s\S]+response\.writeHead\(rejection\)[\s\S]+response\.end\([\s\S]+return/u
  );
  assert.match(migrationMap, /does not send or stop the request by itself/u);
  assert.match(migrationMap, /execution must not continue after the rejection/u);
  assert.match(migrationMap, /@deepseek-ai\/dsh-api-session-controller\/client/u);
  assert.match(migrationMap, /@deepseek-ai\/dsh-client-ui-conversation/u);
  assert.match(migrationMap, /@deepseek-ai\/dsh-client-ui-renderer\/client/u);
  assert.match(migrationMap, /@deepseek-ai\/dsh-api-remotes\/client/u);
  assert.match(migrationMap, /macOS arm64, Linux x64, and Windows x64/u);
  assert.match(migrationMap, /Node 22\.19\.0 and 24\.15\.0/u);

  for (const instructions of [skill, contract]) {
    assert.match(instructions, /alpha1-plugin-migration-map\.md/u);
    assert.match(instructions, /#3089/u);
  }
});
