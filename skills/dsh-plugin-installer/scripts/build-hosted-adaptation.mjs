#!/usr/bin/env node

import { parse as parseJavaScript } from 'acorn';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { lstat, open, readFile, realpath, unlink } from 'node:fs/promises';
import { builtinModules } from 'node:module';
import { isAbsolute, join, parse, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assertNoRegularFilePathConflicts,
  assertSafeArchiveEntryPath,
  inspectTarEntries,
} from './archive-policy.mjs';
import { validatePluginRuntimeProbe } from './plugin-runtime-probe.mjs';

const recipesRoot = new URL('../references/plugin-runtime-build-recipes/', import.meta.url);
const skillRoot = new URL('../', import.meta.url);
const SHA40 = /^[a-f0-9]{40}$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const SAFE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const ASSERTION_ID = /^[a-z0-9]+(?:[._:-][a-z0-9]+)*$/u;
const ASCII_PATH = /^(?:[A-Za-z0-9_-](?:[A-Za-z0-9._-]*[A-Za-z0-9_-])?\/)*[A-Za-z0-9_-](?:[A-Za-z0-9._-]*[A-Za-z0-9_-])?$/u;
const PACKAGE = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/u;
const SCRIPT_ENTRY = /\.(?:js|mjs|cjs)$/u;
const MAX_FILE_BYTES = 16 * 1024 * 1024;
const MAX_TAR_BYTES = 256 * 1024 * 1024;
const OFFICIAL_BASELINE = Object.freeze({
  tag: 'dsh-v0.1.2-alpha.2',
  commit: '0a53fb55bea101816fa226bb964ae2bed71c343b',
  tree: '64ccbfa8e0caa4711cd4a75717ef9e022657961b',
});
const LICENSES = new Set(['MIT', 'Apache-2.0', 'BSD-3-Clause', 'AGPL-3.0']);
const BASELINE_ABSENT_PACKAGES = new Set([
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-host-apiproxy',
]);
const RESERVED_DEPENDENCY_NAMES = new Set([
  '__proto__',
  'constructor',
  'prototype',
]);
const NODE_BUILTIN_DEPENDENCIES = new Set(builtinModules.flatMap((name) => {
  const bare = name.replace(/^node:/u, '');
  return [bare, `node:${bare}`];
}));
export const REVIEWED_REACT_CREATE_ELEMENT_POLICY = Object.freeze({
  intrinsicTags: Object.freeze([
    'article', 'button', 'circle', 'code', 'dd', 'details', 'div', 'dl', 'dt', 'footer',
    'form', 'h2', 'h3', 'header', 'input', 'label', 'li', 'option', 'p', 'section',
    'select', 'span', 'strong', 'summary', 'svg', 'textarea', 'ul',
  ]),
  propertyNames: Object.freeze([
    'aria-busy', 'aria-controls', 'aria-current', 'aria-expanded', 'aria-haspopup',
    'aria-hidden', 'aria-label', 'aria-labelledby', 'aria-live', 'aria-modal',
    'aria-pressed', 'aria-selected', 'autoComplete', 'autoFocus', 'className', 'cx', 'cy',
    'data-column', 'data-current', 'data-dsh-automation-inherited-permissions',
    'data-dsh-automation-locales', 'data-dsh-automation-memory',
    'data-dsh-automation-root-only', 'data-dsh-automation-run',
    'data-dsh-automation-schedule', 'data-dsh-automation-session',
    'data-dsh-automation-slots', 'data-dsh-better-model-selector', 'data-dsh-client-probe',
    'data-dsh-context-vista', 'data-dsh-kanban-columns', 'data-dsh-kanban-controller',
    'data-dsh-kanban-ephemeral', 'data-dsh-kanban-list', 'data-dsh-kanban-locales',
    'data-dsh-kanban-slots', 'data-dsh-plugin', 'data-dsh-settings-probe',
    'data-dsh-slot-probe', 'data-dsh3042-client', 'data-dsh3042-dispose',
    'data-dsh3042-locales', 'data-dsh3042-note', 'data-dsh3042-official-remote',
    'data-dsh3042-reference', 'data-dsh3042-slot', 'data-group-count',
    'data-namespace-group', 'data-phase', 'data-plugin-entry', 'disabled', 'htmlFor', 'id',
    'key', 'maxLength', 'min', 'onChange', 'onClick', 'onKeyDown', 'onSubmit', 'pathLength',
    'placeholder', 'r', 'ref', 'required', 'role', 'spellCheck', 'step', 'strokeDasharray',
    'tabIndex', 'title', 'type', 'value', 'viewBox',
  ]),
});
const REVIEWED_REACT_INTRINSICS = new Set(
  REVIEWED_REACT_CREATE_ELEMENT_POLICY.intrinsicTags
);
const REVIEWED_REACT_PROPERTIES = new Set(
  REVIEWED_REACT_CREATE_ELEMENT_POLICY.propertyNames
);
const FORBIDDEN_CSS_REFERENCE = /(?:@import|url\s*\()/iu;

function fail(message) {
  throw new Error(message);
}

function exactKeys(value, keys, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) {
    fail(`${label} keys mismatch`);
  }
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

function canonicalJson(value) {
  return Buffer.from(`${JSON.stringify(stable(value), null, 2)}\n`);
}

function uniqueStrings(values, pattern, label, minimum = 1) {
  if (!Array.isArray(values) || values.length < minimum || values.length > 64 ||
      values.some((value) => typeof value !== 'string' || !pattern.test(value)) ||
      new Set(values).size !== values.length) {
    fail(`${label} must be one bounded unique string list`);
  }
}

function validateComputedMemberAuthority(values) {
  if (!Array.isArray(values) || values.length !== 0) {
    fail('adaptation computed-member authority must be exactly an empty array');
  }
}

function portablePackagePath(value, label) {
  if (typeof value !== 'string' || !ASCII_PATH.test(value) || value.length > 240) {
    fail(`${label} is not one bounded ASCII package path`);
  }
  try {
    assertSafeArchiveEntryPath(`package/${value}`);
  } catch (error) {
    fail(`${label} is not portable: ${error.message}`);
  }
  return value;
}

function codePointCompare(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function validateFile(file, index) {
  const label = `adaptation output.files[${index}]`;
  exactKeys(file, ['outputPath', 'input'], label);
  portablePackagePath(file.outputPath, `${label}.outputPath`);
  if (['package.json', 'notice.md', 'sbom.cdx.json']
    .includes(file.outputPath.toLocaleLowerCase('en-US'))) {
    fail(`${label} output path is reserved or unsafe`);
  }
  const input = file.input;
  if (input?.kind === 'copy-exact-upstream') {
    exactKeys(input, ['kind', 'sourcePath', 'sha256'], `${label}.input`);
    portablePackagePath(input.sourcePath, `${label}.input.sourcePath`);
    if (!SHA256.test(input.sha256 ?? '')) {
      fail(`${label} exact upstream input is malformed`);
    }
    return;
  }
  if (input?.kind === 'reviewed-replacement') {
    exactKeys(
      input,
      ['kind', 'sourcePath', 'sourceSha256', 'replacementPath', 'replacementSha256'],
      `${label}.input`
    );
    portablePackagePath(input.sourcePath, `${label}.input.sourcePath`);
    portablePackagePath(input.replacementPath, `${label}.input.replacementPath`);
    if (!SHA256.test(input.sourceSha256 ?? '') || !SHA256.test(input.replacementSha256 ?? '')) {
      fail(`${label} reviewed replacement is malformed`);
    }
    return;
  }
  fail(`${label} input kind is unsupported`);
}

export function validateHostedAdaptationRecipe(recipe) {
  exactKeys(recipe, [
    'schemaVersion', 'purpose', 'catalogId', 'slug', 'baseline', 'source',
    'output', 'rights', 'staticPolicy', 'runtimeProbe',
  ], 'hosted adaptation');
  if (recipe.schemaVersion !== 1 || recipe.purpose !== 'dsh-alpha2-hosted-plugin-adaptation' ||
      !Number.isSafeInteger(recipe.catalogId) || recipe.catalogId < 3000 ||
      recipe.catalogId > 9999 || !SAFE_ID.test(recipe.slug ?? '')) {
    fail('hosted adaptation identity is malformed');
  }
  exactKeys(recipe.baseline, ['tag', 'commit', 'tree'], 'adaptation baseline');
  if (JSON.stringify(recipe.baseline) !== JSON.stringify(OFFICIAL_BASELINE)) {
    fail('hosted adaptation baseline is not the exact official alpha.2 source');
  }
  exactKeys(recipe.source, [
    'repository', 'commit', 'tree', 'sourceSubdir', 'manifestSha256',
    'packageName', 'packageVersion', 'bundlePatch',
  ], 'adaptation source');
  if (!/^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\.git$/u
    .test(recipe.source.repository ?? '') || !SHA40.test(recipe.source.commit ?? '') ||
    !SHA40.test(recipe.source.tree ?? '') || recipe.source.sourceSubdir !== '.' ||
    !SHA256.test(recipe.source.manifestSha256 ?? '') ||
    !PACKAGE.test(recipe.source.packageName ?? '') ||
    !SEMVER.test(recipe.source.packageVersion ?? '') ||
    portablePackagePath(recipe.source.bundlePatch, 'adaptation source.bundlePatch') !==
      recipe.source.bundlePatch) {
    fail('hosted adaptation source authority is malformed');
  }
  exactKeys(recipe.output, [
    'packageName', 'packageVersion', 'description', 'assetName', 'hostEntry',
    'clientEntry', 'bundlePatch', 'clientInject', 'peerDependencies', 'files',
  ], 'adaptation output');
  if (!PACKAGE.test(recipe.output.packageName ?? '') ||
      !SEMVER.test(recipe.output.packageVersion ?? '') ||
      typeof recipe.output.description !== 'string' ||
      recipe.output.description.length < 1 || recipe.output.description.length > 240 ||
      /[\u0000-\u001f\u007f]/u.test(recipe.output.description) ||
      !/^[A-Za-z0-9._-]+\.tgz$/u.test(recipe.output.assetName ?? '') ||
      portablePackagePath(recipe.output.hostEntry, 'adaptation output.hostEntry') !==
        recipe.output.hostEntry ||
      portablePackagePath(recipe.output.clientEntry, 'adaptation output.clientEntry') !==
        recipe.output.clientEntry ||
      !SCRIPT_ENTRY.test(recipe.output.hostEntry) ||
      !SCRIPT_ENTRY.test(recipe.output.clientEntry) ||
      recipe.output.hostEntry === recipe.output.clientEntry ||
      portablePackagePath(recipe.output.bundlePatch, 'adaptation output.bundlePatch') !==
        recipe.output.bundlePatch ||
      recipe.output.bundlePatch !== recipe.source.bundlePatch ||
      !Array.isArray(recipe.output.files) || recipe.output.files.length < 3 ||
      recipe.output.files.length > 64) {
    fail('hosted adaptation output authority is malformed');
  }
  if (recipe.output.clientInject.some((name) =>
    RESERVED_DEPENDENCY_NAMES.has(name) || NODE_BUILTIN_DEPENDENCIES.has(name))) {
    fail('adaptation client inject contains a reserved or Node builtin dependency name');
  }
  uniqueStrings(recipe.output.clientInject, PACKAGE, 'adaptation client inject');
  const peerDependencies = recipe.output.peerDependencies !== null &&
    typeof recipe.output.peerDependencies === 'object' &&
    !Array.isArray(recipe.output.peerDependencies)
    ? Object.assign(Object.create(null), recipe.output.peerDependencies)
    : null;
  if (peerDependencies === null ||
      Object.keys(peerDependencies).length < 1 ||
      Object.keys(peerDependencies).length > 32 ||
      Object.entries(peerDependencies).some(([name, version]) =>
        !PACKAGE.test(name) || !SEMVER.test(version) || BASELINE_ABSENT_PACKAGES.has(name) ||
        RESERVED_DEPENDENCY_NAMES.has(name) || NODE_BUILTIN_DEPENDENCIES.has(name) ||
        (name.startsWith('@deepseek-ai/dsh-') && version !== '0.1.2-alpha.2')) ||
      Object.hasOwn(peerDependencies, recipe.output.packageName) ||
      recipe.output.clientInject.some((name) =>
        !Object.hasOwn(peerDependencies, name))) {
    fail('hosted adaptation peer dependency closure is malformed or not alpha.2-exact');
  }
  recipe.output.files.forEach(validateFile);
  const outputPaths = recipe.output.files.map((file) => file.outputPath);
  const portableOutputPaths = [...outputPaths, 'package.json', 'NOTICE.md', 'SBOM.cdx.json']
    .map((path) => path.toLocaleLowerCase('en-US'));
  if (new Set(portableOutputPaths).size !== portableOutputPaths.length ||
      !outputPaths.includes(recipe.output.hostEntry) ||
      !outputPaths.includes(recipe.output.clientEntry) ||
      !outputPaths.includes(recipe.output.bundlePatch) ||
      !outputPaths.includes(recipe.rights?.licensePath)) {
    fail('hosted adaptation output files are duplicate or omit patch/license');
  }
  assertNoRegularFilePathConflicts(
    [...outputPaths, 'package.json', 'NOTICE.md', 'SBOM.cdx.json']
      .map((name) => ({ name, type: '0' })),
    'hosted adaptation output files'
  );
  exactKeys(recipe.rights, [
    'licenseExpression', 'licensePath', 'licenseSha256', 'copyrightNotice',
    'redistribution',
  ], 'adaptation rights');
  if (!LICENSES.has(recipe.rights.licenseExpression) ||
      portablePackagePath(recipe.rights.licensePath, 'adaptation rights.licensePath') !==
        recipe.rights.licensePath ||
      !SHA256.test(recipe.rights.licenseSha256 ?? '') ||
      typeof recipe.rights.copyrightNotice !== 'string' ||
      recipe.rights.copyrightNotice.length < 1 || recipe.rights.copyrightNotice.length > 300 ||
      /[\u0000-\u001f\u007f]/u.test(recipe.rights.copyrightNotice) ||
      recipe.rights.redistribution !== 'allowed-with-license-and-modification-notice') {
    fail('hosted adaptation rights record is malformed');
  }
  exactKeys(
    recipe.staticPolicy,
    ['computedMembers', 'forbiddenUtf8', 'requiredUtf8'],
    'adaptation static policy'
  );
  uniqueStrings(recipe.staticPolicy.forbiddenUtf8, /^[^\u0000-\u001f\u007f]{1,200}$/u,
    'adaptation forbidden strings');
  uniqueStrings(recipe.staticPolicy.requiredUtf8, /^[^\u0000-\u001f\u007f]{1,200}$/u,
    'adaptation required strings');
  validateComputedMemberAuthority(recipe.staticPolicy.computedMembers);
  exactKeys(
    recipe.runtimeProbe,
    ['contractPath', 'contractSha256', 'requiredAssertions'],
    'adaptation runtime probe'
  );
  if (recipe.runtimeProbe.contractPath !==
        `references/plugin-runtime-probes/${recipe.catalogId}.json` ||
      !SHA256.test(recipe.runtimeProbe.contractSha256 ?? '')) {
    fail('hosted adaptation runtime probe path or digest is malformed');
  }
  uniqueStrings(
    recipe.runtimeProbe.requiredAssertions,
    ASSERTION_ID,
    'adaptation runtime probe assertions'
  );
  return recipe;
}

function runGit(source, args) {
  const result = spawnSync('git', ['-c', 'core.fsmonitor=false', ...args], {
    cwd: source,
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      SystemRoot: process.env.SystemRoot,
      WINDIR: process.env.WINDIR,
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_CONFIG_GLOBAL: process.platform === 'win32' ? 'NUL' : '/dev/null',
      GIT_TERMINAL_PROMPT: '0',
      GIT_OPTIONAL_LOCKS: '0',
      GCM_INTERACTIVE: 'Never',
    },
    maxBuffer: 4 * 1024 * 1024,
    shell: false,
    timeout: 30_000,
    windowsHide: true,
  });
  if (result.status !== 0 || result.error || result.stderr.trim() !== '') {
    fail('hosted adaptation Git identity probe failed');
  }
  return result.stdout.trim();
}

async function canonicalDirectory(input, label) {
  if (!isAbsolute(input)) fail(`${label} must be absolute`);
  const path = resolve(input);
  if (path === parse(path).root) fail(`${label} cannot be a filesystem root`);
  const metadata = await lstat(path);
  if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
    fail(`${label} must be one real directory`);
  }
  return realpath(path);
}

