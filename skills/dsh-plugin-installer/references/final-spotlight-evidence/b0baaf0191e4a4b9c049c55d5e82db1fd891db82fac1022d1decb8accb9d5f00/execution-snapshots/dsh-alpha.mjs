#!/usr/bin/env node
import { execFileSync, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { mkdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ALPHA_SOURCE = JSON.parse(
  readFileSync(new URL('../references/runtime-source.alpha.json', import.meta.url), 'utf8')
);

export function verifyAlphaSource(source) {
  source = realpathSync(source);
  for (let ancestor = path.dirname(source); ; ancestor = path.dirname(ancestor)) {
    if (existsSync(path.join(ancestor, 'node_modules'))) {
      throw new Error('Build Alpha in an independent directory without ancestor node_modules; parent dependencies can change TypeScript resolution.');
    }
    if (path.dirname(ancestor) === ancestor) break;
  }
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
    cwd: source, encoding: 'utf8',
  }).trim();
  const lock = createHash('sha256')
    .update(readFileSync(path.join(source, 'pnpm-lock.yaml'))).digest('hex');
  const manifest = JSON.parse(readFileSync(path.join(source, 'package.json'), 'utf8'));
  if (commit !== ALPHA_SOURCE.commit || lock !== ALPHA_SOURCE.lockfileSha256 ||
      manifest.version !== ALPHA_SOURCE.version) {
    throw new Error('Alpha source does not match the selected release. Use a fresh source directory.');
  }
  execFileSync('git', ['diff', '--quiet', 'HEAD', '--'], { cwd: source, stdio: 'pipe' });
}

export function alphaSourceDirectory() {
  return path.resolve(process.env.DSH_ALPHA_SOURCE ||
    path.join(os.homedir(), '.dsh-themes', 'runtimes', ALPHA_SOURCE.version));
}

/** Checks the declared build files in addition to the immutable source revision. */
export function readAlphaRuntime() {
  const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const proofBytes = readFileSync(new URL(`../references/${ALPHA_SOURCE.verification.file}`, import.meta.url));
  if (digest(proofBytes) !== ALPHA_SOURCE.verification.sha256)
    throw new Error('Alpha runtime evidence digest differs.');
  const proof = JSON.parse(proofBytes.toString('utf8'));
  if (proof.status !== 'verified-source-runtime' || proof.itemAuthority !== 'separate-receipt-required' ||
      proof.compatibility.dshPackageVersion !== ALPHA_SOURCE.version ||
      proof.compatibility.officialRelease.sourceCommit !== ALPHA_SOURCE.commit ||
      proof.compatibility.npmArtifacts !== null)
    throw new Error('Alpha runtime evidence does not match this source release.');
  return proof;
}

export function verifyAlphaBuild(source = alphaSourceDirectory()) {
  verifyAlphaSource(source);
  const proof = readAlphaRuntime();
  const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
  const files = [
    ...proof.buildFiles.webAssets.map((entry) => ({ ...entry, path: `apps/web/${entry.path}` })),
    ...proof.buildFiles.clientModules,
    proof.compatibility.sourceBuild.cliEntry,
    { path: proof.launch.sourceEntry, sha256: proof.launch.sourceEntrySha256 },
    ...Object.values(proof.compatibility.webEntrypoints).map((entry) => ({ ...entry, path: `apps/web/${entry.path}` })),
  ];
  for (const entry of files) {
    if (typeof entry.path !== 'string' || entry.path.startsWith('/') || entry.path.split('/').includes('..'))
      throw new Error('Unsafe runtime evidence path.');
    const bytes = readFileSync(path.join(source, entry.path));
    if (digest(bytes) !== entry.sha256 || (entry.sizeBytes !== undefined && bytes.length !== entry.sizeBytes))
      throw new Error(`Alpha build file changed: ${entry.path}`);
  }
  return proof;
}

export async function runSourceCommand(command, args, source) {
  const grouped = process.platform !== 'win32';
  const child = spawn(command, args, {
    cwd: source, stdio: 'inherit', shell: false, detached: grouped,
    env: { ...process.env, CI: 'true', DSH_TELEMETRY_DISABLED: '1' },
  });
  return new Promise((resolve, reject) => {
    const forward = (signal) => {
      try {
        if (grouped) process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch (error) {
        if (error.code !== 'ESRCH') reject(error);
      }
    };
    const onInterrupt = () => forward('SIGINT');
    const onTerminate = () => forward('SIGTERM');
    const cleanup = () => {
      process.off('SIGINT', onInterrupt);
      process.off('SIGTERM', onTerminate);
    };
    process.on('SIGINT', onInterrupt);
    process.on('SIGTERM', onTerminate);
    child.once('error', (error) => { cleanup(); reject(error); });
    child.once('exit', (code, signal) => {
      cleanup();
      if (signal) reject(new Error(`${command} stopped by ${signal}`));
      else resolve(code ?? 1);
    });
  });
}

export function sourceCorepackInvocation(args, { platform = process.platform, nodeExecutable = process.execPath } = {}) {
  if (platform === 'win32') {
    // Node 24 cannot spawn .cmd shims without a shell. Run Corepack's JS entry
    // through the same Node executable and keep each user argument separate.
    return { command: nodeExecutable, args: [path.win32.join(path.win32.dirname(nodeExecutable), 'node_modules/corepack/dist/corepack.js'), ...args] };
  }
  return { command: 'corepack', args: [...args] };
}

export async function main(args = process.argv.slice(2)) {
  const source = alphaSourceDirectory();
  const runPnpm = (args) => {
    const invocation = sourceCorepackInvocation(['pnpm', ...args]);
    return runSourceCommand(invocation.command, invocation.args, source);
  };
  if (args[0] === '--bootstrap') {
    if (args.length !== 1) throw new Error('Use DSH_ALPHA_SOURCE to choose the source directory.');
    if (!existsSync(source)) {
      await mkdir(path.dirname(source), { recursive: true });
      const code = await runSourceCommand('git', ['clone', '--depth', '1', '--branch',
        ALPHA_SOURCE.tag, ALPHA_SOURCE.repository, source], path.dirname(source));
      if (code !== 0) return code;
    }
    verifyAlphaSource(source);
    const install = await runPnpm(['install', '--frozen-lockfile']);
    if (install !== 0) return install;
    return runPnpm(['run', ALPHA_SOURCE.buildScript]);
  }
  if (!existsSync(source)) throw new Error('Run dsh-alpha.mjs --bootstrap first.');
  verifyAlphaSource(source);
  if (args[0] === '--check-build') {
    if (args.length !== 1) throw new Error('Usage: dsh-alpha.mjs --check-build');
    const proof = verifyAlphaBuild(source);
    process.stdout.write(JSON.stringify({ version: ALPHA_SOURCE.version, status: proof.status,
      itemAuthority: proof.itemAuthority, attestationSha256: ALPHA_SOURCE.verification.sha256 }) + '\n');
    return 0;
  }
  if (args[0] === '--check-source') {
    process.stdout.write(JSON.stringify({ ...ALPHA_SOURCE, source }) + '\n');
    return 0;
  }
  if (!existsSync(path.join(source, 'apps/cli/lib/bin.js'))) {
    throw new Error('Alpha source has not been built. Run dsh-alpha.mjs --bootstrap first.');
  }
  return runPnpm(['--silent', 'dsh', ...args]);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => { process.exitCode = code; }).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
