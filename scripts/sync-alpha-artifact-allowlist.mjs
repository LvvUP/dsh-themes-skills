#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { lstat, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const start = '# BEGIN verified Alpha artifact allowlist';
const end = '# END verified Alpha artifact allowlist';
const sha = value => createHash('sha256').update(value).digest('hex');
export async function currentAlphaFiles(directory = root) {
  const files = new Map();
  for (const skill of ['dsh-plugin-installer', 'dsh-community-skin-installer']) {
    const catalog = JSON.parse(await readFile(resolve(directory, `skills/${skill}/references/${skill === 'dsh-plugin-installer' ? 'plugins' : 'community-recipes'}.json`)));
    for (const item of catalog.items.filter(item => item.validation?.status === 'runtime-verified')) {
      if (item.artifact?.path) {
        if (!/^assets\/alpha\/artifacts\/[a-f0-9]{64}\.tgz$/.test(item.artifact.path) || !item.artifact.path.includes(item.artifact.sha256)) throw new Error(`Invalid artifact path for #${item.catalogId}`);
        files.set(`skills/${skill}/${item.artifact.path}`, { sha256: item.artifact.sha256, bytes: item.artifact.bytes });
      }
      if (item.companion) {
        const companion = item.companion;
        if (!/^assets\/alpha\/skin-center\/user-skins\/[a-z0-9-]+$/.test(companion.sourcePath)) throw new Error('Invalid companion source path');
        for (const file of companion.files) {
          if (!file.path || file.path.split(/[\\/]/).some(part => !part || part === '.' || part === '..')) throw new Error('Invalid companion file path');
          files.set(`skills/${skill}/${companion.sourcePath}/${file.path}`, file);
        }
      }
    }
  }
  for (const [file, expected] of files) {
    const full = resolve(directory, file);
    const info = await lstat(full);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error(`Missing regular distribution file: ${file}`);
    const bytes = await readFile(full);
    if (sha(bytes) !== expected.sha256 || (expected.bytes !== undefined && bytes.length !== expected.bytes)) throw new Error(`Distribution file bytes differ: ${file}`);
  }
  return files;
}
export async function syncAlphaArtifactAllowlist({ directory = root, check = false, checkTracked = false } = {}) {
  const files = await currentAlphaFiles(directory);
  const archives = [...files.keys()].filter(path => path.endsWith('.tgz')).sort();
  const ignore = resolve(directory, '.gitignore');
  const previous = await readFile(ignore, 'utf8');
  const block = `${start}\n${archives.map(path => `!/${path}`).join('\n')}\n${end}\n`;
  const base = previous.includes(start) ? previous.slice(0, previous.indexOf(start)) + previous.slice(previous.indexOf(end) + end.length).replace(/^\n/, '') : previous;
  const next = base.trimEnd() + '\n\n' + block;
  if (check && previous !== next) throw new Error('Verified Alpha artifact allowlist is stale. Run this script without --check.');
  if (!check && previous !== next) await writeFile(ignore, next);
  for (const [file, expected] of files) {
    const checkIgnore = spawnSync('git', ['check-ignore', '--no-index', '--non-matching', '--verbose', file], { cwd: directory, encoding: 'utf8' });
    if (![0, 1].includes(checkIgnore.status)) throw new Error(checkIgnore.stderr || 'git check-ignore failed');
    const ignored = checkIgnore.stdout.trim();
    if (ignored && !ignored.split('\t')[0].split(':').slice(2).join(':').startsWith('!') && !ignored.startsWith('::')) throw new Error(`Distribution file is ignored: ${file}`);
    if (checkTracked) {
      let indexed;
      try { indexed = execFileSync('git', ['show', `:${file}`], { cwd: directory, maxBuffer: 100 * 1024 * 1024 }); }
      catch { throw new Error(`Distribution file is unavailable to a clean checkout: ${file}`); }
      if (sha(indexed) !== expected.sha256) throw new Error(`Indexed distribution bytes differ: ${file}`);
    }
  }
  return { artifacts: archives.length, companionFiles: files.size - archives.length, checkTracked };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const flags = process.argv.slice(2);
  if (flags.some(flag => !['--check', '--check-tracked'].includes(flag))) throw new Error('Use --check and optional --check-tracked.');
  console.log(JSON.stringify(await syncAlphaArtifactAllowlist({ check: flags.includes('--check'), checkTracked: flags.includes('--check-tracked') })));
}
