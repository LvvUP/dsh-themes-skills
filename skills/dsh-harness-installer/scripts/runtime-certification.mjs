#!/usr/bin/env node

/**
 * Real alpha.2 runtime probes and candidate-only receipt aggregation.
 *
 * BrowserAuth material is held only in bounded process memory. It is never
 * printed, persisted, hashed, or included in an exception message.
 */
import { spawn } from 'node:child_process';
import { createHash, timingSafeEqual } from 'node:crypto';
import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  readFile,
  realpath,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { request as httpRequest } from 'node:http';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';

import { parseDocument } from 'yaml';

import {
  loadAuthority,
  validateBuildReceipt,
  validateInstallReceipt,
} from './authority.mjs';
import {
  RUNTIME_REPOSITORY,
  RUNTIME_WORKFLOW,
  runtimeProvenanceSet,
  runtimeProvenanceSetSha256,
  runtimeReceiptSetPayloadSha256,
  runtimeSha256,
  runtimeTasks,
  validateRuntimeReceipt,
  validateRuntimeReceiptSet,
} from './runtime-authority.mjs';
import { verifySourceCheckout } from './verify-source.mjs';

const MAX_CAPTURE = 1_048_576;
const MAX_HTTP_BODY = 32 * 1024 * 1024;
const MAX_EVIDENCE_FILE = 2 * 1024 * 1024;
const SHA40 = /^[a-f0-9]{40}$/u;
const SHA64 = /^[a-f0-9]{64}$/u;
const SHA12 = /^[a-f0-9]{12}$/u;
const INITIAL_ENTRY_REV = /^([a-f0-9]{16})-(?:0|[1-9]\d*)$/u;
const TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/u;
const SAFE_TUPLE = /^(?:linux-x64|darwin-arm64|win32-x64)-node-(?:22\.19\.0|24\.15\.0)$/u;
const bundledWorkflowPath = fileURLToPath(
  new URL(`../../../${RUNTIME_WORKFLOW}`, import.meta.url)
);
const SECRET_PATTERNS = Object.freeze([
  /[?&](?:token|access_token|auth|credential)=[^\s&#"']+/giu,
  /["'](?:token|launchToken|cookie|cookieValue|setCookie|set-cookie|authorization|credential|credentialValue)["']\s*:/giu,
  /["'][^"']*(?:token|cookie|credential)[^"']*(?:sha|hash|digest|hmac|fingerprint|correlation)[^"']*["']\s*:/giu,
  /(?:^|\r?\n)\s*(?:set-cookie|cookie|authorization)\s*:/gimu,
  /\bdsh(?:[-_][A-Za-z0-9_.]+)+=[^;\s"']+/giu,
  /(?<![A-Za-z0-9_-])[A-Za-z0-9_-]{43}(?![A-Za-z0-9_-])/gu,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/gu,
  /\bgh[opusr]_[A-Za-z0-9]{20,}\b/gu,
]);

function fail(message) {
  throw new Error(message);
}

function record(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value;
}

function exactKeys(value, keys, label) {
  const actual = Object.keys(record(value, label)).sort();
  if (JSON.stringify(actual) !== JSON.stringify([...keys].sort())) {
    fail(`${label} keys mismatch`);
  }
}

function expect(actual, expected, label) {
  if (actual !== expected) fail(`${label} mismatch`);
}

export function canonicalRuntimeJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function shortGraphDigest(value) {
  return createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 12);
}

function tupleName(task) {
  return `${task.platform}-${task.arch}-node-${task.nodeVersion}`;
}

function expectedTaskFromTuple(tuple) {
  if (!SAFE_TUPLE.test(tuple)) fail('runtime tuple is outside the authority matrix');
  const task = runtimeTasks().find((candidate) => tupleName(candidate) === tuple);
  if (!task) fail('runtime tuple is outside the authority matrix');
  return task;
}

export function assertNoRuntimeSecrets(contents, label = 'runtime evidence') {
  if (typeof contents !== 'string' || contents.includes('\u0000')) {
    fail(`${label} must be plain text`);
  }
  for (const pattern of SECRET_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(contents)) fail(`${label} contains forbidden secret material`);
  }
}

async function evidenceFiles(input) {
  const root = path.resolve(input);
  const rootInfo = await lstat(root);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) {
    fail('evidence input must be a real directory');
  }
  const entries = await readdir(root, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile() || entry.isSymbolicLink()) {
      fail('evidence directories may contain regular files only');
    }
    const file = path.join(root, entry.name);
    const info = await stat(file);
    if (info.size < 2 || info.size > MAX_EVIDENCE_FILE) {
      fail('evidence file size is outside the bounded policy');
    }
    files.push(file);
  }
  return files;
}

export async function scanRuntimeEvidence(inputs) {
  if (!Array.isArray(inputs) || inputs.length === 0) fail('at least one scan path is required');
  let count = 0;
  for (const input of inputs) {
    const absolute = path.resolve(input);
    const info = await lstat(absolute);
    const files = info.isDirectory() && !info.isSymbolicLink()
      ? await evidenceFiles(absolute)
      : [absolute];
    for (const file of files) {
      const fileInfo = await lstat(file);
      if (!fileInfo.isFile() || fileInfo.isSymbolicLink() ||
          fileInfo.size < 2 || fileInfo.size > MAX_EVIDENCE_FILE) {
        fail('scan input must be a bounded regular file');
      }
      assertNoRuntimeSecrets(await readFile(file, 'utf8'), 'runtime evidence');
      count += 1;
    }
  }
  return count;
}

async function writeNewJson(file, value) {
  const bytes = Buffer.from(canonicalRuntimeJson(value), 'utf8');
  assertNoRuntimeSecrets(bytes.toString('utf8'));
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const handle = await open(file, 'wx', 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  return bytes;
}

async function readCanonicalJson(file, label) {
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size < 2 ||
      info.size > MAX_EVIDENCE_FILE) fail(`${label} must be a bounded regular file`);
  const bytes = await readFile(file);
  assertNoRuntimeSecrets(bytes.toString('utf8'), label);
  let value;
  try {
    value = JSON.parse(bytes);
  } catch {
    fail(`${label} must be JSON`);
  }
  if (!bytes.equals(Buffer.from(canonicalRuntimeJson(value), 'utf8'))) {
    fail(`${label} must use canonical JSON bytes`);
  }
  return { value, bytes };
}

