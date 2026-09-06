/**
 * Prepared for a root-owned, isolated, already-running official Alpha host.
 * This file does not install packages, start/stop a server, or launch a browser.
 * Runtime use: node .cache/alpha-palette-api-security/check-runtime-requests.mjs
 *   --settings .cache/alpha-palette-api-security/attempt-1-settings.json
 * The caller must first confirm that its isolated official host owns port 3427.
 */
import { createHash, randomUUID } from 'node:crypto';
import { constants as fsConstants } from 'node:fs';
import { appendFile, lstat, mkdir, open, readFile, realpath, rename, writeFile } from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(import.meta.url);
const repo = path.resolve(path.dirname(scriptPath), '../..');
const work = path.join(repo, '.cache/alpha-palette-api-security');
const settingsPath = path.join(work, 'attempt-1-settings.json');
const expectedHome = path.join(os.homedir(), '.dsh-themes/testing/community-palettes-alpha-api-security-20260906');
const expectedOutput = path.join(repo, 'output/playwright/community-palettes-alpha-security/attempt-1');
const catalogPath = path.join(repo, 'themes/community-alpha/catalog.json');
const origin = 'http://127.0.0.1:3427';
const authority = '127.0.0.1:3427';
const prefix = '/api/dsh-community-palettes/';
const groupNames = ['theme-pack', 'catppuccin', 'solarized', 'premium'];
const routes = [
  { group: 'theme-pack', path: `${prefix}theme-pack`, methods: ['GET', 'POST'] },
  { group: 'catppuccin', path: `${prefix}catppuccin`, methods: ['GET', 'POST'] },
  { group: 'solarized', path: `${prefix}solarized`, methods: ['GET', 'POST'] },
  { group: 'premium', path: `${prefix}premium/palette`, methods: ['GET', 'POST'] },
  { group: 'premium', path: `${prefix}premium/custom`, methods: ['GET', 'POST', 'DELETE'] },
];
const customPath = routes[4].path;
const premiumPath = routes[3].path;
const customId = 'security-fixture';
const customThemeId = `dsh-alpha-premium-custom-${customId}`;
const customFixture = {
  id: customId, name: 'Security fixture', colorScheme: 'dark',
  colors: { base: '#112233', accent: '#abcdef', text: '', surface: '' },
  tokens: { '--fixture-color': '#010203' },
};
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
class CheckFailure extends Error {
  constructor(code) { super(code); this.code = code; }
}
const check = (condition, code) => { if (!condition) throw new CheckFailure(code); };
const safeCode = (error) => error instanceof CheckFailure ? error.code : 'UNEXPECTED_RUNTIME_FAILURE';
let runDirectory;
let eventsPath;
let receiptPath;
let cookieHeader = '';
let baseline;
let groups;
let initialInputs;
let restorationAllowed = false;
let mutationAttempted = false;
const started = performance.now();
const report = {
  schemaVersion: 1,
  status: 'running',
  startedAt: new Date().toISOString(),
  purpose: 'Actual HTTP validation of four community palette API security adaptations',
  target: { origin, profileOwnership: 'Caller must independently confirm its isolated official process owns port 3427' },
  inputs: null,
  cases: [],
  cleanup: { attempted: false, restoredInitialState: false },
  limitations: [
    'Prepared script; execution status is set only by a complete real HTTP run.',
    'Catalog and archive hashes identify test inputs, not independent proof of loaded package bytes; pair with the caller installation/host receipt.',
    'No browser, visual, restart, account, model, external-service, or arbitrary-origin acceptance claims.',
    'State equality means byte-for-byte equality of all five authenticated GET responses, including all four settings sections and Premium custom definitions; it is not a direct disk-file audit.',
    'No credentials, launch URLs, request/response headers, response bodies, or unfiltered errors are persisted.',
  ],
};

