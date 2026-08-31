#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { lstat, open, realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, parse, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { loadCandidateIntake, validateCandidateIntake } from './candidate-intake.mjs';

const SHA40 = /^[a-f0-9]{40}$/u;
const SAFE_PATH = /^[A-Za-z0-9@._+/-]{1,300}$/u;
const SAFE_PACKAGE_REF = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*(?:\/[a-z0-9][a-z0-9._~-]*)?$/u;
const MAX_TREE_BYTES = 8 * 1024 * 1024;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_SCANNED_BYTES = 32 * 1024 * 1024;
const MAX_TRACKED_FILES = 5000;
const MAX_LOCATIONS = 24;
const RECEIPT_KEYS = Object.freeze([
  'schemaVersion', 'status', 'authorityEffect', 'candidateExecuted', 'catalogId',
  'source', 'scan', 'declared', 'classification', 'privacy',
]);
const SCANNED_EXTENSIONS = new Set([
  '.bat', '.cjs', '.cmd', '.css', '.cts', '.html', '.js', '.jsx', '.json', '.mjs', '.mts', '.ps1',
  '.sh', '.svelte', '.ts', '.tsx', '.vue', '.yaml', '.yml',
]);
const SCANNED_FILENAMES = new Set(['.gitattributes']);
const ARCHIVE_OR_BINARY_EXTENSIONS = new Set([
  '.7z', '.bz2', '.dll', '.dylib', '.exe', '.gz', '.node', '.so', '.tar', '.tgz', '.wasm', '.xz', '.zip',
]);
const LIFECYCLE_HOOKS = [
  'preinstall', 'install', 'postinstall', 'prepublish', 'preprepare', 'prepare', 'postprepare',
];
const BASELINE_ABSENT_PACKAGES = new Set([
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-host-apiproxy',
]);