async function readBundledWorkflow(input) {
  if (!path.isAbsolute(input) || path.resolve(input) !== path.resolve(bundledWorkflowPath)) {
    fail('--workflow must name the bundled alpha.2 runtime workflow exactly');
  }
  const info = await lstat(input);
  if (!info.isFile() || info.isSymbolicLink() ||
      await realpath(input) !== path.resolve(bundledWorkflowPath)) {
    fail('bundled alpha.2 runtime workflow must be a real regular file');
  }
  return readFile(input);
}

function minimalRuntimeEnvironment(tempRoot) {
  const inherited = {};
  for (const name of [
    'PATH', 'Path', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'WINDIR', 'ComSpec',
    'LANG', 'LANGUAGE', 'TZ',
  ]) {
    if (typeof process.env[name] === 'string') inherited[name] = process.env[name];
  }
  for (const [name, value] of Object.entries(process.env)) {
    if (/^LC_[A-Z0-9_]+$/u.test(name) && typeof value === 'string') inherited[name] = value;
  }
  const home = path.join(tempRoot, 'home');
  const temporary = path.join(tempRoot, 'tmp');
  const config = path.join(tempRoot, 'config');
  const data = path.join(tempRoot, 'data');
  const dshHome = path.join(tempRoot, 'dsh-home');
  return Object.freeze({
    ...inherited,
    APPDATA: config,
    CI: '1',
    DSH_AGENTS_HOME: path.join(tempRoot, 'agents'),
    DSH_HOME: dshHome,
    DSH_PERMISSION_MODE: 'read-only',
    DSH_TELEMETRY_DISABLED: '1',
    FORCE_COLOR: '0',
    GIT_CONFIG_GLOBAL: path.join(tempRoot, 'empty.gitconfig'),
    HOME: home,
    LOCALAPPDATA: data,
    NODE_NO_WARNINGS: '1',
    NPM_CONFIG_USERCONFIG: path.join(tempRoot, 'empty.npmrc'),
    TEMP: temporary,
    TMP: temporary,
    TMPDIR: temporary,
    USERPROFILE: home,
    XDG_CACHE_HOME: path.join(tempRoot, 'cache'),
    XDG_CONFIG_HOME: config,
    XDG_DATA_HOME: data,
  });
}

async function prepareRuntimeRoot(tempRoot) {
  const env = minimalRuntimeEnvironment(tempRoot);
  for (const directory of [
    env.HOME, env.TEMP, env.APPDATA, env.LOCALAPPDATA, env.DSH_HOME,
    env.DSH_AGENTS_HOME, env.XDG_CACHE_HOME,
  ]) await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(env.GIT_CONFIG_GLOBAL, '', { flag: 'wx', mode: 0o600 });
  await writeFile(env.NPM_CONFIG_USERCONFIG, '', { flag: 'wx', mode: 0o600 });
  return env;
}

async function captureCli(cli, args, { cwd, env, limit = MAX_CAPTURE, timeout = 60_000 }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], {
      cwd,
      env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stdout = [];
    const stderr = [];
    let length = 0;
    let failed = false;
    const append = (target, chunk) => {
      if (failed) return;
      const bytes = Buffer.from(chunk);
      length += bytes.length;
      if (length > limit) {
        failed = true;
        child.kill('SIGKILL');
        reject(new Error('runtime command output exceeded its private in-memory bound'));
        return;
      }
      target.push(bytes);
    };
    child.stdout.on('data', (chunk) => append(stdout, chunk));
    child.stderr.on('data', (chunk) => append(stderr, chunk));
    child.once('error', () => reject(new Error('runtime command failed to start')));
    const timer = setTimeout(() => {
      failed = true;
      child.kill('SIGKILL');
      reject(new Error('runtime command timed out'));
    }, timeout);
    timer.unref();
    child.once('exit', (code) => {
      clearTimeout(timer);
      if (failed) return;
      if (code !== 0) reject(new Error('runtime command failed; private output withheld'));
      else resolve({
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
      });
    });
  });
}

async function freePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') fail('loopback port allocation failed');
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function startWeb(cli, cwd, env, port) {
  const child = spawn(process.execPath, [cli, 'web', '--no-open', '--port', String(port)], {
    cwd,
    env,
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let privateCapture = '';
  const discard = () => {};
  const launchUrl = await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.stdout.off('data', append);
      child.stderr.off('data', append);
      child.stdout.on('data', discard);
      child.stderr.on('data', discard);
      callback(value);
    };
    const append = (chunk) => {
      privateCapture = `${privateCapture}${String(chunk)}`.slice(-262_144);
      const match = /dsh web:\s+(http:\/\/[^\s]+)/u.exec(privateCapture);
      if (match?.[1]) finish(resolve, match[1]);
    };
    const failStart = (error) => {
      if (child.exitCode === null) child.kill('SIGKILL');
      finish(reject, error);
    };
    const timer = setTimeout(() => failStart(
      new Error('Web readiness timed out; private startup output withheld')
    ), 90_000);
    timer.unref();
    child.stdout.on('data', append);
    child.stderr.on('data', append);
    child.once('error', () => failStart(new Error('Web process failed to start')));
    child.once('exit', () => finish(
      reject,
      new Error('Web process exited before readiness; private startup output withheld')
    ));
  });
  privateCapture = '';
  return { child, launchUrl };
}

async function stopWeb(running) {
  if (!running || running.child.exitCode !== null) return;
  const exited = new Promise((resolve) => running.child.once('exit', resolve));
  running.child.kill('SIGTERM');
  const force = setTimeout(() => running.child.kill('SIGKILL'), 10_000);
  force.unref();
  await exited;
  clearTimeout(force);
}

function rawHttp(port, requestPath, options = {}) {
  if (typeof requestPath !== 'string' || !requestPath.startsWith('/') || /[\r\n]/u.test(requestPath)) {
    fail('Web probe requested an unsafe path');
  }
  const body = options.body ?? Buffer.alloc(0);
  const headers = {
    host: options.host ?? `127.0.0.1:${port}`,
    ...(options.headers ?? {}),
  };
  if (body.length > 0) headers['content-length'] = String(body.length);
  return new Promise((resolve, reject) => {
    const rejectPrivate = () => reject(new Error('Web request failed; private request details withheld'));
    const request = httpRequest({
      hostname: '127.0.0.1',
      port,
      path: requestPath,
      method: options.method ?? 'GET',
      headers,
    }, (response) => {
      const chunks = [];
      let size = 0;
      response.on('data', (chunk) => {
        size += chunk.length;
        if (size > MAX_HTTP_BODY) {
          response.destroy(new Error('Web response exceeded its private in-memory bound'));
          return;
        }
        chunks.push(Buffer.from(chunk));
      });
      response.once('error', rejectPrivate);
      response.on('end', () => resolve({
        status: response.statusCode ?? 0,
        headers: response.headers,
        body: Buffer.concat(chunks),
      }));
    });
    request.setTimeout(15_000, () => request.destroy());
    request.once('error', rejectPrivate);
    request.end(body);
  });
}