async function writeReport() {
  if (!receiptPath) return;
  const temporary = `${receiptPath}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  await rename(temporary, receiptPath);
}
async function record(event) {
  await appendFile(eventsPath, `${JSON.stringify(event)}\n`, { mode: 0o600 });
}
async function checkedPath(file, type) {
  check(path.isAbsolute(file), 'ABSOLUTE_PATH_REQUIRED');
  const stat = await lstat(file);
  check(!stat.isSymbolicLink() && (type === 'directory' ? stat.isDirectory() : stat.isFile()), 'REGULAR_TASK_PATH_REQUIRED');
  check(await realpath(file) === path.resolve(file), 'SYMLINK_PATH_REJECTED');
  return stat;
}
async function boundedFile(file, maximum, privateMode = false) {
  const stat = await checkedPath(file, 'file');
  check(stat.size <= maximum, 'INPUT_SIZE_LIMIT');
  if (privateMode) check((stat.mode & 0o077) === 0, 'PRIVATE_FILE_PERMISSIONS_REQUIRED');
  const handle = await open(file, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW);
  try {
    const actual = await handle.stat();
    check(actual.ino === stat.ino && actual.dev === stat.dev && actual.size <= maximum, 'INPUT_CHANGED_DURING_OPEN');
    const bytes = await handle.readFile();
    check(bytes.length <= maximum, 'INPUT_SIZE_LIMIT');
    return bytes;
  } finally { await handle.close(); }
}
async function readInputs() {
  const bytes = await boundedFile(catalogPath, 1024 * 1024);
  const catalog = JSON.parse(bytes.toString('utf8'));
  check(catalog.targetDshVersion === '0.1.3-alpha.1' && Array.isArray(catalog.groups) && catalog.groups.length === 4, 'FOUR_ALPHA_GROUPS_REQUIRED');
  check(new Set(catalog.groups.map((item) => item.group)).size === 4, 'DUPLICATE_GROUP');
  const packages = [];
  for (const name of groupNames) {
    const item = catalog.groups.find((entry) => entry.group === name);
    check(item && item.packageName === `@dsh-themes-community/${name}-alpha`, 'PACKAGE_IDENTITY_MISMATCH');
    check(item.version === '1.0.0-alpha.2', 'SECURITY_PACKAGE_ALPHA_2_REQUIRED');
    check(item.selectionRoute === routes.find((entry) => entry.group === name).path, 'ROUTE_MISMATCH');
    check(typeof item.file === 'string' && /^themes\/community-alpha\/artifacts\/[a-z0-9.-]+\.tgz$/.test(item.file), 'ARCHIVE_PATH_REJECTED');
    check(/^[a-f0-9]{64}$/.test(item.sha256) && Number.isSafeInteger(item.sizeBytes), 'ARCHIVE_BINDING_REQUIRED');
    const archive = await boundedFile(path.join(repo, item.file), 8 * 1024 * 1024);
    check(archive.length === item.sizeBytes && hash(archive) === item.sha256, 'ARCHIVE_BYTES_MISMATCH');
    check(Array.isArray(item.themes) && item.themes.length > 0 && item.themes.every((theme) => typeof theme.id === 'string' && new RegExp(`^dsh-alpha-${name}-[a-z0-9-]+$`).test(theme.id)), 'THEME_IDENTITIES_INVALID');
    packages.push({ group: name, packageName: item.packageName, version: item.version, file: item.file, sha256: item.sha256, sizeBytes: item.sizeBytes });
  }
  return { catalog, binding: { catalogPath: path.relative(repo, catalogPath), catalogSha256: hash(bytes), packages } };
}

// Use node:http so Host can be explicitly varied without changing the TCP peer.
// No environment proxy, DNS lookup, arbitrary host, port or redirect is used.
async function request(caseId, route, { method = 'GET', auth = true, variant = 'same-origin', body, contentType = 'application/json', tokenExchange = false } = {}) {
  check(tokenExchange ? route.startsWith('/?token=') : route === '/' || routes.some((entry) => entry.path === route), 'REQUEST_ROUTE_REJECTED');
  const payload = body === undefined ? undefined : Buffer.from(body);
  const headers = { host: authority, connection: 'close', origin, 'sec-fetch-site': 'same-origin' };
  if (auth && cookieHeader) headers.cookie = cookieHeader;
  if (variant === 'no-cookie') delete headers.cookie;
  else if (variant === 'foreign-origin') headers.origin = 'https://foreign-origin.invalid';
  else if (variant === 'null-origin') headers.origin = 'null';
  else if (variant === 'untrusted-host') {
    headers.host = 'untrusted-host.invalid:3427';
    // A matching foreign Origin isolates Host rejection from Origin mismatch.
    headers.origin = 'http://untrusted-host.invalid:3427';
  } else if (variant === 'cross-site') headers['sec-fetch-site'] = 'cross-site';
  else check(variant === 'same-origin', 'REQUEST_VARIANT_REJECTED');
  if (payload) { headers['content-type'] = contentType; headers['content-length'] = payload.length; }
  const at = performance.now();
  let observedStatus = null;
  let result;
  let fault;
  try {
    result = await new Promise((resolve, reject) => {
      const req = http.request({ hostname: '127.0.0.1', port: 3427, path: route, method, headers, agent: false }, (res) => {
        observedStatus = res.statusCode ?? null;
        const chunks = [];
        let size = 0;
        res.on('data', (chunk) => {
          size += chunk.length;
          if (size > 1024 * 1024) req.destroy(new CheckFailure('RESPONSE_SIZE_LIMIT'));
          else chunks.push(chunk);
        });
        res.once('error', () => reject(new CheckFailure('RESPONSE_STREAM_FAILED')));
        res.once('aborted', () => reject(new CheckFailure('RESPONSE_ABORTED')));
        res.once('end', () => resolve({ status: observedStatus, headers: res.headers, bytes: Buffer.concat(chunks) }));
      });
      req.setTimeout(10_000, () => req.destroy(new CheckFailure('HTTP_TIMEOUT')));
      req.once('error', (error) => reject(error instanceof CheckFailure ? error : new CheckFailure('HTTP_TRANSPORT_FAILED')));
      req.end(payload);
    });
  } catch (error) { fault = error; }
  await record({ kind: 'http', caseId, route: tokenExchange ? 'official-launch-token-exchange' : route, method, variant, status: observedStatus, requestBytes: payload?.length ?? 0, elapsedMs: Math.round(performance.now() - at), ...(fault ? { failureCode: safeCode(fault) } : {}) });
  if (fault) throw fault;
  return result;
}
function parseJson(response) {
  check(response.status === 200, 'AUTHENTICATED_RESPONSE_NOT_200');
  let parsed;
  try { parsed = JSON.parse(response.bytes.toString('utf8')); } catch { throw new CheckFailure('RESPONSE_JSON_INVALID'); }
  check(isObject(parsed), 'RESPONSE_OBJECT_REQUIRED');
  return parsed;
}
async function snapshot(label) {
  const state = {};
  for (const route of routes) {
    const response = await request(`${label}:snapshot`, route.path);
    state[route.path] = { bytes: response.bytes, value: parseJson(response) };
  }
  check(JSON.stringify(state[customPath].value) === JSON.stringify(state[premiumPath].value.customPalettes), 'PREMIUM_STATE_ENDPOINTS_DISAGREE');
  return state;
}
function sameState(a, b) {
  return routes.every((route) => a[route.path].bytes.equals(b[route.path].bytes));
}
const stateDigests = (state) => Object.fromEntries(routes.map((route) => [route.path, hash(state[route.path].bytes)]));
function mutationBody(route, method) {
  if (method === 'GET') return undefined;
  if (route.path === customPath) return JSON.stringify(method === 'DELETE' ? { id: customId } : customFixture);
  const theme = groups[route.group].themes[0];
  return JSON.stringify(route.group === 'premium' ? { palette: theme.id, base: 'dark' } : { selection: theme.id, base: 'dark' });
}
async function rejected(label, route, options, expectedStatus) {
  const before = await snapshot(`${label}:before`);
  let response;
  let fault;
  try {
    if (options.method !== 'GET') mutationAttempted = true;
    response = await request(label, route.path, options);
  } catch (error) { fault = error; }
  const after = await snapshot(`${label}:after`);
  const stateUnchanged = sameState(before, after);
  report.cases.push({ caseId: label, route: route.path, method: options.method, expectedStatus, actualStatus: response?.status ?? null, stateUnchanged, beforeSha256: stateDigests(before), afterSha256: stateDigests(after), ...(fault ? { failureCode: safeCode(fault) } : {}) });
  await writeReport();
  check(stateUnchanged, 'REJECTED_REQUEST_MUTATED_STATE');
  if (fault) throw fault;
  check(response.status === expectedStatus, 'EXPECTED_REJECTION_STATUS_MISMATCH');
}
async function select(group, selected, base) {
  const route = routes.find((entry) => entry.group === group);
  mutationAttempted = true;
  const value = group === 'premium' ? { palette: selected, base } : { selection: selected, base };
  const result = parseJson(await request(`valid:${group}:${selected === 'off' ? 'restore-off' : 'select'}`, route.path, { method: 'POST', body: JSON.stringify(value) }));
  check(result[group === 'premium' ? 'palette' : 'selection'] === selected && result.base === base, 'SELECTION_NOT_SAVED');
  const persisted = parseJson(await request(`valid:${group}:readback`, route.path));
  check(persisted[group === 'premium' ? 'palette' : 'selection'] === selected && persisted.base === base, 'SELECTION_READBACK_MISMATCH');
}
async function cleanup() {
  report.cleanup.attempted = true;
  const current = await snapshot('cleanup:before');
  if (Object.hasOwn(current[customPath].value, customId)) {
    parseJson(await request('cleanup:delete-own-custom', customPath, { method: 'DELETE', body: JSON.stringify({ id: customId }) }));
  }
  for (const group of groupNames) {
    const route = routes.find((entry) => entry.group === group);
    await select(group, 'off', baseline[route.path].value.base);
  }
  const after = await snapshot('cleanup:after');
  report.cleanup.restoredInitialState = sameState(baseline, after);
  report.cleanup.finalSha256 = stateDigests(after);
  check(report.cleanup.restoredInitialState, 'INITIAL_STATE_NOT_RESTORED');
}

async function main() {
  const args = process.argv.slice(2);
  check(args.length === 2 && args[0] === '--settings' && path.resolve(args[1]) === settingsPath, 'EXACT_SETTINGS_ARGUMENT_REQUIRED');
  await checkedPath(work, 'directory');
  runDirectory = path.join(work, `http-check-${Date.now()}-${randomUUID()}`);
  await mkdir(runDirectory, { mode: 0o700 });
  eventsPath = path.join(runDirectory, 'http-facts.ndjson');
  receiptPath = path.join(runDirectory, 'receipt.json');
  await writeFile(eventsPath, '', { flag: 'wx', mode: 0o600 });
  await writeReport();
  const settingsBytes = await boundedFile(settingsPath, 64 * 1024, true);
  const settings = JSON.parse(settingsBytes.toString('utf8'));
  check(settings.dshHome === expectedHome && settings.output === expectedOutput, 'ISOLATED_SETTINGS_PATHS_MISMATCH');
  await checkedPath(expectedHome, 'directory');
  await checkedPath(expectedOutput, 'directory');
  const logPath = path.join(expectedOutput, 'server.log');
  initialInputs = await readInputs();
  groups = Object.fromEntries(initialInputs.catalog.groups.map((group) => [group.group, group]));
  report.inputs = { ...initialInputs.binding, settingsPath: path.relative(repo, settingsPath), settingsSha256: hash(settingsBytes), scriptSha256: hash(await readFile(scriptPath)), dshHome: '~/.dsh-themes/testing/community-palettes-alpha-api-security-20260906', serverLogPath: path.relative(repo, logPath), serverLogCopied: false };
  await writeReport();
  // Read only in memory, never echo a substring or attach the log to evidence.
  let logText = (await boundedFile(logPath, 16 * 1024 * 1024, true)).toString('utf8');
  const matches = [...logText.matchAll(/http:\/\/127\.0\.0\.1:3427\/\?token=[A-Za-z0-9_-]+/g)].map((match) => match[0]);
  const unique = [...new Set(matches)];
  check(unique.length === 1, 'ONE_CURRENT_LAUNCH_URL_REQUIRED');
  let launch = new URL(unique[0]);
  logText = '';
  matches.fill(''); unique.fill('');
  check(launch.origin === origin && launch.pathname === '/' && [...launch.searchParams.keys()].join(',') === 'token', 'LAUNCH_URL_REJECTED');
  let exchanged = await request('official-auth:exchange', `${launch.pathname}${launch.search}`, { auth: false, tokenExchange: true });
  launch = undefined;
  check(exchanged.status === 303 && exchanged.headers.location === '/', 'OFFICIAL_303_EXCHANGE_REQUIRED');
  const cookies = new Map();
  for (const value of exchanged.headers['set-cookie'] ?? []) {
    const pair = value.split(';', 1)[0];
    const split = pair.indexOf('=');
    const name = pair.slice(0, split);
    const secret = pair.slice(split + 1);
    check(split > 0 && /^dsh-auth-[A-Za-z0-9_-]+$/.test(name) && /^[A-Za-z0-9_.-]+$/.test(secret), 'OFFICIAL_COOKIE_SHAPE_REQUIRED');
    cookies.set(name, secret);
  }
  check(cookies.size === 1, 'ONE_OFFICIAL_COOKIE_REQUIRED');
  cookieHeader = [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
  cookies.clear(); exchanged = undefined;
  check((await request('official-auth:index', '/')).status === 200, 'AUTHENTICATED_INDEX_REQUIRED');
  baseline = await snapshot('initial');
  for (const group of groupNames) {
    const route = routes.find((entry) => entry.group === group);
    const state = baseline[route.path].value;
    check(state[group === 'premium' ? 'palette' : 'selection'] === 'off' && ['light', 'dark', 'system'].includes(state.base), 'INITIAL_OFF_STATE_REQUIRED');
    if (group !== 'premium') check(Array.isArray(state.themes) && JSON.stringify(state.themes.map((theme) => theme.id)) === JSON.stringify(groups[group].themes.map((theme) => theme.id)), 'RUNNING_THEME_IDS_MISMATCH');
  }
  check(Object.keys(baseline[customPath].value).length === 0, 'EMPTY_ISOLATED_CUSTOMS_REQUIRED');
  restorationAllowed = true;
  report.initialStateSha256 = stateDigests(baseline);
  await writeReport();

  for (const route of routes) for (const method of route.methods) {
    for (const variant of ['no-cookie', 'foreign-origin', 'null-origin', 'untrusted-host', 'cross-site']) {
      await rejected(`guard:${route.path}:${method}:${variant}`, route, { method, variant, body: mutationBody(route, method) }, variant === 'no-cookie' ? 401 : 403);
    }
  }
  for (const [route, method] of [[routes[3], 'POST'], [routes[4], 'POST'], [routes[4], 'DELETE']]) {
    const cases = [
      ['text-plain', 415, mutationBody(route, method), 'text/plain'],
      ['malformed', 400, '{', 'application/json'],
      ['null', 400, 'null', 'application/json'],
      ['array', 400, '[]', 'application/json'],
      ['over-64-kib', 413, JSON.stringify({ ...JSON.parse(mutationBody(route, method)), padding: 'x'.repeat(65536) }), 'application/json'],
    ];
    for (const [kind, status, body, contentType] of cases) {
      await rejected(`body:${route.path}:${method}:${kind}`, route, { method, body, contentType }, status);
    }
  }
  for (const group of groupNames) {
    await select(group, groups[group].themes[0].id, 'dark');
    report.cases.push({ caseId: `valid:${group}:select-and-readback`, actualStatus: 200 });
    await writeReport();
  }
  const imported = parseJson(await request('valid:custom:import', customPath, { method: 'POST', body: JSON.stringify(customFixture) }));
  check(imported.imported === customId, 'CUSTOM_IMPORT_ID_MISMATCH');
  const saved = parseJson(await request('valid:custom:readback', customPath));
  check(JSON.stringify(saved[customId]) === JSON.stringify(customFixture), 'CUSTOM_IMPORT_FIELDS_MISMATCH');
  await select('premium', customThemeId, 'dark');
  const removed = parseJson(await request('valid:custom:delete-selected', customPath, { method: 'DELETE', body: JSON.stringify({ id: customId }) }));
  check(removed.palette === 'off' && removed.base === 'dark' && !Object.hasOwn(removed.customPalettes, customId), 'CUSTOM_DELETE_RECOVERY_MISMATCH');
  check(Object.keys(parseJson(await request('valid:custom:deleted-readback', customPath))).length === 0, 'CUSTOM_NOT_REMOVED');
  report.cases.push({ caseId: 'valid:custom:import-select-delete-readback', actualStatus: 200, restoredOffOnDeletion: true });
  await writeReport();
  await cleanup();
  const finalInputs = await readInputs();
  check(JSON.stringify(finalInputs.binding) === JSON.stringify(initialInputs.binding), 'CATALOG_OR_ARCHIVES_CHANGED_DURING_RUN');
  check(hash(await boundedFile(settingsPath, 64 * 1024, true)) === report.inputs.settingsSha256, 'SETTINGS_INPUT_CHANGED_DURING_RUN');
  check(hash(await readFile(scriptPath)) === report.inputs.scriptSha256, 'VERIFIER_CHANGED_DURING_RUN');
  check(report.cases.length === 75, 'INCOMPLETE_CASE_COUNT');
  report.status = 'passed';
  report.completedAt = new Date().toISOString();
  report.elapsedMs = Math.round(performance.now() - started);
  report.summary = { supportedRouteMethods: 11, authorizationRejections: 55, premiumBodyRejections: 15, successfulPaletteSelections: 4, successfulCustomLifecycle: 1, restoredInitialState: true };
  await writeReport();
}

try {
  await main();
} catch (error) {
  report.status = 'failed';
  report.failureCode = safeCode(error);
  if (restorationAllowed && mutationAttempted && !report.cleanup.restoredInitialState) {
    try { await cleanup(); } catch (cleanupError) { report.cleanup.failureCode = safeCode(cleanupError); }
  }
  report.completedAt = new Date().toISOString();
  report.elapsedMs = Math.round(performance.now() - started);
  try { await writeReport(); } catch { /* Never print unfiltered filesystem or request exceptions. */ }
  process.exitCode = 1;
} finally {
  cookieHeader = '';
  console.log(JSON.stringify({ status: report.status, ...(report.failureCode ? { failureCode: report.failureCode } : {}), receipt: receiptPath ? path.relative(repo, receiptPath) : null, credentialsRecorded: false }));
}