const SIGNALS = Object.freeze([
  ['raw-webserver-route', 'high-review', /\bwebServer\s*\.\s*register\s*\(/gu],
  ['browserauth-rejection-reference', 'information', /\brequestRejection\s*\(/gu],
  ['authenticated-connection-route', 'information', /\bconnection\s*\.\s*fetch\s*\.\s*register\s*\(/gu],
  ['child-process-module', 'high-review', /(?:node:)?child_process|\bBun\.spawn\s*\(|\bDeno\.Command\s*\(|\b(?:Start-Process|Start-Job|Invoke-Command)\b/gu],
  ['shell-execution-option', 'high-review', /\bshell\s*:\s*(?:true|['"`][^'"`]+['"`])|\b(?:bash|zsh|pwsh|powershell|cmd(?:\.exe)?)\s+-[a-z]*c\b/giu],
  ['filesystem-write-api', 'review', /\b(?:writeFile|appendFile|createWriteStream|rename|rm|unlink|mkdir|chmod|chown|symlink)\s*\(|\b(?:Remove-Item|Set-Content|Add-Content|Out-File|New-Item|Move-Item|Copy-Item)\b|\b(?:rm|chmod|chown)\s+(?:-[^\n]+\s+)?/gu],
  ['network-client-api', 'review', /\b(?:fetch|WebSocket|EventSource)\s*\(|(?:from|require\s*\()\s*['"](?:node:)?(?:http|https|net|tls)['"]|\bundici\b|\baxios\b|\b(?:Invoke-WebRequest|Invoke-RestMethod|Start-BitsTransfer|curl|wget)\b/giu],
  ['environment-read', 'review', /\bprocess\s*\.\s*env\b|\bBun\s*\.\s*env\b|\bDeno\s*\.\s*env\b|\$env:[A-Za-z_][A-Za-z0-9_]*|\$(?:\{)?(?:PATH|HOME|USER|SHELL|AWS_[A-Z0-9_]+|GITHUB_[A-Z0-9_]+)\b/gu],
  ['credential-or-token-reference', 'high-review', /\b(?:credentials?|authorization|auth\.json|access[_-]?token|refresh[_-]?token|api[_-]?key)\b/giu],
  ['browser-persistence', 'review', /\b(?:localStorage|sessionStorage|indexedDB|document\s*\.\s*cookie)\b/gu],
  ['dynamic-code-or-html-sink', 'high-review', /\b(?:eval|Function)\s*\(|\beval\s+|\b(?:innerHTML|outerHTML)\s*=|dangerouslySetInnerHTML|insertAdjacentHTML\s*\(/gu],
  ['mutable-upstream-coordinate', 'high-review', /(?:releases\/latest|\/latest\b|\b(?:main|master)\b\s*(?:branch|ref)|\bnpm\s+(?:view|install)\b[^\n]*(?:latest|\*)?)/giu],
  ['home-or-global-state-path', 'review', /\bhomedir\s*\(|(?:^|[^A-Za-z0-9_])~\/(?:\.[A-Za-z0-9_-]+|[A-Za-z0-9_-]+)|\.dsh\b/gu],
  ['process-or-tool-wrapper', 'review', /\b(?:wrap|wrapper|monkeyPatch|intercept)\b|Symbol\.for\s*\([^)]*wrapper/giu],
  ['git-lfs-reference', 'high-review', /\bfilter\s*=\s*lfs\b|git-lfs\.github\.com\/spec/giu],
]);
const STRUCTURAL_SIGNALS = Object.freeze([
  ['binary-or-non-utf8-text-file', 'high-review'],
  ['skipped-text-budget-file', 'high-review'],
  ['tracked-executable-file', 'review'],
  ['tracked-gitlink', 'high-review'],
  ['tracked-symbolic-link', 'high-review'],
  ['tracked-archive-or-native-binary', 'high-review'],
  ['oversize-text-file', 'high-review'],
]);
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });
const UTF16LE_DECODER = new TextDecoder('utf-16le', { fatal: true });
const UTF16BE_DECODER = new TextDecoder('utf-16be', { fatal: true });

function fail(message) {
  throw new Error(message);
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  }
  return value;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  return isPlainObject(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function isBoundedInteger(value, minimum, maximum) {
  return Number.isSafeInteger(value) && value >= minimum && value <= maximum;
}

function isSortedUniqueStrings(value, { maximumLength = 300, maximumItems = 1000 } = {}) {
  return Array.isArray(value) && value.length <= maximumItems && value.every((entry) =>
    typeof entry === 'string' && entry.length > 0 && entry.length <= maximumLength &&
    SAFE_PACKAGE_REF.test(entry)) &&
    value.every((entry, index) => index === 0 || value[index - 1] < entry);
}

function policySha256() {
  return sha256(Buffer.from(`${JSON.stringify({
    maxFileBytes: MAX_FILE_BYTES,
    maxScannedBytes: MAX_SCANNED_BYTES,
    maxTreeBytes: MAX_TREE_BYTES,
    maxTrackedFiles: MAX_TRACKED_FILES,
    maxLocations: MAX_LOCATIONS,
    lifecycleHooks: LIFECYCLE_HOOKS,
    baselineAbsentPackages: [...BASELINE_ABSENT_PACKAGES].sort(),
    safePackageRef: SAFE_PACKAGE_REF.source,
    scannedExtensions: [...SCANNED_EXTENSIONS].sort(),
    scannedFilenames: [...SCANNED_FILENAMES].sort(),
    archiveOrBinaryExtensions: [...ARCHIVE_OR_BINARY_EXTENSIONS].sort(),
    signals: SIGNALS.map(([id, severity, pattern]) => ({ id, severity, pattern: pattern.source, flags: pattern.flags })),
    structuralSignals: STRUCTURAL_SIGNALS.map(([id, severity]) => ({ id, severity })),
  })}\n`));
}

function git(source, args, { encoding = 'utf8', maxBuffer = MAX_TREE_BYTES } = {}) {
  const executablePath = process.env.PATH ?? process.env.Path;
  if (typeof executablePath !== 'string' || executablePath.length === 0) {
    fail('candidate Git inspection requires an explicit executable PATH');
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
  const result = spawnSync('git', ['-c', 'core.fsmonitor=false', '-C', source, ...args], {
    encoding,
    env: environment,
    maxBuffer,
    shell: false,
    timeout: 30_000,
    windowsHide: true,
  });
  const stderr = Buffer.isBuffer(result.stderr)
    ? result.stderr.toString('utf8')
    : String(result.stderr ?? '');
  if (result.error || result.status !== 0 || stderr.trim() !== '') {
    fail('candidate Git object inspection failed');
  }
  return result.stdout;
}

async function exactCheckout(input, candidate) {
  if (!isAbsolute(input)) fail('--source must be an absolute checkout');
  const requested = resolve(input);
  if (requested === parse(requested).root) fail('--source cannot be a filesystem root');
  const stat = await lstat(requested);
  if (!stat.isDirectory() || stat.isSymbolicLink()) fail('--source must be one real checkout');
  const source = await realpath(requested);
  const commit = git(source, ['rev-parse', '--verify', 'HEAD^{commit}']).trim();
  const tree = SHA40.test(commit)
    ? git(source, ['rev-parse', '--verify', `${commit}^{tree}`]).trim()
    : '';
  const dirty = git(source, ['status', '--porcelain=v1', '--untracked-files=no']).trim();
  if (commit !== candidate.commit || !SHA40.test(tree) || dirty !== '') {
    fail('candidate checkout does not match the clean exact intake identity');
  }
  return { source, commit, tree };
}

function treeEntries(source, commit) {
  const args = ['ls-tree', '-r', '-z', '--long', commit];
  const bytes = git(source, args, { encoding: null, maxBuffer: MAX_TREE_BYTES });
  const records = bytes.toString('utf8').split('\0').filter(Boolean);
  if (records.length < 1 || records.length > MAX_TRACKED_FILES) {
    fail('candidate tracked-file count is empty or exceeds the static-risk bound');
  }
  return records.map((record) => {
    const match = /^(\d{6}) (\w+) ([a-f0-9]{40})\s+(-|\d+)\t([\s\S]+)$/u.exec(record);
    if (!match) fail('candidate Git tree record is malformed');
    return {
      mode: match[1], type: match[2], object: match[3],
      size: match[4] === '-' ? null : Number(match[4]), path: match[5],
    };
  });
}

function extension(path) {
  const index = path.lastIndexOf('.');
  return index < 0 ? '' : path.slice(index).toLowerCase();
}

function safeLocationPath(path) {
  return SAFE_PATH.test(path) && !path.includes('//') && !path.split('/').includes('..')
    ? path
    : `unsafe-path-${sha256(Buffer.from(path))}`;
}

function lineStarts(text) {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text.charCodeAt(index) === 10) starts.push(index + 1);
  }
  return starts;
}

function lineAt(starts, index) {
  let low = 0;
  let high = starts.length;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (starts[middle] <= index) low = middle + 1;
    else high = middle;
  }
  return low;
}

function manifestPath(sourceSubdir) {
  return sourceSubdir === '.' ? 'package.json' : `${sourceSubdir}/package.json`;
}

function decodeText(bytes) {
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return UTF16LE_DECODER.decode(bytes);
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return UTF16BE_DECODER.decode(bytes);
  }
  if (bytes.includes(0)) return null;
  return UTF8_DECODER.decode(bytes);
}

function declaredTextPaths(manifest, sourceSubdir) {
  const paths = new Set();
  const add = (value) => {
    if (typeof value !== 'string') return;
    const path = value.replace(/^\.\//u, '');
    if (!/^(?:[A-Za-z0-9@._+-]+\/)*[A-Za-z0-9@._+-]+$/u.test(path) ||
        path.split('/').includes('..')) return;
    paths.add(sourceSubdir === '.' ? path : `${sourceSubdir}/${path}`);
  };
  add(manifest?.dsh?.bundle?.patch);
  if (typeof manifest?.bin === 'string') add(manifest.bin);
  else if (isPlainObject(manifest?.bin)) {
    for (const value of Object.values(manifest.bin)) add(value);
  }
  return paths;
}

function lifecycleFromManifest(manifest) {
  const scripts = manifest?.scripts;
  return Object.fromEntries(LIFECYCLE_HOOKS.map((name) => [
    name,
    scripts !== null && typeof scripts === 'object' && !Array.isArray(scripts) &&
      typeof scripts[name] === 'string',
  ]));
}

function dependencyNames(manifest) {
  const names = new Set();
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    const value = manifest?.[field];
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      for (const name of Object.keys(value)) names.add(name);
    }
  }
  return [...names].sort();
}

function validateReceipt(receipt, candidate) {
  if (!hasExactKeys(receipt, RECEIPT_KEYS) || receipt.schemaVersion !== 1 ||
      receipt.status !== 'static-risk-inventory-complete' || receipt.candidateExecuted !== false ||
      receipt.catalogId !== candidate.catalogId ||
      receipt.authorityEffect !== 'none-review-prioritization-only' ||
      !hasExactKeys(receipt.source, ['repository', 'commit', 'tree', 'sourceSubdir']) ||
      receipt.source.repository !== candidate.repository || receipt.source.commit !== candidate.commit ||
      receipt.source.sourceSubdir !== (candidate.sourceSubdir ?? '.') ||
      !SHA40.test(receipt.source.tree ?? '') ||
      !hasExactKeys(receipt.scan, [
        'policySha256', 'trackedFileCount', 'scannedFileCount', 'scannedBytes',
        'skippedOversizeCount', 'skippedBudgetCount', 'skippedBinaryCount', 'findings',
      ]) || receipt.scan.policySha256 !== policySha256() ||
      !isBoundedInteger(receipt.scan.trackedFileCount, 1, MAX_TRACKED_FILES) ||
      !isBoundedInteger(receipt.scan.scannedFileCount, 0, receipt.scan.trackedFileCount) ||
      !isBoundedInteger(receipt.scan.scannedBytes, 0, MAX_SCANNED_BYTES) ||
      !isBoundedInteger(receipt.scan.skippedOversizeCount, 0, receipt.scan.trackedFileCount) ||
      !isBoundedInteger(receipt.scan.skippedBudgetCount, 0, receipt.scan.trackedFileCount) ||
      !isBoundedInteger(receipt.scan.skippedBinaryCount, 0, receipt.scan.trackedFileCount) ||
      receipt.scan.scannedFileCount + receipt.scan.skippedOversizeCount +
        receipt.scan.skippedBudgetCount + receipt.scan.skippedBinaryCount >
        receipt.scan.trackedFileCount ||
      !Array.isArray(receipt.scan.findings) ||
      !hasExactKeys(receipt.declared, ['lifecycle', 'dependencies', 'dshClientInject']) ||
      !hasExactKeys(receipt.declared.lifecycle, LIFECYCLE_HOOKS) ||
      !LIFECYCLE_HOOKS.every((name) => typeof receipt.declared.lifecycle[name] === 'boolean') ||
      !isSortedUniqueStrings(receipt.declared.dependencies, { maximumLength: 214 }) ||
      !isSortedUniqueStrings(receipt.declared.dshClientInject, { maximumLength: 214 }) ||
      !hasExactKeys(receipt.classification, [
        'requiresElevatedStaticReview', 'rawWebRouteAuthState', 'baselineAbsentPackages',
      ]) || typeof receipt.classification.requiresElevatedStaticReview !== 'boolean' ||
      !isSortedUniqueStrings(receipt.classification.baselineAbsentPackages, {
        maximumLength: 214,
        maximumItems: 2,
      }) ||
      !receipt.classification.baselineAbsentPackages.every((name) => BASELINE_ABSENT_PACKAGES.has(name)) ||
      !hasExactKeys(receipt.privacy, [
        'capturesSourceSnippets', 'capturesCredentials', 'capturesEnvironmentValues',
        'capturesLifecycleCommands',
      ]) || receipt.privacy.capturesSourceSnippets !== false ||
      receipt.privacy.capturesCredentials !== false ||
      receipt.privacy.capturesEnvironmentValues !== false ||
      receipt.privacy.capturesLifecycleCommands !== false) {
    fail('static-risk receipt identity or fail-closed boundary mismatch');
  }
  const findingSeverities = new Map([
    ...SIGNALS.map(([id, severity]) => [id, severity]),
    ...STRUCTURAL_SIGNALS,
  ]);
  const knownFindingIds = new Set(findingSeverities.keys());
  const seenFindingIds = new Set();
  for (const finding of receipt.scan.findings) {
    if (!hasExactKeys(finding, ['id', 'severity', 'occurrences', 'locations']) ||
        !knownFindingIds.has(finding.id) || seenFindingIds.has(finding.id) ||
        !['information', 'review', 'high-review'].includes(finding.severity) ||
        !isBoundedInteger(finding.occurrences, 1, MAX_SCANNED_BYTES) ||
        !Array.isArray(finding.locations) || finding.locations.length > MAX_LOCATIONS ||
        finding.locations.length > finding.occurrences) {
      fail('static-risk receipt contains a malformed or duplicate finding');
    }
    const expectedSeverity = findingSeverities.get(finding.id);
    if (finding.severity !== expectedSeverity) {
      fail('static-risk receipt finding severity or location boundary mismatch');
    }
    const seenLocations = new Set();
    for (const location of finding.locations) {
      const key = `${location?.path}:${location?.line}`;
      if (!hasExactKeys(location, ['path', 'line']) ||
          typeof location.path !== 'string' || !SAFE_PATH.test(location.path) ||
          location.path.includes('//') || location.path.split('/').includes('..') ||
          !isBoundedInteger(location.line, 1, MAX_SCANNED_BYTES) || seenLocations.has(key)) {
        fail('static-risk receipt contains an unsafe or duplicate location');
      }
      seenLocations.add(key);
    }
    seenFindingIds.add(finding.id);
  }
  const findingById = new Map(receipt.scan.findings.map((finding) => [finding.id, finding]));
  for (const [countKey, findingId] of [
    ['skippedBinaryCount', 'binary-or-non-utf8-text-file'],
    ['skippedBudgetCount', 'skipped-text-budget-file'],
    ['skippedOversizeCount', 'oversize-text-file'],
  ]) {
    if (receipt.scan[countKey] !== (findingById.get(findingId)?.occurrences ?? 0)) {
      fail('static-risk receipt skip counters do not match structural findings');
    }
  }
  const rawRouteCount = findingById.get('raw-webserver-route')?.occurrences ?? 0;
  const authReferenceCount =
    (findingById.get('browserauth-rejection-reference')?.occurrences ?? 0) +
    (findingById.get('authenticated-connection-route')?.occurrences ?? 0);
  const expectedAuthState = rawRouteCount === 0
    ? 'no-raw-webserver-route-found'
    : authReferenceCount === 0
      ? 'raw-route-without-official-auth-reference'
      : 'raw-route-with-auth-reference-manual-review-required';
  const expectedElevatedStaticReview = receipt.scan.findings.some(
    (finding) => finding.severity !== 'information') ||
    LIFECYCLE_HOOKS.some((name) => receipt.declared.lifecycle[name]);
  const expectedRemovedPackages = [...new Set([
    ...receipt.declared.dependencies,
    ...receipt.declared.dshClientInject,
  ].filter((name) => BASELINE_ABSENT_PACKAGES.has(name)))].sort();
  if (receipt.classification.rawWebRouteAuthState !== expectedAuthState ||
      receipt.classification.requiresElevatedStaticReview !== expectedElevatedStaticReview ||
      JSON.stringify(receipt.classification.baselineAbsentPackages) !==
        JSON.stringify(expectedRemovedPackages)) {
    fail('static-risk receipt classification is not derived from its bounded evidence');
  }
  return receipt;
}

export { validateReceipt as validateCandidateStaticRiskReceipt };

export async function auditCandidateStaticRisk({ candidate, source: sourceInput }) {
  const checkout = await exactCheckout(sourceInput, candidate);
  const sourceSubdir = candidate.sourceSubdir ?? '.';
  const entries = treeEntries(checkout.source, checkout.commit);
  const manifestEntry = entries.find((entry) => entry.path === manifestPath(sourceSubdir));
  if (!manifestEntry || manifestEntry.type !== 'blob' || manifestEntry.mode === '120000' ||
      !Number.isSafeInteger(manifestEntry.size) || manifestEntry.size < 2 ||
      manifestEntry.size > MAX_FILE_BYTES) {
    fail('candidate risk scan requires one bounded regular package manifest');
  }
  let manifest;
  try {
    manifest = JSON.parse(git(checkout.source, ['cat-file', 'blob', manifestEntry.object], {
      maxBuffer: MAX_FILE_BYTES,
    }));
  } catch {
    fail('candidate package manifest is not JSON');
  }
  if (!isPlainObject(manifest)) fail('candidate package manifest must be one JSON object');
  const lifecycle = lifecycleFromManifest(manifest);
  const declaredPaths = declaredTextPaths(manifest, sourceSubdir);
  const dependencies = dependencyNames(manifest);
  const dshClientInject = Array.isArray(manifest?.dsh?.client?.inject)
    ? [...manifest.dsh.client.inject].filter((value) => typeof value === 'string').sort()
    : [];
  const baselineAbsentPackages = [...new Set([
    ...dependencies,
    ...dshClientInject,
  ].filter((name) => BASELINE_ABSENT_PACKAGES.has(name)))].sort();
  const findingMap = new Map([
    ...SIGNALS.map(([id, severity]) => [id, { id, severity, occurrences: 0, locations: [] }]),
    ...STRUCTURAL_SIGNALS.map(([id, severity]) => [
      id, { id, severity, occurrences: 0, locations: [] },
    ]),
  ]);
  const recordStructural = (id, entry) => {
    const finding = findingMap.get(id);
    finding.occurrences += 1;
    if (finding.locations.length < MAX_LOCATIONS) {
      const location = { path: safeLocationPath(entry.path), line: 1 };
      if (!finding.locations.some((item) => item.path === location.path)) {
        finding.locations.push(location);
      }
    }
  };
  let scannedFileCount = 0;
  let scannedBytes = 0;
  let skippedOversizeCount = 0;
  let skippedBudgetCount = 0;
  let skippedBinaryCount = 0;
  for (const entry of entries) {
    if (entry.type !== 'blob') {
      if (entry.type === 'commit') recordStructural('tracked-gitlink', entry);
      continue;
    }
    if (entry.mode === '120000') {
      recordStructural('tracked-symbolic-link', entry);
      continue;
    }
    if (entry.mode === '100755') recordStructural('tracked-executable-file', entry);
    const entryExtension = extension(entry.path);
    if (ARCHIVE_OR_BINARY_EXTENSIONS.has(entryExtension)) {
      recordStructural('tracked-archive-or-native-binary', entry);
      continue;
    }
    if (!SCANNED_EXTENSIONS.has(entryExtension) &&
        !SCANNED_FILENAMES.has(entry.path.split('/').at(-1)) &&
        !declaredPaths.has(entry.path)) continue;
    if (!Number.isSafeInteger(entry.size) || entry.size < 0 || entry.size > MAX_FILE_BYTES) {
      skippedOversizeCount += 1;
      recordStructural('oversize-text-file', entry);
      continue;
    }
    if (scannedBytes + entry.size > MAX_SCANNED_BYTES) {
      skippedBudgetCount += 1;
      recordStructural('skipped-text-budget-file', entry);
      continue;
    }
    scannedBytes += entry.size;
    const bytes = git(checkout.source, ['cat-file', 'blob', entry.object], {
      encoding: null,
      maxBuffer: MAX_FILE_BYTES,
    });
    let text;
    try {
      text = decodeText(bytes);
      if (text === null) throw new Error('binary');
    } catch {
      skippedBinaryCount += 1;
      recordStructural('binary-or-non-utf8-text-file', entry);
      continue;
    }
    scannedFileCount += 1;
    const starts = lineStarts(text);
    for (const [id, , pattern] of SIGNALS) {
      pattern.lastIndex = 0;
      for (const match of text.matchAll(pattern)) {
        const finding = findingMap.get(id);
        finding.occurrences += 1;
        if (finding.locations.length < MAX_LOCATIONS) {
          const location = { path: safeLocationPath(entry.path), line: lineAt(starts, match.index) };
          if (!finding.locations.some((item) =>
            item.path === location.path && item.line === location.line)) {
            finding.locations.push(location);
          }
        }
      }
    }
  }
  const findings = [...findingMap.values()].filter((finding) => finding.occurrences > 0);
  findings.sort((left, right) => left.id.localeCompare(right.id));
  const byId = new Map(findings.map((finding) => [finding.id, finding]));
  const rawRouteCount = byId.get('raw-webserver-route')?.occurrences ?? 0;
  const authReferenceCount = (byId.get('browserauth-rejection-reference')?.occurrences ?? 0) +
    (byId.get('authenticated-connection-route')?.occurrences ?? 0);
  const receipt = {
    schemaVersion: 1,
    status: 'static-risk-inventory-complete',
    authorityEffect: 'none-review-prioritization-only',
    candidateExecuted: false,
    catalogId: candidate.catalogId,
    source: {
      repository: candidate.repository,
      commit: checkout.commit,
      tree: checkout.tree,
      sourceSubdir,
    },
    scan: {
      policySha256: policySha256(),
      trackedFileCount: entries.length,
      scannedFileCount,
      scannedBytes,
      skippedOversizeCount,
      skippedBudgetCount,
      skippedBinaryCount,
      findings,
    },
    declared: {
      lifecycle,
      dependencies,
      dshClientInject,
    },
    classification: {
      requiresElevatedStaticReview: findings.some((finding) => finding.severity !== 'information') ||
        LIFECYCLE_HOOKS.some((name) => lifecycle[name]),
      rawWebRouteAuthState: rawRouteCount === 0
        ? 'no-raw-webserver-route-found'
        : authReferenceCount === 0
          ? 'raw-route-without-official-auth-reference'
          : 'raw-route-with-auth-reference-manual-review-required',
      baselineAbsentPackages,
    },
    privacy: {
      capturesSourceSnippets: false,
      capturesCredentials: false,
      capturesEnvironmentValues: false,
      capturesLifecycleCommands: false,
    },
  };
  return validateReceipt(receipt, candidate);
}

async function writeNew(outputInput, receipt) {
  if (!isAbsolute(outputInput)) fail('--out must be an absolute new JSON path');
  const requested = resolve(outputInput);
  const name = basename(requested);
  if (requested === parse(requested).root || ['.', '..'].includes(name) ||
      name !== basename(outputInput)) {
    fail('--out must be one bounded absolute file path');
  }
  const output = resolve(await realpath(dirname(requested)), name);
  const handle = await open(output, 'wx', 0o600);
  try {
    await handle.writeFile(`${JSON.stringify(stable(receipt), null, 2)}\n`);
  } finally {
    await handle.close();
  }
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!['--id', '--source', '--out'].includes(key) || value === undefined || options[key]) {
      fail('usage: audit-candidate-risk.mjs --id <#3NNN> --source <checkout> --out <new.json>');
    }
    options[key] = value;
  }
  if (Object.keys(options).length !== 3) fail('candidate risk scan arguments are incomplete');
  return options;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const intake = validateCandidateIntake(await loadCandidateIntake());
    const catalogId = Number(options['--id'].replace(/^#/u, ''));
    const candidate = intake.items.find((item) => item.catalogId === catalogId);
    if (!candidate) fail('candidate ID does not resolve exactly once');
    const receipt = await auditCandidateStaticRisk({ candidate, source: options['--source'] });
    await writeNew(options['--out'], receipt);
    process.stdout.write(`${JSON.stringify({
      catalogId,
      status: receipt.status,
      candidateExecuted: false,
      findingCount: receipt.scan.findings.length,
      requiresElevatedStaticReview: receipt.classification.requiresElevatedStaticReview,
    })}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