function headerValue(headers, name) {
  const value = headers[name.toLowerCase()];
  return Array.isArray(value) ? value.join(', ') : value;
}

function singleSessionCookie(headers) {
  const raw = headers['set-cookie'];
  const values = Array.isArray(raw) ? raw : typeof raw === 'string' ? [raw] : [];
  if (values.length !== 1 || !values[0].includes('HttpOnly') ||
      !values[0].includes('SameSite=Strict')) fail('Browser session attributes mismatch');
  const cookie = values[0].split(';', 1)[0];
  if (!cookie.includes('=')) fail('Browser session header is malformed');
  return cookie;
}

function responseBody(response, encoding, label) {
  const actual = headerValue(response.headers, 'content-encoding');
  if (encoding === 'identity') {
    if (actual !== undefined && actual !== 'identity') fail(`${label} identity encoding mismatch`);
    return response.body;
  }
  if (actual === undefined || actual === 'identity') return response.body;
  if (actual !== 'gzip') fail(`${label} gzip encoding mismatch`);
  try {
    return gunzipSync(response.body);
  } catch {
    fail(`${label} gzip body is invalid`);
  }
}

function parseBootGraph(html) {
  const prefix = 'globalThis["__DSH_BOOT__"] = ';
  const start = html.indexOf(prefix);
  if (start < 0) fail('served HTML omitted the boot graph');
  const end = html.indexOf('</script>', start + prefix.length);
  if (end < 0) fail('served HTML has an unterminated boot graph');
  try {
    return record(JSON.parse(html.slice(start + prefix.length, end)), 'boot graph');
  } catch {
    fail('served HTML boot graph is invalid');
  }
}

export function validateRuntimeBootGraph(graph) {
  exactKeys(graph, ['rev', 'entries', 'batches'], 'boot graph');
  if (!SHA12.test(graph.rev) ||
      !Array.isArray(graph.entries) || graph.entries.length === 0 ||
      !Array.isArray(graph.batches) || graph.batches.length === 0) {
    fail('boot graph shape mismatch');
  }
  const ids = new Set();
  const entryRevisions = new Set();
  let initialRevisionNonce;
  for (const entry of graph.entries) {
    const value = record(entry, 'boot entry');
    const allowed = new Set(['id', 'url', 'rev', 'inject', 'immediately', 'external']);
    const initialRevision = typeof value.rev === 'string'
      ? INITIAL_ENTRY_REV.exec(value.rev)
      : null;
    if (Object.keys(value).some((key) => !allowed.has(key)) ||
        typeof value.id !== 'string' || value.id.length === 0 || initialRevision === null ||
        value.url !== `/plugins/??${value.id}/client.js&rev=${value.rev}` || ids.has(value.id) ||
        entryRevisions.has(value.rev) ||
        (value.inject !== undefined && (!Array.isArray(value.inject) ||
          value.inject.some((item) => typeof item !== 'string'))) ||
        (value.external !== undefined && (!Array.isArray(value.external) ||
          value.external.some((item) => typeof item !== 'string'))) ||
        (value.immediately !== undefined && typeof value.immediately !== 'boolean')) {
      fail('boot entry mismatch');
    }
    initialRevisionNonce ??= initialRevision[1];
    if (initialRevision[1] !== initialRevisionNonce) fail('boot entry revision nonce mismatch');
    ids.add(value.id);
    entryRevisions.add(value.rev);
  }
  const assignments = new Map([...ids].map((id) => [id, 0]));
  const phases = new Set();
  const batchUrls = new Set();
  for (const rawBatch of graph.batches) {
    const batch = record(rawBatch, 'boot batch');
    exactKeys(batch, ['phase', 'url', 'rev', 'entries'], 'boot batch');
    if (!['bootstrap', 'application'].includes(batch.phase)) fail('boot batch phase mismatch');
    phases.add(batch.phase);
    if (!SHA12.test(batch.rev) || !Array.isArray(batch.entries) ||
        batch.entries.length === 0) fail('boot batch combo URL mismatch');
    for (const id of batch.entries) {
      if (typeof id !== 'string' || !assignments.has(id)) fail('boot batch entry mismatch');
      assignments.set(id, assignments.get(id) + 1);
    }
    const expectedUrl = `/plugins/??${batch.entries.map((id) => `${id}/client.js`).join(',')}&rev=${batch.rev}`;
    if (batch.url !== expectedUrl || Buffer.byteLength(batch.url) > 3072 ||
        batchUrls.has(batch.url)) fail('boot batch combo URL mismatch');
    batchUrls.add(batch.url);
  }
  if ([...assignments.values()].some((count) => count !== 1) ||
      !phases.has('bootstrap') || !phases.has('application')) {
    fail('boot graph assignment or phase mismatch');
  }
  if (graph.rev !== shortGraphDigest({ entries: graph.entries, batches: graph.batches })) {
    fail('boot graph revision mismatch');
  }
  return graph;
}

export function staleRuntimeComboUrl(batch) {
  const suffix = `&rev=${batch.rev}`;
  if (!SHA12.test(batch.rev) || typeof batch.url !== 'string' ||
      !batch.url.endsWith(suffix)) fail('stale combo revision input mismatch');
  const staleRev = batch.rev === '0'.repeat(12) ? 'f'.repeat(12) : '0'.repeat(12);
  return `${batch.url.slice(0, -suffix.length)}&rev=${staleRev}`;
}

function apiBody() {
  return Buffer.from(JSON.stringify({
    type: 'client-request',
    rpcId: 'alpha2-runtime-certification',
    method: 'settings/describe',
    payload: { args: {} },
  }), 'utf8');
}

function validateSettingsDescribeResponse(response) {
  expect(response.status, 200, 'authenticated settings API status');
  let value;
  try {
    value = JSON.parse(response.body.toString('utf8'));
  } catch {
    fail('authenticated settings API response is not JSON');
  }
  if (value?.type !== 'server-response' ||
      value?.rpcId !== 'alpha2-runtime-certification' ||
      value?.result?.ok !== true ||
      !Array.isArray(value?.result?.value?.namespaces)) {
    fail('authenticated settings API response shape mismatch');
  }
}

