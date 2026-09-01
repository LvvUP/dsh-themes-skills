#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import { lstat, readFile, realpath } from 'node:fs/promises';
import { isAbsolute, join, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadAuthority, sha256, validateAuthority } from './authority.mjs';

function fail(message) {
  throw new Error(message);
}

function git(source, args) {
  const executablePath = process.env.PATH ?? process.env.Path;
  if (typeof executablePath !== 'string' || executablePath.length === 0 ||
      executablePath.includes('\0')) {
    fail('source verification requires one explicit executable PATH');
  }
  const environment = {
    PATH: executablePath,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
    GIT_TERMINAL_PROMPT: '0',
    GIT_OPTIONAL_LOCKS: '0',
    GIT_NO_REPLACE_OBJECTS: '1',
    GCM_INTERACTIVE: 'Never',
  };
  for (const name of ['SystemRoot', 'WINDIR']) {
    if (typeof process.env[name] === 'string') environment[name] = process.env[name];
  }
  const result = spawnSync('git', [
    '-c', 'core.fsmonitor=false', '-c', 'core.hooksPath=', '-C', source, ...args,
  ], {
    encoding: 'utf8',
    env: environment,
    shell: false,
    timeout: 30_000,
    windowsHide: true,
  });
  if (result.error || result.status !== 0 || String(result.stderr ?? '').trim() !== '') {
    fail('source checkout Git identity probe failed');
  }
  return result.stdout.trim();
}

async function safeSourceRoot(input) {
  if (!isAbsolute(input)) fail('--source must be an absolute path');
  const source = resolve(input);
  if (source === parse(source).root) fail('--source cannot be a filesystem root');
  const stat = await lstat(source);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail('--source must be a real directory, not a symlink');
  return realpath(source);
}

export async function verifySourceCheckout(input, authorityInput) {
  const authority = validateAuthority(authorityInput);
  const source = await safeSourceRoot(input);
  if (git(source, ['rev-parse', 'HEAD']) !== authority.release.commit) fail('source HEAD does not match alpha.2 commit');
  if (git(source, ['rev-parse', 'HEAD^{tree}']) !== authority.release.tree) fail('source tree does not match alpha.2 tree');
  if (git(source, ['rev-parse', `refs/tags/${authority.release.tag}^{commit}`]) !== authority.release.commit) {
    fail('source tag does not resolve to the alpha.2 commit');
  }
  if (git(source, ['remote', 'get-url', 'origin']) !== authority.officialRepository) {
    fail('source origin does not match the official repository');
  }
  const dirty = git(source, ['status', '--porcelain=v1', '--untracked-files=all']);
  if (dirty !== '') fail('source checkout is dirty');

  const lockBytes = await readFile(join(source, authority.source.lockfilePath));
  if (lockBytes.byteLength !== authority.source.lockfileBytes) fail('source lockfile byte count mismatch');
  if (sha256(lockBytes) !== authority.source.lockfileSha256) fail('source lockfile digest mismatch');

  const safetyBytes = await readFile(join(source, authority.officialSafety.path));
  if (safetyBytes.byteLength !== authority.officialSafety.bytes ||
      sha256(safetyBytes) !== authority.officialSafety.sha256 ||
      git(source, ['hash-object', '--no-filters', '--', authority.officialSafety.path]) !==
        authority.officialSafety.gitBlob) {
    fail('official SAFETY.md bytes do not match the alpha.2 authority');
  }

  const rootManifest = JSON.parse(await readFile(join(source, 'package.json'), 'utf8'));
  if (rootManifest.name !== '@deepseek-ai/dsh-root' ||
      rootManifest.version !== authority.release.version ||
      rootManifest.packageManager !== `pnpm@${authority.source.packageManagerVersion}` ||
      rootManifest.engines?.node !== authority.source.nodeEngine ||
      rootManifest.scripts?.[authority.source.buildScript] !==
        'tsx scripts/build.ts --profile official' ||
      rootManifest.scripts?.['build:web'] !==
        'pnpm --filter @deepseek-ai/dsh-web-frontend run build') {
    fail('root package manifest does not match the alpha.2 source-build contract');
  }
  for (const expected of authority.packages) {
    const manifest = JSON.parse(await readFile(join(source, expected.path), 'utf8'));
    if (manifest.name !== expected.name || manifest.version !== expected.version) {
      fail(`${expected.path} package identity mismatch`);
    }
    if (expected.path === 'apps/web/package.json' &&
        manifest.scripts?.build !== 'vite build') {
      fail('apps/web build script differs from the alpha.2 source-build contract');
    }
  }

  return {
    source,
    tag: authority.release.tag,
    commit: authority.release.commit,
    tree: authority.release.tree,
    lockfileSha256: authority.source.lockfileSha256,
    packageManagerVersion: authority.source.packageManagerVersion,
    safetySha256: authority.officialSafety.sha256,
    version: authority.release.version,
  };
}

function parseArgs(argv) {
  if (argv.length !== 2 || argv[0] !== '--source') fail('usage: verify-source.mjs --source <absolute-checkout>');
  return argv[1];
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const verified = await verifySourceCheckout(parseArgs(process.argv.slice(2)), await loadAuthority());
    process.stdout.write(`${JSON.stringify({ ...verified, source: '<local-source-root>' }, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