async function readContained(root, path, expectedSha256, label) {
  portablePackagePath(path, `${label} path`);
  let target = root;
  for (const segment of path.split('/')) {
    target = join(target, segment);
    const component = await lstat(target);
    if (component.isSymbolicLink()) fail(`${label} must not traverse a symbolic link`);
  }
  const inside = relative(root, target);
  if (inside.startsWith('..') || isAbsolute(inside)) fail(`${label} escapes its root`);
  const targetReal = await realpath(target);
  const realInside = relative(root, targetReal);
  if (realInside.startsWith('..') || isAbsolute(realInside)) fail(`${label} resolves outside its root`);
  const metadata = await lstat(targetReal);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size < 1 ||
      metadata.size > MAX_FILE_BYTES) {
    fail(`${label} is missing, empty, or too large`);
  }
  const bytes = await readFile(targetReal);
  if (sha256(bytes) !== expectedSha256) fail(`${label} digest mismatch`);
  return bytes;
}

function outputManifest(sourceManifest, recipe, recipeSha256) {
  if (sourceManifest.name !== recipe.source.packageName ||
      sourceManifest.version !== recipe.source.packageVersion ||
      String(sourceManifest.dsh?.bundle?.patch ?? '').replace(/^\.\//u, '') !==
        recipe.source.bundlePatch ||
      sourceManifest.license !== recipe.rights.licenseExpression) {
    fail('upstream manifest identity, patch, or license differs from recipe');
  }
  return {
    name: recipe.output.packageName,
    version: recipe.output.packageVersion,
    description: recipe.output.description,
    license: recipe.rights.licenseExpression,
    type: 'module',
    main: `./${recipe.output.hostEntry}`,
    exports: {
      '.': `./${recipe.output.hostEntry}`,
      './client': `./${recipe.output.clientEntry}`,
      './package.json': './package.json',
    },
    files: [
      ...recipe.output.files.map((file) => file.outputPath),
      'NOTICE.md',
      'SBOM.cdx.json',
    ],
    engines: { node: '>=22.19.0 <23 || >=24.15.0 <25' },
    packageManager: 'pnpm@11.7.0',
    peerDependencies: Object.fromEntries(
      Object.entries(recipe.output.peerDependencies)
        .sort(([left], [right]) => codePointCompare(left, right))
    ),
    repository: {
      type: 'git',
      url: `git+${recipe.source.repository}`,
    },
    dsh: {
      bundle: { patch: `./${recipe.output.bundlePatch}` },
      client: {
        inject: [...recipe.output.clientInject],
        platform: 'web',
      },
    },
    dshThemes: {
      catalogId: recipe.catalogId,
      baseline: structuredClone(recipe.baseline),
      upstream: {
        repository: recipe.source.repository,
        commit: recipe.source.commit,
        tree: recipe.source.tree,
      },
      adaptationRecipeSha256: recipeSha256,
    },
  };
}

function noticeBytes(recipe) {
  return Buffer.from(
    `# Modification notice\n\n` +
    `This package is a DSH Themes hosted alpha.2 adaptation of ` +
    `${recipe.source.packageName}@${recipe.source.packageVersion}.\n\n` +
    `- Upstream: ${recipe.source.repository}\n` +
    `- Commit: ${recipe.source.commit}\n` +
    `- Tree: ${recipe.source.tree}\n` +
    `- License: ${recipe.rights.licenseExpression}\n` +
    `- Copyright: ${recipe.rights.copyrightNotice}\n` +
    `- Baseline: ${recipe.baseline.tag} (${recipe.baseline.commit})\n\n` +
    `DSH Themes changed the package manifest and any files marked as reviewed ` +
    `replacements by the digest-bound build recipe. The original license is ` +
    `included unchanged. This is an experimental source adaptation, not an ` +
    `official DeepSeek binary or upstream release.\n`
  );
}

function purl(name, version) {
  const encoded = name.startsWith('@') ? `%40${name.slice(1)}` : name;
  return `pkg:npm/${encoded}@${version}`;
}

function sbomBytes(recipe, manifestSha256) {
  const reference = purl(recipe.output.packageName, recipe.output.packageVersion);
  const component = {
    type: 'library',
    name: recipe.output.packageName,
    version: recipe.output.packageVersion,
    purl: reference,
    'bom-ref': reference,
    properties: [{
      name: 'dsh-themes:package-manifest-sha256',
      value: manifestSha256,
    }],
    licenses: [{ expression: recipe.rights.licenseExpression }],
    externalReferences: [{ type: 'vcs', url: `${recipe.source.repository}#${recipe.source.commit}` }],
  };
  const dependencies = Object.entries(recipe.output.peerDependencies)
    .sort(([left], [right]) => codePointCompare(left, right))
    .map(([name, version]) => {
      const dependencyReference = purl(name, version);
      return {
        component: {
          type: 'library',
          name,
          version,
          purl: dependencyReference,
          'bom-ref': dependencyReference,
          scope: 'required',
        },
        dependencyReference,
      };
    });
  return canonicalJson({
    bomFormat: 'CycloneDX',
    specVersion: '1.6',
    serialNumber: `urn:uuid:00000000-0000-4000-8000-${sha256(Buffer.from(reference)).slice(0, 12)}`,
    version: 1,
    metadata: { component },
    components: dependencies.map((entry) => entry.component),
    dependencies: [
      { ref: reference, dependsOn: dependencies.map((entry) => entry.dependencyReference) },
      ...dependencies.map((entry) => ({ ref: entry.dependencyReference, dependsOn: [] })),
    ],
  });
}

function writeOctal(header, value, offset, length) {
  const encoded = `${value.toString(8).padStart(length - 1, '0')}\0`;
  header.write(encoded, offset, length, 'ascii');
}

function tarBytes(files) {
  const blocks = [];
  const entries = [...files.entries()].sort(([a], [b]) => codePointCompare(a, b));
  const projectedBytes = entries.reduce((total, [, body]) =>
    total + 512 + body.length + ((512 - (body.length % 512)) % 512), 1024);
  if (!Number.isSafeInteger(projectedBytes) || projectedBytes > MAX_TAR_BYTES) {
    fail('hosted adaptation tar exceeds byte limit');
  }
  for (const [path, body] of entries) {
    const name = `package/${path}`;
    portablePackagePath(path, 'hosted adaptation tar path');
    if (Buffer.byteLength(name) > 99 || !Buffer.isBuffer(body) ||
        body.length < 1 || body.length > MAX_FILE_BYTES) {
      fail('hosted adaptation tar entry is unsafe or too large');
    }
    const header = Buffer.alloc(512);
    header.write(name, 0, 'utf8');
    writeOctal(header, 0o644, 100, 8);
    writeOctal(header, 0, 108, 8);
    writeOctal(header, 0, 116, 8);
    writeOctal(header, body.length, 124, 12);
    writeOctal(header, 0, 136, 12);
    header.fill(0x20, 148, 156);
    header[156] = '0'.charCodeAt(0);
    header.write('ustar\0', 257, 6, 'ascii');
    header.write('00', 263, 2, 'ascii');
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
    blocks.push(header, body, Buffer.alloc((512 - (body.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  const archive = Buffer.concat(blocks);
  if (archive.length !== projectedBytes) fail('hosted adaptation tar size projection mismatch');
  return archive;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function deterministicGzip(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 1 || bytes.length > MAX_TAR_BYTES) {
    fail('deterministic gzip input is empty or too large');
  }
  const chunks = [Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0, 0, 0, 0, 0x00, 0xff])];
  for (let offset = 0; offset < bytes.length;) {
    const length = Math.min(0xffff, bytes.length - offset);
    const final = offset + length === bytes.length;
    const header = Buffer.alloc(5);
    header[0] = final ? 0x01 : 0x00;
    header.writeUInt16LE(length, 1);
    header.writeUInt16LE((~length) & 0xffff, 3);
    chunks.push(header, bytes.subarray(offset, offset + length));
    offset += length;
  }
  const trailer = Buffer.alloc(8);
  trailer.writeUInt32LE(crc32(bytes), 0);
  trailer.writeUInt32LE(bytes.length >>> 0, 4);
  chunks.push(trailer);
  return Buffer.concat(chunks);
}

function assertStaticPolicy(files, recipe) {
  const text = [...files.entries()]
    .filter(([path]) => /\.(?:js|mjs|cjs|json|ya?ml)$/u.test(path))
    .map(([, bytes]) => bytes.toString('utf8'))
    .join('\n');
  for (const value of recipe.staticPolicy.forbiddenUtf8) {
    if (text.includes(value)) fail(`hosted adaptation contains forbidden static signal: ${value}`);
  }
  for (const value of recipe.staticPolicy.requiredUtf8) {
    if (!text.includes(value)) fail(`hosted adaptation omits required static signal: ${value}`);
  }
}

function strictUtf8(bytes, label) {
  if (!Buffer.isBuffer(bytes)) fail(`${label} must be one Buffer`);
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch {
    fail(`${label} is not strict UTF-8 text`);
  }
  if (text.startsWith('\ufeff') || !Buffer.from(text, 'utf8').equals(bytes)) {
    fail(`${label} is not canonical BOM-free UTF-8 text`);
  }
  return text;
}

function syntaxCheckJavaScript(text, label) {
  // --check invokes Node's parser without instantiating or evaluating the candidate module.
  const result = spawnSync(process.execPath, ['--no-warnings', '--input-type=module', '--check'], {
    input: text,
    encoding: 'utf8',
    env: {
      SystemRoot: process.env.SystemRoot,
      WINDIR: process.env.WINDIR,
    },
    maxBuffer: 256 * 1024,
    shell: false,
    timeout: 10_000,
    windowsHide: true,
  });
  if (result.status !== 0 || result.error) {
    fail(`${label} does not parse as safe JavaScript module text`);
  }
}

function javaScriptTokens(source) {
  const tokens = [];
  let offset = 0;

  function push(type, value) {
    tokens.push({ type, value });
  }

  function scanQuoted(quote) {
    const start = ++offset;
    let exact = true;
    while (offset < source.length) {
      const character = source[offset];
      if (character === '\\') {
        exact = false;
        offset += 2;
      } else if (character === quote) {
        push('string', exact ? source.slice(start, offset) : null);
        offset += 1;
        return;
      } else {
        offset += 1;
      }
    }
  }

  function regexCanStart() {
    const previous = tokens.at(-1);
    if (!previous) return true;
    if (previous.type === 'punctuation') {
      return ['(', '[', '{', '=', ',', ':', ';', '!', '&', '|', '?', '+', '-', '*',
        '%', '^', '~', '<', '>'].includes(previous.value);
    }
    return previous.type === 'identifier' && [
      'return', 'case', 'throw', 'else', 'do', 'yield', 'await', 'typeof', 'void',
      'delete', 'in', 'of', 'instanceof', 'new',
    ].includes(previous.value);
  }

  function scanRegex() {
    offset += 1;
    let inClass = false;
    while (offset < source.length) {
      const character = source[offset];
      if (character === '\\') {
        offset += 2;
      } else if (character === '[') {
        inClass = true;
        offset += 1;
      } else if (character === ']' && inClass) {
        inClass = false;
        offset += 1;
      } else if (character === '/' && !inClass) {
        offset += 1;
        while (/[A-Za-z]/u.test(source[offset] ?? '')) offset += 1;
        push('regex', null);
        return;
      } else {
        offset += 1;
      }
    }
  }

  function scanTemplate() {
    offset += 1;
    while (offset < source.length) {
      const character = source[offset];
      if (character === '\\') {
        offset += 2;
      } else if (character === '`') {
        offset += 1;
        push('template', null);
        return;
      } else if (character === '$' && source[offset + 1] === '{') {
        offset += 2;
        scanCode(true);
      } else {
        offset += 1;
      }
    }
  }

  function scanCode(stopAtTemplateBrace = false) {
    let braceDepth = 0;
    while (offset < source.length) {
      const character = source[offset];
      if (stopAtTemplateBrace && character === '}' && braceDepth === 0) {
        offset += 1;
        return;
      }
      if (/\s/u.test(character)) {
        offset += 1;
        continue;
      }
      if (character === '/' && source[offset + 1] === '/') {
        offset += 2;
        while (offset < source.length && !/[\r\n]/u.test(source[offset])) offset += 1;
        continue;
      }
      if (character === '/' && source[offset + 1] === '*') {
        offset += 2;
        const end = source.indexOf('*/', offset);
        offset = end === -1 ? source.length : end + 2;
        continue;
      }
      if (character === '/' && regexCanStart()) {
        scanRegex();
        continue;
      }
      if (character === '\'' || character === '"') {
        scanQuoted(character);
        continue;
      }
      if (character === '`') {
        scanTemplate();
        continue;
      }
      if (/[A-Za-z_$]/u.test(character)) {
        const start = offset;
        offset += 1;
        while (/[A-Za-z0-9_$]/u.test(source[offset] ?? '')) offset += 1;
        push('identifier', source.slice(start, offset));
        continue;
      }
      if (stopAtTemplateBrace && character === '{') braceDepth += 1;
      if (stopAtTemplateBrace && character === '}') braceDepth -= 1;
      push('punctuation', character);
      offset += 1;
    }
  }

  scanCode();
  return tokens;
}

function assertAllowedDependency(specifier, peerDependencies, label) {
  if (typeof specifier !== 'string' || RESERVED_DEPENDENCY_NAMES.has(specifier) ||
      NODE_BUILTIN_DEPENDENCIES.has(specifier) ||
      !Object.hasOwn(peerDependencies, specifier)) {
    fail(`${label} imports or requires a dependency absent from exact peerDependencies`);
  }
}

function walkJavaScript(node, visitor, parent = null, ancestors = []) {
  visitor(node, parent, ancestors);
  const childAncestors = [...ancestors, node];
  for (const key of Object.keys(node)) {
    const value = node[key];
    if (Array.isArray(value)) {
      for (const child of value) {
        if (child !== null && typeof child === 'object' && typeof child.type === 'string') {
          walkJavaScript(child, visitor, node, childAncestors);
        }
      }
    } else if (value !== null && typeof value === 'object' && typeof value.type === 'string') {
      walkJavaScript(value, visitor, node, childAncestors);
    }
  }
}

function directMemberChain(node) {
  if (node?.type === 'Identifier') return [node.name];
  if (node?.type !== 'MemberExpression' || node.computed || node.optional ||
      node.property.type !== 'Identifier') {
    return null;
  }
  const parent = directMemberChain(node.object);
  return parent === null ? null : [...parent, node.property.name];
}

function staticPropertyName(node) {
  if (node?.computed || node?.optional) return null;
  if (node?.property?.type === 'Identifier') return node.property.name;
  if (node?.key?.type === 'Identifier') return node.key.name;
  if (node?.key?.type === 'Literal' && typeof node.key.value === 'string') {
    return node.key.value;
  }
  return null;
}

function isFunctionNode(node) {
  return node?.type === 'ArrowFunctionExpression' ||
    node?.type === 'FunctionExpression' || node?.type === 'FunctionDeclaration';
}

function isLoaderFactoryRequireParameter(node, parent, ancestors) {
  if (!isFunctionNode(parent) || parent.params.length !== 1 || parent.params[0] !== node) {
    return false;
  }
  const property = ancestors.at(-2);
  const object = ancestors.at(-3);
  const call = ancestors.at(-4);
  return property?.type === 'Property' && property.value === parent &&
    staticPropertyName(property) === 'factory' && object?.type === 'ObjectExpression' &&
    call?.type === 'CallExpression' && call.arguments.length === 1 &&
    call.arguments[0] === object && !call.optional &&
    directMemberChain(call.callee)?.join('.') === 'window.__ModuleLoader__.load';
}

function isDirectLiteralRequireIdentifier(node, parent) {
  return parent?.type === 'CallExpression' && parent.callee === node && !parent.optional &&
    parent.arguments.length === 1 && parent.arguments[0]?.type === 'Literal' &&
    typeof parent.arguments[0].value === 'string';
}

function isNullLiteral(node) {
  return node?.type === 'Literal' && node.value === null;
}

function assertExactModuleLoaderFactory(call, label) {
  const descriptor = call.arguments[0];
  if (call.optional || call.arguments.length !== 1 || descriptor?.type !== 'ObjectExpression' ||
      descriptor.properties.some((property) => property.type !== 'Property')) {
    fail(`${label} module loader requires one static descriptor and factory(require)`);
  }
  const factories = descriptor.properties.filter((property) =>
    staticPropertyName(property) === 'factory');
  const factory = factories[0]?.value;
  if (factories.length !== 1 || !isFunctionNode(factory) || factory.params.length !== 1 ||
      factory.params[0]?.type !== 'Identifier' || factory.params[0].name !== 'require') {
    fail(`${label} module loader factory must have the single Identifier parameter require`);
  }
}

function staticStringExpression(node) {
  if (node?.type === 'Literal' && typeof node.value === 'string') return node.value;
  if (node?.type === 'BinaryExpression' && node.operator === '+') {
    const left = staticStringExpression(node.left);
    const right = staticStringExpression(node.right);
    return left === null || right === null ? null : left + right;
  }
  if (node?.type === 'TemplateLiteral') {
    const values = node.expressions.map(staticStringExpression);
    if (values.some((value) => value === null)) return null;
    let result = '';
    for (let index = 0; index < node.quasis.length; index += 1) {
      const cooked = node.quasis[index]?.value?.cooked;
      if (typeof cooked !== 'string') return null;
      result += cooked;
      if (index < values.length) result += values[index];
    }
    return result;
  }
  return null;
}

function assertCssReferenceFree(value, label) {
  if (typeof value === 'string' && FORBIDDEN_CSS_REFERENCE.test(value)) {
    fail(`${label} contains forbidden CSS import or URL reference`);
  }
}

function assertNoExternalCssReferences(text, ast, label) {
  assertCssReferenceFree(text, label);
  walkJavaScript(ast, (node) => {
    if (node.type === 'Literal' && typeof node.value === 'string') {
      assertCssReferenceFree(node.value, label);
    }
    if (node.type === 'TemplateLiteral') {
      const fragments = node.quasis.map((quasi) => quasi.value.cooked);
      if (fragments.some((fragment) => typeof fragment !== 'string')) {
        fail(`${label} contains an undecodable template string`);
      }
      for (const fragment of fragments) assertCssReferenceFree(fragment, label);
      assertCssReferenceFree(fragments.join(''), label);
    }
    if (node.type === 'BinaryExpression' || node.type === 'TemplateLiteral') {
      assertCssReferenceFree(staticStringExpression(node), label);
    }
  });
}

function assertReviewedReactCreateElement(node, label) {
  const element = node.arguments[0];
  const intrinsic = element?.type === 'Literal' && typeof element.value === 'string'
    ? element.value
    : null;
  if (intrinsic === null) {
    if (directMemberChain(element)?.join('.') !== 'React.Fragment') {
      fail(`${label} may only render reviewed React intrinsic tags or React.Fragment`);
    }
  } else if (!REVIEWED_REACT_INTRINSICS.has(intrinsic)) {
    fail(`${label} renders a React intrinsic tag outside the reviewed allowlist`);
  }
  const properties = node.arguments[1];
  if (isNullLiteral(properties)) return;
  if (properties?.type !== 'ObjectExpression') {
    fail(`${label} React properties must be null or one static object`);
  }
  for (const property of properties.properties) {
    if (property.type !== 'Property' || property.computed || property.method ||
        property.kind !== 'init') {
      fail(`${label} React properties must not use spread, computed, method, or accessor keys`);
    }
    const name = staticPropertyName(property);
    if (name === null || !REVIEWED_REACT_PROPERTIES.has(name)) {
      fail(`${label} React property ${name ?? '<dynamic>'} is outside the reviewed allowlist`);
    }
  }
}

function assertStructuredJavaScript(text, recipe, label) {
  syntaxCheckJavaScript(text, label);
  let ast;
  try {
    ast = parseJavaScript(text, {
      allowHashBang: false,
      ecmaVersion: 'latest',
      sourceType: 'module',
    });
  } catch {
    fail(`${label} does not parse into the reviewed JavaScript AST`);
  }
  assertNoExternalCssReferences(text, ast, label);
  const forbiddenIdentifiers = new Set([
    'AsyncFunction', 'AsyncGeneratorFunction', 'Bun', 'Deno', 'EventSource', 'Function',
    'GeneratorFunction', 'Reflect', 'SharedWorker', 'WebAssembly', 'WebSocket', 'Worker',
    'XMLHttpRequest', 'caches', 'eval', 'fetch', 'frames', 'global', 'globalThis',
    'getOwnPropertyDescriptor', 'getOwnPropertyDescriptors', 'importScripts', 'indexedDB',
    'localStorage', 'location', 'navigator', 'parent', 'process', 'self', 'sessionStorage',
    'setInterval', 'setTimeout', 'this', 'top',
  ]);
  const forbiddenProperties = new Set([
    '__proto__', 'constructor', 'cookie', 'dangerouslySetInnerHTML', 'innerHTML',
    'insertAdjacentHTML', 'outerHTML', 'sendBeacon', 'serviceWorker', 'srcdoc',
  ]);
  const forbiddenDomMemberProperties = new Set([
    'action', 'click', 'contentDocument', 'contentWindow', 'defaultView', 'dispatchEvent',
    'formAction', 'frameElement', 'href', 'ownerDocument', 'ping', 'requestSubmit',
    'setAttribute', 'setAttributeNS', 'src', 'srcSet', 'srcdoc', 'srcset', 'submit',
    'toggleAttribute',
  ]);
  const forbiddenIntrospectionProperties = new Set([
    'captureStackTrace', 'getFunction', 'getThis', 'prepareStackTrace', 'stack', 'view',
  ]);
  walkJavaScript(ast, (node, parent, ancestors) => {
    if (node.computed === true) {
      fail(`${label} contains forbidden computed ${node.type}`);
    }
    if (node.type === 'ImportExpression' || node.type === 'MetaProperty') {
      fail(`${label} contains dynamic import or import.meta`);
    }
    if ((node.type === 'ImportDeclaration' || node.type === 'ExportAllDeclaration' ||
        node.type === 'ExportNamedDeclaration') && node.source !== null) {
      assertAllowedDependency(node.source?.value, recipe.output.peerDependencies, label);
    }
    if (node.type === 'ImportSpecifier' && parent?.type === 'ImportDeclaration' &&
        parent.source?.value === 'react' &&
        (node.imported?.name ?? node.imported?.value) === 'createElement') {
      fail(`${label} contains a forbidden named React createElement import`);
    }
    if (node.type === 'ThisExpression') {
      fail(`${label} contains forbidden executable capability this`);
    }
    if (node.type === 'Property' &&
        forbiddenIntrospectionProperties.has(staticPropertyName(node))) {
      fail(`${label} contains forbidden stack or event introspection property`);
    }
    if (node.type === 'Property' && parent?.type === 'ObjectPattern' &&
        staticPropertyName(node) === 'createElement') {
      fail(`${label} contains a forbidden destructured createElement alias`);
    }
    if (node.type === 'Identifier') {
      if (forbiddenIdentifiers.has(node.name) || forbiddenProperties.has(node.name)) {
        fail(`${label} contains forbidden executable capability ${node.name}`);
      }
      if (node.name === 'require' &&
          !isLoaderFactoryRequireParameter(node, parent, ancestors) &&
          !isDirectLiteralRequireIdentifier(node, parent)) {
        fail(`${label} contains non-literal or indirect require`);
      }
      if (node.name === 'window') {
        const allowed = parent?.type === 'MemberExpression' && parent.object === node &&
          !parent.computed && !parent.optional && parent.property?.name === '__ModuleLoader__';
        if (!allowed) fail(`${label} accesses window outside the DSH module loader`);
      }
      if (node.name === 'document') {
        const isTypeofProbe = parent?.type === 'UnaryExpression' && parent.operator === 'typeof';
        const isDirectMember = parent?.type === 'MemberExpression' && parent.object === node &&
          !parent.computed && !parent.optional;
        if (!isTypeofProbe && !isDirectMember) {
          fail(`${label} accesses document outside the reviewed DOM lifecycle surface`);
        }
      }
    }
    if (node.type === 'MemberExpression') {
      const propertyName = node.property.type === 'Identifier' ? node.property.name : null;
      if (propertyName !== null && forbiddenProperties.has(propertyName)) {
        fail(`${label} contains forbidden executable capability ${propertyName}`);
      }
      if (propertyName !== null && (forbiddenDomMemberProperties.has(propertyName) ||
          /^on/u.test(propertyName))) {
        fail(`${label} contains forbidden DOM capability ${propertyName}`);
      }
      if (propertyName !== null && forbiddenIntrospectionProperties.has(propertyName)) {
        fail(`${label} contains forbidden stack or event introspection capability ${propertyName}`);
      }
      const chain = directMemberChain(node);
      if (chain?.[0] === 'window' &&
          !(['window.__ModuleLoader__', 'window.__ModuleLoader__.load'].includes(chain.join('.')))) {
        fail(`${label} accesses window outside the DSH module loader`);
      }
      if (chain?.[0] === 'document') {
        const exact = chain.join('.');
        const directCall = parent?.type === 'CallExpression' && parent.callee === node &&
          !parent.optional;
        const appendReceiver = exact === 'document.head' &&
          parent?.type === 'MemberExpression' && parent.object === node && !parent.computed &&
          !parent.optional && parent.property?.type === 'Identifier' &&
          parent.property.name === 'appendChild';
        const directLifecycleCall = [
          'document.addEventListener', 'document.createElement', 'document.querySelector',
          'document.removeEventListener', 'document.head.appendChild',
        ].includes(exact) && directCall;
        if (!appendReceiver && !directLifecycleCall) {
          fail(`${label} accesses document outside the reviewed DOM lifecycle surface`);
        }
      }
      if (propertyName === 'createElement') {
        const directCall = parent?.type === 'CallExpression' && parent.callee === node &&
          !parent.optional;
        if (!directCall || !['document.createElement', 'React.createElement']
          .includes(chain?.join('.'))) {
          fail(`${label} may only call React.createElement or document.createElement`);
        }
      }
      if (chain?.join('.') === 'document.querySelector' &&
          !(parent?.type === 'CallExpression' && parent.callee === node && !parent.optional)) {
        fail(`${label} may only call document.querySelector in a direct null comparison`);
      }
      if (propertyName === 'appendChild') {
        const directCall = parent?.type === 'CallExpression' && parent.callee === node &&
          !parent.optional;
        if (!directCall || chain?.join('.') !== 'document.head.appendChild') {
          fail(`${label} may only append an owned style to document.head`);
        }
      }
    }
    if (node.type === 'CallExpression') {
      if (node.callee.type === 'Identifier' && node.callee.name === 'require') {
        if (node.optional || node.arguments.length !== 1 ||
            node.arguments[0]?.type !== 'Literal' ||
            typeof node.arguments[0].value !== 'string') {
          fail(`${label} contains non-literal or indirect require`);
        }
        assertAllowedDependency(node.arguments[0].value, recipe.output.peerDependencies, label);
      }
      if (node.callee.type === 'Identifier' &&
          ['appendChild', 'createElement'].includes(node.callee.name)) {
        fail(`${label} contains an indirect DOM construction call`);
      }
      const chain = directMemberChain(node.callee);
      if (chain?.join('.') === 'window.__ModuleLoader__.load') {
        assertExactModuleLoaderFactory(node, label);
      }
      if (chain?.join('.') === 'React.createElement') {
        assertReviewedReactCreateElement(node, label);
      }
      if (chain?.join('.') === 'document.createElement' &&
          (node.arguments.length !== 1 || node.arguments[0]?.type !== 'Literal' ||
            node.arguments[0].value !== 'style')) {
        fail(`${label} may only create an owned style element`);
      }
      if (chain?.join('.') === 'document.querySelector') {
        const comparedDirectly = parent?.type === 'BinaryExpression' &&
          ['===', '!=='].includes(parent.operator) &&
          ((parent.left === node && isNullLiteral(parent.right)) ||
            (parent.right === node && isNullLiteral(parent.left)));
        if (!comparedDirectly) {
          fail(`${label} may only call document.querySelector in a direct null comparison`);
        }
      }
      if (node.callee.type === 'MemberExpression' &&
          staticPropertyName(node.callee) === 'appendChild' &&
          (chain?.join('.') !== 'document.head.appendChild' || node.arguments.length !== 1)) {
        fail(`${label} may only append an owned style to document.head`);
      }
    }
  });
}

export function validateHostedScriptEntries(files, recipe) {
  const scriptTexts = new Map();
  for (const [path, bytes] of files) {
    if (!SCRIPT_ENTRY.test(path)) continue;
    const text = strictUtf8(bytes, `hosted adaptation script ${path}`);
    assertStructuredJavaScript(text, recipe, `hosted adaptation script ${path}`);
    scriptTexts.set(path, text);
  }
  if (!scriptTexts.has(recipe.output.hostEntry) || !scriptTexts.has(recipe.output.clientEntry)) {
    fail('hosted adaptation host/client entries are not safe JavaScript text files');
  }
  return scriptTexts;
}

export async function buildHostedAdaptation({ recipe, recipeBytes, recipeRoot, source }) {
  validateHostedAdaptationRecipe(recipe);
  if (!Buffer.isBuffer(recipeBytes)) fail('hosted adaptation recipe bytes must be one Buffer');
  let recipeFromBytes;
  try {
    recipeFromBytes = validateHostedAdaptationRecipe(JSON.parse(recipeBytes));
  } catch {
    fail('hosted adaptation recipe bytes are invalid');
  }
  if (!canonicalJson(recipeFromBytes).equals(canonicalJson(recipe))) {
    fail('hosted adaptation recipe object differs from its digest-bound bytes');
  }
  const sourceRoot = await canonicalDirectory(source, '--source');
  const replacementRoot = await canonicalDirectory(recipeRoot, '--recipe-root');
  const probeBytes = await readContained(
    replacementRoot,
    recipe.runtimeProbe.contractPath,
    recipe.runtimeProbe.contractSha256,
    'adaptation runtime probe contract'
  );
  let probe;
  try {
    probe = validatePluginRuntimeProbe(JSON.parse(probeBytes));
  } catch (error) {
    fail(`adaptation runtime probe contract is invalid: ${error.message}`);
  }
  if (probe.catalogId !== recipe.catalogId ||
      probe.package.name !== recipe.output.packageName ||
      probe.package.version !== recipe.output.packageVersion ||
      JSON.stringify(probe.assertions.map((assertion) => assertion.id)) !==
        JSON.stringify(recipe.runtimeProbe.requiredAssertions)) {
    fail('adaptation runtime probe identity or assertion order differs from the recipe');
  }
  const identity = runGit(sourceRoot, ['rev-parse', 'HEAD', 'HEAD^{tree}']).split(/\r?\n/u);
  if (identity.length !== 2 || identity[0] !== recipe.source.commit ||
      identity[1] !== recipe.source.tree || runGit(sourceRoot, ['status', '--porcelain=v1']) !== '') {
    fail('hosted adaptation checkout is not the exact clean commit and tree');
  }
  const manifestBytes = await readContained(
    sourceRoot,
    'package.json',
    recipe.source.manifestSha256,
    'upstream package manifest'
  );
  let sourceManifest;
  try {
    sourceManifest = JSON.parse(manifestBytes);
  } catch {
    fail('upstream package manifest is not valid JSON');
  }
  const files = new Map();
  for (const [index, file] of recipe.output.files.entries()) {
    const input = file.input;
    let bytes;
    if (input.kind === 'copy-exact-upstream') {
      bytes = await readContained(
        sourceRoot,
        input.sourcePath,
        input.sha256,
        `adaptation source file ${index}`
      );
    } else {
      await readContained(
        sourceRoot,
        input.sourcePath,
        input.sourceSha256,
        `adaptation replaced source file ${index}`
      );
      bytes = await readContained(
        replacementRoot,
        input.replacementPath,
        input.replacementSha256,
        `adaptation replacement file ${index}`
      );
    }
    files.set(file.outputPath, bytes);
  }
  if (sha256(files.get(recipe.rights.licensePath)) !== recipe.rights.licenseSha256) {
    fail('hosted adaptation does not preserve the authority-bound license bytes');
  }
  const recipeSha256 = sha256(recipeBytes);
  const outputPackage = outputManifest(sourceManifest, recipe, recipeSha256);
  const outputManifestBytes = canonicalJson(outputPackage);
  const outputManifestSha256 = sha256(outputManifestBytes);
  files.set('package.json', outputManifestBytes);
  files.set('NOTICE.md', noticeBytes(recipe));
  files.set('SBOM.cdx.json', sbomBytes(recipe, outputManifestSha256));
  validateHostedScriptEntries(files, recipe);
  assertStaticPolicy(files, recipe);
  const artifact = deterministicGzip(tarBytes(files));
  const inspectedNames = inspectTarEntries(artifact)
    .map((entry) => entry.name)
    .sort(codePointCompare);
  const expectedNames = [...files.keys()]
    .map((path) => `package/${path}`)
    .sort(codePointCompare);
  if (JSON.stringify(inspectedNames) !== JSON.stringify(expectedNames)) {
    fail('hosted adaptation self-inspection found an unexpected archive entry set');
  }
  if (outputPackage.dshThemes.distribution !== undefined ||
      outputPackage.dshThemes.installable !== undefined ||
      outputPackage.dshThemes.runtimeCertified !== undefined) {
    fail('staging package manifest must not claim distribution or runtime authority');
  }
  const artifactSha256 = sha256(artifact);
  const receipt = {
    schemaVersion: 1,
    status: 'hosted-adaptation-built-not-runtime-certified',
    candidateExecuted: false,
    catalogId: recipe.catalogId,
    baseline: structuredClone(recipe.baseline),
    source: {
      repository: recipe.source.repository,
      commit: recipe.source.commit,
      tree: recipe.source.tree,
      manifestSha256: recipe.source.manifestSha256,
    },
    recipeSha256,
    runtimeProbe: {
      contractPath: recipe.runtimeProbe.contractPath,
      contractSha256: recipe.runtimeProbe.contractSha256,
      requiredAssertions: [...recipe.runtimeProbe.requiredAssertions],
      executed: false,
    },
    artifact: {
      assetName: recipe.output.assetName,
      bytes: artifact.length,
      sha256: artifactSha256,
      integrity: `sha256-${Buffer.from(artifactSha256, 'hex').toString('base64')}`,
      packageName: recipe.output.packageName,
      packageVersion: recipe.output.packageVersion,
      manifestSha256: outputManifestSha256,
      licenseSha256: sha256(files.get(recipe.rights.licensePath)),
      noticeSha256: sha256(files.get('NOTICE.md')),
      sbomSha256: sha256(files.get('SBOM.cdx.json')),
    },
    publication: {
      installable: false,
      runtimeCertified: false,
      releaseTag: 'v0.8.0',
    },
  };
  return { artifact, receipt, files };
}

async function writeExclusivePair(firstPath, firstBytes, secondPath, secondBytes) {
  if (!isAbsolute(firstPath) || !isAbsolute(secondPath) || resolve(firstPath) === resolve(secondPath)) {
    fail('output paths must be distinct and absolute');
  }
  const created = [];
  const handles = [];
  let complete = false;
  try {
    for (const [path, bytes] of [[firstPath, firstBytes], [secondPath, secondBytes]]) {
      const handle = await open(path, 'wx', 0o600);
      created.push(path);
      handles.push(handle);
      await handle.writeFile(bytes);
      await handle.sync();
    }
    complete = true;
  } finally {
    await Promise.allSettled(handles.map((handle) => handle.close()));
    if (!complete) {
      await Promise.allSettled(created.map((path) => unlink(path)));
    }
  }
}

function parseArgs(argv) {
  if (argv.length !== 8) {
    fail('usage: build-hosted-adaptation.mjs --id <#3NNN> --source <absolute> --output <absolute.tgz> --receipt <absolute.json>');
  }
  const options = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!['--id', '--source', '--output', '--receipt'].includes(key) ||
        value === undefined || options[key] !== undefined) {
      fail('hosted adaptation arguments are invalid or duplicated');
    }
    options[key] = value;
  }
  if (!/^#3\d{3}$/u.test(options['--id'] ?? '') ||
      !isAbsolute(options['--source'] ?? '') || !isAbsolute(options['--output'] ?? '') ||
      !isAbsolute(options['--receipt'] ?? '')) {
    fail('hosted adaptation requires one exact ID and absolute paths');
  }
  return {
    catalogId: Number(options['--id'].slice(1)),
    source: options['--source'],
    output: options['--output'],
    receipt: options['--receipt'],
  };
}

export async function loadHostedAdaptation(catalogId) {
  const recipeUrl = new URL(`${catalogId}.json`, recipesRoot);
  const recipeBytes = await readFile(recipeUrl);
  const recipe = validateHostedAdaptationRecipe(JSON.parse(recipeBytes));
  if (recipe.catalogId !== catalogId) fail('hosted adaptation recipe ID mismatch');
  return {
    recipe,
    recipeBytes,
    recipeRoot: fileURLToPath(skillRoot),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const context = await loadHostedAdaptation(options.catalogId);
    const result = await buildHostedAdaptation({ ...context, source: options.source });
    if (result.receipt.artifact.assetName !== options.output.split(/[\\/]/u).at(-1)) {
      fail('artifact output filename must match the recipe asset name');
    }
    await writeExclusivePair(
      options.output,
      result.artifact,
      options.receipt,
      canonicalJson(result.receipt)
    );
    process.stdout.write(`${JSON.stringify({
      valid: true,
      candidateExecuted: false,
      catalogId: options.catalogId,
      artifactSha256: result.receipt.artifact.sha256,
      receiptSha256: sha256(canonicalJson(result.receipt)),
    })}\n`);
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