async function exchangeLaunch(port, launchText, expectedOrigin) {
  let launch;
  try {
    launch = new URL(launchText);
  } catch {
    fail('Web launch origin or credential shape mismatch');
  }
  const credential = launch.searchParams.get('token');
  if (launch.origin !== expectedOrigin || launch.pathname !== '/' ||
      launch.searchParams.size !== 1 || !TOKEN_SHAPE.test(credential ?? '')) {
    fail('Web launch origin or credential shape mismatch');
  }
  const exchangePath = `${launch.pathname}${launch.search}`;
  const host = launch.host;
  launch.search = '';
  const exchange = await rawHttp(port, exchangePath, { host });
  expect(exchange.status, 303, 'launch exchange status');
  expect(headerValue(exchange.headers, 'location'), '/', 'launch exchange redirect');
  return {
    host,
    cookie: singleSessionCookie(exchange.headers),
    credential,
    exchangeStatus: exchange.status,
  };
}

async function assertCliBytes(cli, expectedSha256) {
  const info = await lstat(cli);
  if (!info.isFile() || info.isSymbolicLink() || digest(await readFile(cli)) !== expectedSha256) {
    fail('source-built CLI bytes changed across a probe lifecycle');
  }
}

async function probeFirstWeb(cli, cwd, env, port, expectedCliSha256) {
  let running;
  try {
    await assertCliBytes(cli, expectedCliSha256);
    running = await startWeb(cli, cwd, env, port);
    const origin = `http://127.0.0.1:${port}`;
    const unauthenticated = await rawHttp(port, '/');
    expect(unauthenticated.status, 401, 'unauthenticated root status');
    const session = await exchangeLaunch(port, running.launchUrl, origin);
    running.launchUrl = undefined;
    const authenticated = await rawHttp(port, '/', {
      host: session.host,
      headers: { cookie: session.cookie, 'accept-encoding': 'identity' },
    });
    expect(authenticated.status, 200, 'authenticated root status');
    const apiHeaders = {
      'content-type': 'application/json',
      origin,
      'sec-fetch-site': 'same-origin',
    };
    validateSettingsDescribeResponse(await rawHttp(port, '/api/settings/describe', {
      method: 'POST',
      host: session.host,
      headers: { ...apiHeaders, cookie: session.cookie },
      body: apiBody(),
    }));
    const hostOnly = await rawHttp(port, '/api/settings/describe', {
      method: 'POST',
      host: 'attacker.invalid',
      headers: { ...apiHeaders, cookie: session.cookie },
      body: apiBody(),
    });
    expect(hostOnly.status, 403, 'Host-only rejection status');
    const originOnly = await rawHttp(port, '/api/settings/describe', {
      method: 'POST',
      host: session.host,
      headers: { ...apiHeaders, cookie: session.cookie, origin: 'http://attacker.invalid' },
      body: apiBody(),
    });
    expect(originOnly.status, 403, 'Origin-only rejection status');
    const crossSite = await rawHttp(port, '/api/settings/describe', {
      method: 'POST',
      host: session.host,
      headers: {
        ...apiHeaders,
        cookie: session.cookie,
        origin,
        'sec-fetch-site': 'cross-site',
      },
      body: apiBody(),
    });
    expect(crossSite.status, 403, 'cross-site Fetch Metadata rejection status');
    const html = responseBody(authenticated, 'identity', 'authenticated root').toString('utf8');
    if (!html.includes('__DSH_BOOT_READY__')) fail('served HTML omitted boot readiness');
    const graph = validateRuntimeBootGraph(parseBootGraph(html));
    let javascriptMime;
    let gzipSeen = false;
    for (const [index, batch] of graph.batches.entries()) {
      const identity = await rawHttp(port, batch.url, {
        host: session.host,
        headers: { 'accept-encoding': 'identity' },
      });
      expect(identity.status, 200, `batch ${index} identity status`);
      const mime = (headerValue(identity.headers, 'content-type') ?? '').split(';', 1)[0].toLowerCase();
      if (!['text/javascript', 'application/javascript'].includes(mime)) {
        fail(`batch ${index} JavaScript MIME mismatch`);
      }
      javascriptMime ??= mime;
      expect(
        headerValue(identity.headers, 'cache-control'),
        'public, max-age=31536000, immutable',
        `batch ${index} cache policy`
      );
      const identityBytes = responseBody(identity, 'identity', `batch ${index}`);
      const gzip = await rawHttp(port, batch.url, {
        host: session.host,
        headers: { 'accept-encoding': 'gzip' },
      });
      expect(gzip.status, 200, `batch ${index} gzip status`);
      if (!responseBody(gzip, 'gzip', `batch ${index}`).equals(identityBytes)) {
        fail(`batch ${index} compression bytes mismatch`);
      }
      if (headerValue(gzip.headers, 'content-encoding') === 'gzip') gzipSeen = true;
      const mapUrl = `/plugins/??${batch.entries.map((id) => `${id}/client.js.map`).join(',')}&rev=${batch.rev}`;
      if (Buffer.byteLength(mapUrl) > 3072) fail('source-map combo URL mismatch');
      const sourceMap = await rawHttp(port, mapUrl, {
        host: session.host,
        headers: { 'accept-encoding': 'identity' },
      });
      expect(sourceMap.status, 200, `batch ${index} source-map status`);
      const mapMime = (headerValue(sourceMap.headers, 'content-type') ?? '').split(';', 1)[0].toLowerCase();
      expect(mapMime, 'application/json', `batch ${index} source-map MIME`);
      expect(
        headerValue(sourceMap.headers, 'cache-control'),
        'public, max-age=31536000, immutable',
        `batch ${index} source-map cache policy`
      );
      try {
        JSON.parse(responseBody(sourceMap, 'identity', `batch ${index} source map`).toString('utf8'));
      } catch {
        fail(`batch ${index} source-map JSON mismatch`);
      }
    }
    if (!gzipSeen || javascriptMime === undefined) fail('Web module compression proof is incomplete');
    const staleResult = await rawHttp(port, staleRuntimeComboUrl(graph.batches[0]), {
      host: session.host,
      headers: { 'accept-encoding': 'identity' },
    });
    expect(staleResult.status, 404, 'stale revision status');
    return {
      oldCookie: session.cookie,
      oldLaunchCredential: session.credential,
      host: session.host,
      evidence: {
        unauthenticatedRootStatus: unauthenticated.status,
        launchExchangeStatus: session.exchangeStatus,
        authenticatedSessionStatus: authenticated.status,
        hostOnlyRejectionStatus: hostOnly.status,
        originOnlyRejectionStatus: originOnly.status,
        crossSiteRejectionStatus: crossSite.status,
        javascriptMime,
      },
    };
  } finally {
    try {
      await stopWeb(running);
    } finally {
      await assertCliBytes(cli, expectedCliSha256);
    }
  }
}

