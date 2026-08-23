#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { validateCandidateBaseline } from '../scripts/validate-baseline-candidate.mjs';

const runtimeDir = dirname(fileURLToPath(import.meta.url));
const skillDir = resolve(runtimeDir, '..');
const MAX_HTML_BYTES = 2 * 1024 * 1024;

function parseArgs(argv) {
  if (argv.length !== 2 || argv[0] !== '--receipt' || !isAbsolute(argv[1])) {
    throw new Error('usage: smoke-runtime.mjs --receipt <absolute-json-path>');
  }
  return { receiptPath: resolve(argv[1]) };
}

const sha256 = (value) =>
  createHash('sha256').update(value).digest('hex');

async function writeReceipt(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
}

async function waitForExit(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await Promise.race([
    new Promise((done) => child.once('exit', done)),
    new Promise((done) => setTimeout(done, timeoutMs)),
  ]);
}

async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill('SIGTERM');
  await waitForExit(child, 5_000);
  if (child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL');
    await waitForExit(child, 5_000);
  }
}

async function fetchHealthyHtml(url, child) {
  const deadline = Date.now() + 45_000;
  let lastError = 'server did not answer';
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error(`dsh web exited before health check (${child.exitCode ?? child.signalCode})`);
    }
    try {
      const response = await fetch(url, {
        redirect: 'error',
        signal: AbortSignal.timeout(3_000),
      });
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > MAX_HTML_BYTES) {
        throw new Error('health response exceeds 2 MiB');
      }
      const contentType = response.headers.get('content-type') ?? '';
      const html = bytes.toString('utf8');
      if (
        response.status !== 200 ||
        !contentType.toLowerCase().includes('text/html') ||
        !/<html[\s>]/i.test(html) ||
        !/<script\b/i.test(html)
      ) {
        throw new Error('root response is not a hydrated HTML entry document');
      }
      return {
        status: response.status,
        contentType,
        bytes: bytes.length,
        sha256: sha256(bytes),
        hasClientScriptEntry: true,
      };
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await new Promise((done) => setTimeout(done, 250));
    }
  }
  throw new Error(`health check timed out: ${lastError}`);
}

async function run() {
  const { receiptPath } = parseArgs(process.argv.slice(2));
  const startedAt = new Date().toISOString();
  const candidate = await validateCandidateBaseline();
  const profileDir = await mkdtemp(resolve(tmpdir(), 'dsh-rc2-smoke-'));
  const dshBin = resolve(runtimeDir, 'node_modules/@deepseek-ai/dsh/lib/bin.js');
  const command = [
    process.execPath,
    dshBin,
    'web',
    '--host',
    '127.0.0.1',
    '--no-open',
    '--port',
    '0',
  ];
  let child;
  let output = '';
  let baseReceipt = {
    schemaVersion: 1,
    receiptKind: 'rc2-runtime-smoke-non-promotional',
    promotionAuthority: false,
    installable: false,
    baseline: `@deepseek-ai/dsh@${candidate.dshVersion}`,
    sidecarSha256: candidate.sidecarSha256,
    pendingAttestationSha256: candidate.attestationSha256,
    startedAt,
    environment: {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.versions.node,
      githubRunId: process.env.GITHUB_RUN_ID ?? null,
      githubRunAttempt: process.env.GITHUB_RUN_ATTEMPT ?? null,
      githubJob: process.env.GITHUB_JOB ?? null,
      githubSha: process.env.GITHUB_SHA ?? null,
    },
    isolation: {
      temporaryDshHome: true,
      profileName: 'web',
      telemetryDisabled: true,
      loopbackOnly: true,
    },
    command: command.slice(2),
  };

  try {
    child = spawn(command[0], command.slice(1), {
      cwd: profileDir,
      env: {
        ...process.env,
        DSH_HOME: profileDir,
        DSH_TELEMETRY_DISABLED: '1',
        NO_COLOR: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const url = await new Promise((accept, reject) => {
      const timeout = setTimeout(
        () => reject(new Error('dsh web did not report its loopback URL')),
        30_000
      );
      const inspect = (chunk) => {
        output += chunk.toString('utf8');
        const match = /dsh web:\s+(http:\/\/127\.0\.0\.1:\d+)/.exec(output);
        if (match) {
          clearTimeout(timeout);
          accept(match[1]);
        }
      };
      child.stdout.on('data', inspect);
      child.stderr.on('data', inspect);
      child.once('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
      child.once('exit', (code, signal) => {
        clearTimeout(timeout);
        reject(new Error(`dsh web exited before readiness (${code ?? signal})`));
      });
    });
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname !== '127.0.0.1' || parsedUrl.protocol !== 'http:') {
      throw new Error('dsh web reported a non-loopback URL');
    }
    const health = await fetchHealthyHtml(`${parsedUrl.origin}/`, child);
    const receipt = {
      ...baseReceipt,
      status: 'smoke-passed',
      completedAt: new Date().toISOString(),
      health: { url: parsedUrl.origin, ...health },
      acceptance: {
        webNoOpenLoopbackHealth: 'passed',
        installListRemove: 'pending',
        lightDarkSystem: 'pending',
        managedColdRestart: 'pending',
        rollbackReverse: 'pending',
        communityItems: 'pending',
      },
      limitation:
        'This smoke receipt proves only one isolated loopback startup and HTML client entry response. It cannot promote the candidate or authorize installation.',
    };
    await writeReceipt(receiptPath, receipt);
    process.stdout.write(`${JSON.stringify({
      receipt: receiptPath,
      status: receipt.status,
      baseline: receipt.baseline,
      health: receipt.health,
      promotionAuthority: false,
    })}\n`);
  } catch (error) {
    const receipt = {
      ...baseReceipt,
      status: 'smoke-failed',
      completedAt: new Date().toISOString(),
      error: error instanceof Error ? error.message : String(error),
      outputSha256: sha256(output),
      acceptance: { webNoOpenLoopbackHealth: 'failed' },
      promotionAuthority: false,
      installable: false,
    };
    await writeReceipt(receiptPath, receipt);
    throw error;
  } finally {
    if (child) await stopChild(child);
    await rm(profileDir, { recursive: true, force: true });
  }
}

await run();
