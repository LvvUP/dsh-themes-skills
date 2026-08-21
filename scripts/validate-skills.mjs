#!/usr/bin/env node

import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = new URL('../skills/', import.meta.url);
const required = [
  'dsh-theme-manager',
  'dsh-theme-creator',
  'dsh-theme-finder',
  'dsh-theme-submitter',
  'dsh-community-skin-installer',
];

function fail(message) {
  throw new Error(message);
}

async function validateSkill(name) {
  if (!/^[a-z0-9-]{1,63}$/.test(name)) fail(`Invalid skill folder: ${name}`);
  const directory = new URL(`${name}/`, root);
  const markdown = (await readFile(new URL('SKILL.md', directory), 'utf8')).replace(
    /\r\n?/g,
    '\n'
  );
  const frontmatter = markdown.match(/^---\n([\s\S]*?)\n---\n/);
  if (!frontmatter) fail(`${name}: missing YAML frontmatter`);
  if (!new RegExp(`^name: ${name}$`, 'm').test(frontmatter[1])) {
    fail(`${name}: frontmatter name must match folder`);
  }
  const description = frontmatter[1].match(/^description: (.+)$/m)?.[1];
  if (!description || description.length < 40) fail(`${name}: description is too short`);
  if (/TODO|\[TODO/i.test(markdown)) fail(`${name}: unresolved TODO`);
  if (markdown.split('\n').length > 500) fail(`${name}: SKILL.md exceeds 500 lines`);

  const agentYaml = (
    await readFile(new URL('agents/openai.yaml', directory), 'utf8')
  ).replace(/\r\n?/g, '\n');
  for (const field of ['display_name', 'short_description', 'default_prompt']) {
    if (!new RegExp(`^  ${field}: "[^"]+"$`, 'm').test(agentYaml)) {
      fail(`${name}: agents/openai.yaml lacks quoted ${field}`);
    }
  }
  if (!agentYaml.includes(`$${name}`)) fail(`${name}: default_prompt must mention $${name}`);

  const scriptsDirectory = new URL('scripts/', directory);
  const scripts = (await readdir(scriptsDirectory)).filter((file) => file.endsWith('.mjs'));
  if (scripts.length === 0) fail(`${name}: at least one deterministic script is required`);
  for (const script of scripts) {
    const path = fileURLToPath(new URL(script, scriptsDirectory));
    const check = spawnSync(process.execPath, ['--check', path], { encoding: 'utf8' });
    if (check.status !== 0) fail(`${name}/${script}: ${check.stderr.trim()}`);
  }
}

const entries = (await readdir(root, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (JSON.stringify(entries) !== JSON.stringify([...required].sort())) {
  fail(`Expected exactly ${required.join(', ')}, found ${entries.join(', ')}`);
}

for (const name of required) await validateSkill(name);
process.stdout.write(`Validated ${required.length} skills.\n`);