async function probeRestart(cli, cwd, env, port, prior, expectedCliSha256) {
  let running;
  let current;
  try {
    await assertCliBytes(cli, expectedCliSha256);
    running = await startWeb(cli, cwd, env, port);
    const unauthenticated = await rawHttp(port, '/');
    expect(unauthenticated.status, 401, 'unauthenticated root after cold restart');
    const priorSession = await rawHttp(port, '/', {
      host: prior.host,
      headers: { cookie: prior.oldCookie, 'accept-encoding': 'identity' },
    });
    expect(priorSession.status, 200, 'prior session after cold restart');
    current = await exchangeLaunch(
      port,
      running.launchUrl,
      `http://127.0.0.1:${port}`
    );
    running.launchUrl = undefined;
    const previousBytes = Buffer.from(prior.oldLaunchCredential, 'utf8');
    const currentBytes = Buffer.from(current.credential, 'utf8');
    const rotated = previousBytes.byteLength === currentBytes.byteLength &&
      !timingSafeEqual(previousBytes, currentBytes);
    previousBytes.fill(0);
    currentBytes.fill(0);
    if (!rotated) fail('launch credential did not rotate after cold restart');
    const authenticated = await rawHttp(port, '/', {
      host: current.host,
      headers: { cookie: current.cookie, 'accept-encoding': 'identity' },
    });
    expect(authenticated.status, 200, 'new session after cold restart');
    return 'prior-session-persisted-launch-credential-rotated';
  } finally {
    prior.oldCookie = undefined;
    prior.oldLaunchCredential = undefined;
    if (current) {
      current.cookie = undefined;
      current.credential = undefined;
    }
    try {
      await stopWeb(running);
    } finally {
      await assertCliBytes(cli, expectedCliSha256);
    }
  }
}

function validateDumpConfig(output) {
  if (typeof output !== 'string' || output.length === 0 || output.length > MAX_CAPTURE) {
    fail('Profile dump-config output is missing or oversized');
  }
  const document = parseDocument(output, {
    merge: false,
    maxAliasCount: 0,
    prettyErrors: false,
    uniqueKeys: true,
  });
  if (document.errors.length > 0) fail('Profile dump-config output is not strict YAML');
  let value;
  try {
    value = document.toJS({ maxAliasCount: 0 });
  } catch {
    fail('Profile dump-config output contains unsupported aliases or tags');
  }
  if (!Array.isArray(value) || value.length === 0) {
    fail('Profile dump-config output is not a composed Cordis entry list');
  }
  if (!value.some((entry) => entry !== null && typeof entry === 'object' &&
      !Array.isArray(entry) && typeof entry.id === 'string' && entry.id.length > 0 &&
      typeof entry.name === 'string' && entry.name.length > 0)) {
    fail('Profile dump-config output contains no named Cordis entry');
  }
  return true;
}

export function validateRuntimeGithubIdentity(environment, task) {
  const required = [
    'GITHUB_ACTIONS', 'GITHUB_REPOSITORY', 'GITHUB_WORKFLOW', 'GITHUB_WORKFLOW_REF',
    'GITHUB_RUN_ID', 'GITHUB_RUN_ATTEMPT', 'GITHUB_SHA', 'GITHUB_JOB',
  ];
  if (required.some((name) => typeof environment[name] !== 'string' || environment[name].length === 0)) {
    fail('runtime receipts may be created only by the bound GitHub Actions workflow');
  }
  if (environment.GITHUB_ACTIONS !== 'true' || environment.GITHUB_REPOSITORY !== RUNTIME_REPOSITORY ||
      environment.GITHUB_WORKFLOW !== 'DSH alpha.2 runtime certification' ||
      environment.GITHUB_JOB !== 'runtime' || !/^[1-9]\d{0,19}$/u.test(environment.GITHUB_RUN_ID) ||
      !/^[1-9]\d{0,2}$/u.test(environment.GITHUB_RUN_ATTEMPT) || !SHA40.test(environment.GITHUB_SHA)) {
    fail('GitHub Actions runtime identity mismatch');
  }
  const expectedRef = `${RUNTIME_REPOSITORY}/${RUNTIME_WORKFLOW}@refs/heads/main`;
  if (environment.GITHUB_WORKFLOW_REF !== expectedRef) {
    fail('GitHub workflow reference mismatch');
  }
  return {
    repository: RUNTIME_REPOSITORY,
    workflowPath: RUNTIME_WORKFLOW,
    runId: environment.GITHUB_RUN_ID,
    runAttempt: Number(environment.GITHUB_RUN_ATTEMPT),
    jobId: `runtime-${tupleName(task)}`,
    headSha: environment.GITHUB_SHA,
  };
}

export function buildRuntimeReceipt({
  authority,
  task,
  buildReceipt,
  buildReceiptBytes,
  installReceipt,
  installReceiptBytes,
  ci,
  probes,
}) {
  const receipt = {
    schemaVersion: 1,
    status: 'alpha2-runtime-task-passed',
    scope: 'one-platform-node-task',
    source: {
      tag: authority.release.tag,
      commit: authority.release.commit,
      tree: authority.release.tree,
      lockfileSha256: authority.source.lockfileSha256,
    },
    task,
    artifacts: {
      officialNpm: {
        installReceiptSha256: digest(installReceiptBytes),
        installedCliSha256: installReceipt.result.installedCliSha256,
        tarballSha256: installReceipt.package.tarballSha256,
        resolutionLockfileSha256: installReceipt.resolution.lockfileSha256,
      },
      sourceCrossBuild: {
        buildReceiptSha256: digest(buildReceiptBytes),
        builtCliSha256: buildReceipt.result.builtCliSha256,
        reportedVersion: buildReceipt.result.reportedVersion,
      },
    },
    provenanceBoundary: {
      officialNpmOperationalRuntime: true,
      exactSourceCrossBuild: true,
      npmGitHeadPresent: authority.officialNpm.gitHeadPresent,
      npmProvenanceAttestationPresent: authority.officialNpm.provenanceAttestationPresent,
      binarySourceEquivalenceClaimed: false,
      artifactRelationship: 'independent-artifacts-no-source-package-binding',
    },
    probes: {
      cli: { reportedVersion: authority.release.version },
      profile: { name: 'web', dumpConfigPassed: probes.dumpConfigPassed },
      browserAuth: {
        unauthenticatedRootStatus: probes.unauthenticatedRootStatus,
        launchExchangeStatus: probes.launchExchangeStatus,
        authenticatedSessionStatus: probes.authenticatedSessionStatus,
        hostOnlyRejectionStatus: probes.hostOnlyRejectionStatus,
        originOnlyRejectionStatus: probes.originOnlyRejectionStatus,
        crossSiteRejectionStatus: probes.crossSiteRejectionStatus,
        restartStatus: probes.restartStatus,
      },
      webProtocol: {
        entriesAndBatches: true,
        comboUrl: true,
        revision404: true,
        javascriptMime: probes.javascriptMime,
        sourceMapMime: 'application/json',
        gzip: true,
        identity: true,
        cache: true,
        bootReady: true,
      },
    },
    ci,
    privacy: {
      capturesProcessOutput: false,
      capturesEnvironment: false,
      capturesBrowserSecrets: false,
      capturesSecretDerivedDigest: false,
    },
  };
  assertNoRuntimeSecrets(canonicalRuntimeJson(receipt));
  return validateRuntimeReceipt(receipt, authority);
}

async function verifiedOfficialInstall(installRootInput, installReceiptPath, authority, task) {
  const installRoot = path.resolve(installRootInput);
  const home = await realpath(os.homedir());
  const rootInfo = await lstat(installRoot);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink() ||
      await realpath(installRoot) !== installRoot ||
      path.basename(installRoot) !== 'dsh-v0.1.2-alpha.2-npm') {
    fail('official runtime install root is not the exact versioned real directory');
  }
  const relationToHome = path.relative(home, installRoot);
  if (relationToHome === '' || relationToHome.startsWith('..') || path.isAbsolute(relationToHome)) {
    fail('official runtime install root must remain below the current user home');
  }
  const loaded = await readCanonicalJson(path.resolve(installReceiptPath), 'private install receipt');
  const installReceipt = validateInstallReceipt(loaded.value, authority);
  if (installReceipt.toolchain.platform !== task.platform ||
      installReceipt.toolchain.arch !== task.arch ||
      installReceipt.toolchain.nodeVersion !== task.nodeVersion) {
    fail('install receipt tuple mismatch');
  }
  const lockfile = await readFile(path.join(installRoot, 'pnpm-lock.yaml'));
  if (digest(lockfile) !== authority.runtimeInstall.lockfileSha256) {
    fail('official runtime lockfile changed after installation');
  }
  const linkedCli = path.join(installRoot, authority.runtimeInstall.installedCliPath);
  const cli = await realpath(linkedCli);
  const relationToInstall = path.relative(installRoot, cli);
  const cliInfo = await lstat(cli);
  if (relationToInstall.startsWith('..') || path.isAbsolute(relationToInstall) ||
      !cliInfo.isFile() || cliInfo.isSymbolicLink() ||
      digest(await readFile(cli)) !== authority.officialNpm.cliSha256) {
    fail('official runtime CLI differs from the installed receipt authority');
  }
  return { cli, installReceipt, installReceiptBytes: loaded.bytes };
}

export async function runRuntimeTask({
  source,
  buildReceiptPath,
  installRoot,
  installReceiptPath,
  output,
  tuple,
  workflowPath,
}) {
  if (![source, buildReceiptPath, installRoot, installReceiptPath, output, workflowPath]
    .every(path.isAbsolute)) {
    fail('runtime task paths must be absolute');
  }
  const authority = await loadAuthority();
  const task = expectedTaskFromTuple(tuple);
  if (process.platform !== task.platform || process.arch !== task.arch ||
      process.versions.node !== task.nodeVersion) fail('runner does not match the requested authority tuple');
  const verified = await verifySourceCheckout(path.resolve(source), authority);
  const buildInfo = await lstat(path.resolve(buildReceiptPath));
  if (!buildInfo.isFile() || buildInfo.isSymbolicLink() || buildInfo.size > MAX_EVIDENCE_FILE) {
    fail('private build receipt must be a bounded regular file');
  }
  const buildReceiptBytes = await readFile(path.resolve(buildReceiptPath));
  const buildReceipt = validateBuildReceipt(JSON.parse(buildReceiptBytes), authority);
  if (buildReceipt.toolchain.platform !== task.platform || buildReceipt.toolchain.arch !== task.arch ||
      buildReceipt.toolchain.nodeVersion !== task.nodeVersion) fail('build receipt tuple mismatch');
  const cli = path.join(verified.source, authority.source.builtCliPath);
  const cliInfo = await lstat(cli);
  if (!cliInfo.isFile() || cliInfo.isSymbolicLink() ||
      digest(await readFile(cli)) !== buildReceipt.result.builtCliSha256) {
    fail('source-built CLI bytes do not match the private build receipt');
  }
  const official = await verifiedOfficialInstall(
    installRoot,
    installReceiptPath,
    authority,
    task
  );
  const workflowBytes = await readBundledWorkflow(workflowPath);
  const workflowSha256 = digest(workflowBytes);
  const ci = { ...validateRuntimeGithubIdentity(process.env, task), workflowSha256 };
  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'dsh-alpha2-runtime-'));
  let first;
  try {
    const env = await prepareRuntimeRoot(tempRoot);
    await assertCliBytes(cli, buildReceipt.result.builtCliSha256);
    const sourceVersionResult = await captureCli(cli, ['--version'], { cwd: tempRoot, env });
    await assertCliBytes(cli, buildReceipt.result.builtCliSha256);
    if (sourceVersionResult.stderr.trim() !== '') fail('source-built CLI version probe wrote to stderr');
    const escaped = authority.release.version.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    if (!new RegExp(`(?:^|[^0-9])${escaped}(?:$|[^0-9])`, 'u').test(sourceVersionResult.stdout)) {
      fail('source-built CLI version probe mismatch');
    }
    await assertCliBytes(official.cli, authority.officialNpm.cliSha256);
    const versionResult = await captureCli(official.cli, ['--version'], { cwd: tempRoot, env });
    await assertCliBytes(official.cli, authority.officialNpm.cliSha256);
    if (versionResult.stderr.trim() !== '') fail('official npm CLI version probe wrote to stderr');
    if (!new RegExp(`(?:^|[^0-9])${escaped}(?:$|[^0-9])`, 'u').test(versionResult.stdout)) {
      fail('official npm CLI version probe mismatch');
    }
    await assertCliBytes(official.cli, authority.officialNpm.cliSha256);
    const dumpResult = await captureCli(official.cli, ['--profile', 'web', '--dump-config'], {
      cwd: tempRoot,
      env,
    });
    await assertCliBytes(official.cli, authority.officialNpm.cliSha256);
    if (dumpResult.stderr.trim() !== '') fail('Profile dump-config probe wrote to stderr');
    const dumpConfigPassed = validateDumpConfig(dumpResult.stdout);
    const port = await freePort();
    first = await probeFirstWeb(
      official.cli,
      tempRoot,
      env,
      port,
      authority.officialNpm.cliSha256
    );
    const restartStatus = await probeRestart(
      official.cli,
      tempRoot,
      env,
      port,
      first,
      authority.officialNpm.cliSha256
    );
    const receipt = buildRuntimeReceipt({
      authority,
      task,
      buildReceipt,
      buildReceiptBytes,
      installReceipt: official.installReceipt,
      installReceiptBytes: official.installReceiptBytes,
      ci,
      probes: { ...first.evidence, dumpConfigPassed, restartStatus },
    });
    await writeNewJson(path.resolve(output), receipt);
    return receipt;
  } finally {
    if (first) {
      first.oldCookie = undefined;
      first.oldLaunchCredential = undefined;
      first.host = undefined;
    }
    await rm(tempRoot, { recursive: true, force: true });
  }
}

function expectedReceiptFiles() {
  return runtimeTasks().map((task) => `${tupleName(task)}.json`);
}

function runtimeEvidencePredicate(receiptSet, receipts) {
  return {
    schemaVersion: 1,
    predicateType: 'https://dsh-themes.com/attestations/alpha2-runtime-evidence/v1',
    authorityEffect: 'none',
    receiptSet,
    receipts,
  };
}

function candidateManifest(
  receiptSet,
  receiptSetBytes,
  receiptBytesBySha256,
  evidencePredicateBytes
) {
  return {
    schemaVersion: 1,
    status: 'alpha2-runtime-candidate-awaiting-explicit-promotion',
    authorityEffect: 'none',
    sourceCommit: receiptSet.source.commit,
    workflow: receiptSet.workflow,
    provenanceSetSha256: receiptSet.provenanceSetSha256,
    receiptSetSha256: digest(receiptSetBytes),
    durableEvidencePredicateSha256: digest(evidencePredicateBytes),
    receiptFiles: receiptSet.receipts.map((entry) => ({
      file: `${tupleName(entry)}.json`,
      sha256: entry.receiptSha256,
      bytes: receiptBytesBySha256.get(entry.receiptSha256).length,
    })),
  };
}

async function loadReceiptDirectory(directory, authority) {
  const files = await evidenceFiles(directory);
  const expected = expectedReceiptFiles();
  if (JSON.stringify(files.map((file) => path.basename(file)).sort()) !==
      JSON.stringify([...expected].sort())) fail('receipt input must contain exactly six canonical tuple files');
  const receiptBytesBySha256 = new Map();
  const receipts = new Map();
  for (const fileName of expected) {
    const { value, bytes } = await readCanonicalJson(path.join(directory, fileName), fileName);
    const receipt = validateRuntimeReceipt(value, authority);
    if (`${tupleName(receipt.task)}.json` !== fileName) fail('receipt filename and task mismatch');
    const receiptSha256 = digest(bytes);
    if (receiptBytesBySha256.has(receiptSha256)) fail('receipt digests must be unique');
    receiptBytesBySha256.set(receiptSha256, bytes);
    receipts.set(fileName, receipt);
  }
  return { expected, receiptBytesBySha256, receipts };
}

export async function aggregateRuntimeCandidate({ input, output, workflowPath }) {
  if (![input, output, workflowPath].every(path.isAbsolute)) {
    fail('runtime aggregate paths must be absolute');
  }
  const authority = await loadAuthority();
  if (authority.publication.publishedInstallable !== false) {
    fail('candidate aggregation requires the bundled 0/6 pending authority');
  }
  const loaded = await loadReceiptDirectory(path.resolve(input), authority);
  const orderedReceipts = runtimeTasks().map((task) => loaded.receipts.get(`${tupleName(task)}.json`));
  const first = orderedReceipts[0];
  const workflowBytes = await readBundledWorkflow(workflowPath);
  const workflowSha256 = digest(workflowBytes);
  if (orderedReceipts.some((receipt) =>
    receipt.ci.workflowSha256 !== workflowSha256 ||
    receipt.ci.repository !== first.ci.repository || receipt.ci.workflowPath !== first.ci.workflowPath ||
    receipt.ci.runId !== first.ci.runId || receipt.ci.runAttempt !== first.ci.runAttempt ||
    receipt.ci.headSha !== first.ci.headSha)) fail('receipt CI run or workflow binding mismatch');
  const receiptSet = {
    schemaVersion: 1,
    status: 'alpha2-runtime-matrix-verified',
    source: first.source,
    workflow: {
      repository: first.ci.repository,
      workflowPath: first.ci.workflowPath,
      workflowSha256: first.ci.workflowSha256,
      runId: first.ci.runId,
      runAttempt: first.ci.runAttempt,
      headSha: first.ci.headSha,
    },
    requiredReceiptCount: 6,
    receipts: [],
    provenanceSetSha256: '0'.repeat(64),
    receiptSetPayloadSha256: '0'.repeat(64),
  };
  receiptSet.receipts = orderedReceipts.map((receipt) => {
    const bytes = Buffer.from(canonicalRuntimeJson(receipt), 'utf8');
    return { ...receipt.task, receiptSha256: digest(bytes), jobId: receipt.ci.jobId };
  });
  receiptSet.provenanceSetSha256 = runtimeProvenanceSetSha256(receiptSet);
  receiptSet.receiptSetPayloadSha256 = runtimeReceiptSetPayloadSha256(receiptSet);
  validateRuntimeReceiptSet(receiptSet, {
    authority,
    receiptBytesBySha256: loaded.receiptBytesBySha256,
  });
  const outputRoot = path.resolve(output);
  try {
    await lstat(outputRoot);
    fail('candidate output directory must not already exist');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  await mkdir(outputRoot, { mode: 0o700 });
  try {
    for (const fileName of loaded.expected) {
      await writeNewJson(path.join(outputRoot, fileName), loaded.receipts.get(fileName));
    }
    await writeNewJson(
      path.join(outputRoot, 'runtime-provenance-set.json'),
      runtimeProvenanceSet(receiptSet)
    );
    const receiptSetBytes = await writeNewJson(
      path.join(outputRoot, 'runtime-receipt-set.json'),
      receiptSet
    );
    const evidencePredicateBytes = await writeNewJson(
      path.join(outputRoot, 'runtime-evidence-predicate.json'),
      runtimeEvidencePredicate(receiptSet, orderedReceipts)
    );
    await writeNewJson(
      path.join(outputRoot, 'candidate-manifest.json'),
      candidateManifest(
        receiptSet,
        receiptSetBytes,
        loaded.receiptBytesBySha256,
        evidencePredicateBytes
      )
    );
    await verifyRuntimeCandidate({ candidate: outputRoot, workflowPath, authority });
  } catch (error) {
    await rm(outputRoot, { recursive: true, force: true });
    throw error;
  }
  return receiptSet;
}

export async function verifyRuntimeCandidate({ candidate, workflowPath, authority: authorityInput }) {
  if (![candidate, workflowPath].every(path.isAbsolute)) {
    fail('runtime candidate paths must be absolute');
  }
  const authority = authorityInput ?? await loadAuthority();
  const root = path.resolve(candidate);
  const files = await evidenceFiles(root);
  const expected = [
    ...expectedReceiptFiles(),
    'candidate-manifest.json',
    'runtime-evidence-predicate.json',
    'runtime-provenance-set.json',
    'runtime-receipt-set.json',
  ].sort();
  if (JSON.stringify(files.map((file) => path.basename(file)).sort()) !== JSON.stringify(expected)) {
    fail('candidate bundle file set mismatch');
  }
  const receiptBytesBySha256 = new Map();
  const receiptsByFile = new Map();
  for (const fileName of expectedReceiptFiles()) {
    const loaded = await readCanonicalJson(path.join(root, fileName), fileName);
    validateRuntimeReceipt(loaded.value, authority);
    if (`${tupleName(loaded.value.task)}.json` !== fileName) fail('candidate receipt task mismatch');
    const sha = digest(loaded.bytes);
    receiptBytesBySha256.set(sha, loaded.bytes);
    receiptsByFile.set(fileName, { ...loaded, sha });
  }
  if (receiptBytesBySha256.size !== 6) fail('candidate receipt digests must be unique');
  const setLoaded = await readCanonicalJson(
    path.join(root, 'runtime-receipt-set.json'),
    'runtime receipt set'
  );
  validateRuntimeReceiptSet(setLoaded.value, { authority, receiptBytesBySha256 });
  const provenanceLoaded = await readCanonicalJson(
    path.join(root, 'runtime-provenance-set.json'),
    'runtime provenance set'
  );
  if (canonicalRuntimeJson(provenanceLoaded.value) !==
      canonicalRuntimeJson(runtimeProvenanceSet(setLoaded.value)) ||
      digest(provenanceLoaded.bytes) !== setLoaded.value.provenanceSetSha256) {
    fail('candidate provenance-set binding mismatch');
  }
  const workflowSha256 = digest(await readBundledWorkflow(workflowPath));
  if (setLoaded.value.workflow.workflowSha256 !== workflowSha256) {
    fail('candidate workflow bytes do not match the receipt set');
  }
  const evidenceLoaded = await readCanonicalJson(
    path.join(root, 'runtime-evidence-predicate.json'),
    'runtime durable evidence predicate'
  );
  const orderedReceipts = runtimeTasks().map((task) =>
    receiptsByFile.get(`${tupleName(task)}.json`).value);
  if (canonicalRuntimeJson(evidenceLoaded.value) !==
      canonicalRuntimeJson(runtimeEvidencePredicate(setLoaded.value, orderedReceipts))) {
    fail('candidate durable evidence predicate binding mismatch');
  }
  const manifestLoaded = await readCanonicalJson(
    path.join(root, 'candidate-manifest.json'),
    'candidate manifest'
  );
  const expectedManifest = candidateManifest(
    setLoaded.value,
    setLoaded.bytes,
    receiptBytesBySha256,
    evidenceLoaded.bytes
  );
  if (canonicalRuntimeJson(manifestLoaded.value) !== canonicalRuntimeJson(expectedManifest)) {
    fail('candidate manifest binding mismatch');
  }
  await scanRuntimeEvidence([root]);
  return {
    receiptSet: setLoaded.value,
    receiptSetBytes: setLoaded.bytes,
    receiptBytesBySha256,
  };
}

function parseFlags(args) {
  const flags = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    if (!key?.startsWith('--') || value === undefined || value.startsWith('--')) {
      fail('runtime certification arguments must be --name value pairs');
    }
    if (flags.has(key.slice(2))) fail(`${key} must be supplied once`);
    flags.set(key.slice(2), value);
  }
  return flags;
}

function flag(flags, name) {
  const value = flags.get(name);
  if (!value) fail(`--${name} is required`);
  return value;
}

function requireExactFlags(flags, expected) {
  const actual = [...flags.keys()].sort();
  if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
    fail('runtime certification received an unexpected or missing flag');
  }
}

async function main(argv) {
  const [command, ...args] = argv;
  const flags = parseFlags(args);
  if (command === 'run-task') {
    requireExactFlags(flags, [
      'source', 'build-receipt', 'install', 'install-receipt', 'output', 'tuple', 'workflow',
    ]);
    await runRuntimeTask({
      source: flag(flags, 'source'),
      buildReceiptPath: flag(flags, 'build-receipt'),
      installRoot: flag(flags, 'install'),
      installReceiptPath: flag(flags, 'install-receipt'),
      output: flag(flags, 'output'),
      tuple: flag(flags, 'tuple'),
      workflowPath: flag(flags, 'workflow'),
    });
    return { status: 'runtime-task-passed', authorityEffect: 'none' };
  }
  if (command === 'aggregate') {
    requireExactFlags(flags, ['input', 'output', 'workflow']);
    const receiptSet = await aggregateRuntimeCandidate({
      input: flag(flags, 'input'),
      output: flag(flags, 'output'),
      workflowPath: flag(flags, 'workflow'),
    });
    return {
      status: 'candidate-created',
      authorityEffect: 'none',
      receiptSetPayloadSha256: receiptSet.receiptSetPayloadSha256,
    };
  }
  if (command === 'verify') {
    requireExactFlags(flags, ['candidate', 'workflow']);
    const verified = await verifyRuntimeCandidate({
      candidate: flag(flags, 'candidate'),
      workflowPath: flag(flags, 'workflow'),
    });
    return {
      status: 'candidate-structure-verified-awaiting-signed-provenance',
      authorityEffect: 'none',
      receiptSetSha256: digest(verified.receiptSetBytes),
    };
  }
  if (command === 'scan') {
    requireExactFlags(flags, ['path']);
    return { status: 'privacy-scan-passed', files: await scanRuntimeEvidence([flag(flags, 'path')]) };
  }
  fail('usage: runtime-certification.mjs <run-task|aggregate|verify|scan> [flags]');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(`${JSON.stringify(await main(process.argv.slice(2)))}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
