#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';

const TOKENS = [
  '--dsw-alias-bg-base', '--dsw-alias-bg-layer-1', '--dsw-alias-bg-layer-2', '--dsw-alias-bg-overlay',
  '--dsw-alias-border-l1', '--dsw-alias-border-l2', '--dsw-alias-brand-primary', '--dsw-alias-label-primary',
  '--dsw-alias-label-secondary', '--dsw-alias-state-error-primary', '--dsw-alias-state-success-primary',
  '--dsw-alias-state-warn-primary', '--dsw-specific-sidebar-fill',
];
const COMPATIBILITY = {
  dshPackageVersion: '0.1.0-rc.6',
  dshPackageIntegrity: 'sha512-brpZfED7ieRa2PQ5tUxMhHrM1pb2CmKFVM/f6yMULBDMicahk+Z2OsHgTwTDnoiZm23Ftu9rQz0NN4pflaoJcg==',
  tokenCatalogSha256: 'fe38fdb18dae76f3cc93e3ca3a37bb1916f207180781b1aa8321ee2ddadcb926',
  frontendBundleSha256: 'a40165a9916acf9c5710e440842c9a56bc472ae9991f37f4675a7664ae784d68',
  selectorCatalogSha256: '5bcd9f874095af2114d86f91301868c6b0f2cebe58f51b9919150975d406baa3',
};
const SHA256 = /^[0-9a-f]{64}$/;
const VERSION = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const LICENSE = /^[A-Za-z0-9][A-Za-z0-9.+() -]{0,79}$/;
const SOURCE_REVISION = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const COLOR = /^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/;
const CONTENT_PATH = /^assets\/([a-f0-9]{64})\.webp$/;
const FORBIDDEN = /^(?:scripts?|dependencies|devDependencies|peerDependencies|optionalDependencies|lifecycle|css|html|javascript|code|package|artifact|payload|api[-_]?key|cookie|password|authorization|secret|session|credential|accessToken|refreshToken)$/i;
const MAX_ATTRIBUTION_LENGTH = 256;

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    if (!argv[index]?.startsWith('--') || argv[index + 1] == null) throw new Error('Arguments must be --key value pairs');
    values[argv[index].slice(2)] = argv[index + 1];
  }
  if (!values.manifest || !values.site) throw new Error('Usage: validate-submission.mjs --manifest <absolute-json> --site <https-origin>');
  return values;
}

function inspectKeys(value, path = '$') {
  if (Array.isArray(value)) return value.forEach((item, index) => inspectKeys(item, `${path}[${index}]`));
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN.test(key)) throw new Error(`Forbidden publisher, executable, or secret-like field at ${path}.${key}`);
    inspectKeys(child, `${path}.${key}`);
  }
}

function object(value, label, allowedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  if (allowedKeys) for (const key of Object.keys(value)) if (!allowedKeys.includes(key)) throw new Error(`${label}.${key} is not allowed`);
  return value;
}

function optionalHttps(value, label) {
  if (value == null) return;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`${label} must be a credential-free HTTPS URL`);
}

function rejectLicenseAsNotice(value, label) {
  const url = new URL(value);
  let basename;
  try {
    basename = decodeURIComponent(url.pathname).split('/').filter(Boolean).at(-1) ?? '';
  } catch {
    throw new Error(`${label} has invalid encoding`);
  }
  if (/^licen[cs]e(?:\.|$)/i.test(basename)) {
    throw new Error(`${label} must identify an actual NOTICE, not a LICENSE file`);
  }
}

function localUrl(value, label) {
  if (typeof value !== 'string' || !/^\/(?:api\/theme-studio|__dsh-themes|imgs|theme-packages)\/[A-Za-z0-9][A-Za-z0-9._~!$&'()*+,;=:@%/-]*$/.test(value)) throw new Error(`${label} must be a reviewed same-origin URL`);
  let decoded;
  try { decoded = decodeURIComponent(value); } catch { throw new Error(`${label} has invalid encoding`); }
  if (decoded.split('/').some((part) => part === '.' || part === '..')) throw new Error(`${label} contains path traversal`);
}

function previewUrl(value, label) {
  if (typeof value !== 'string') throw new Error(`${label} must be a URL`);
  if (value.startsWith('/')) localUrl(value, label);
  else optionalHttps(value, label);
}

function ratio(value, label) {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label} must be between 0 and 1`);
}

function focusPercent(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 100) throw new Error(`${label} must be an integer percentage from 0 to 100`);
}

function submissionOrigin(value) {
  const url = new URL(value);
  const local = url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  if (url.protocol !== 'https:' && !local) throw new Error('site must use HTTPS, except localhost development');
  if (url.username || url.password) throw new Error('site URL must not contain credentials');
  url.pathname = '/'; url.search = ''; url.hash = '';
  return url;
}

function validateCompatibility(value) {
  const input = object(value, 'compatibility', [...Object.keys(COMPATIBILITY), 'sourceCommit']);
  if (input.sourceCommit !== undefined) throw new Error('sourceCommit must be omitted unless independently verified');
  for (const [key, expected] of Object.entries(COMPATIBILITY)) if (input[key] !== expected) throw new Error(`compatibility.${key} is not the verified rc.6 value`);
}

function validateLicensePolicy(value, identifier) {
  const policy = object(value, 'licensePolicy', ['url', 'commercialUse', 'attributionRequired', 'shareAlikeRequired']);
  if (typeof policy.url !== 'string') throw new Error('licensePolicy.url is required');
  optionalHttps(policy.url, 'licensePolicy.url');
  if (!['allowed', 'prohibited', 'rights-clearance-required'].includes(policy.commercialUse)) {
    throw new Error('licensePolicy.commercialUse must be allowed, prohibited, or rights-clearance-required');
  }
  if (typeof policy.attributionRequired !== 'boolean' || typeof policy.shareAlikeRequired !== 'boolean') {
    throw new Error('licensePolicy attributionRequired and shareAlikeRequired must be booleans');
  }
  if (/(?:^|-)NC(?:-|$)/i.test(identifier) && policy.commercialUse !== 'prohibited') {
    throw new Error('A noncommercial license must declare commercialUse prohibited');
  }
  if (/(?:^|-)BY(?:-|$)/i.test(identifier) && policy.attributionRequired !== true) {
    throw new Error('An attribution license must declare attributionRequired true');
  }
  if (/(?:^|-)SA(?:-|$)/i.test(identifier) && policy.shareAlikeRequired !== true) {
    throw new Error('A share-alike license must declare shareAlikeRequired true');
  }
  return policy;
}

function validateTokens(value) {
  const input = object(value, 'tokens');
  if (Object.keys(input).length !== TOKENS.length || Object.keys(input).some((name) => !TOKENS.includes(name))) throw new Error('tokens must contain exactly the 13-token catalog');
  for (const name of TOKENS) {
    const pair = object(input[name], name, ['light', 'dark']);
    if (!COLOR.test(pair.light) || !COLOR.test(pair.dark)) throw new Error(`${name} must use 6- or 8-digit hexadecimal colors`);
  }
}

function validatePreviewAsset(value, label) {
  const input = object(value, label, ['url', 'sha256', 'width', 'height', 'source']);
  localUrl(input.url, `${label}.url`);
  if (!SHA256.test(input.sha256)) throw new Error(`${label}.sha256 is invalid`);
  if (!Number.isInteger(input.width) || !Number.isInteger(input.height) || input.width < 1 || input.height < 1 || input.width > 8192 || input.height > 8192) throw new Error(`${label} dimensions are invalid`);
  if (!['simulated', 'runtime'].includes(input.source)) throw new Error(`${label}.source is invalid`);
}

const args = parseArgs(process.argv.slice(2));
if (!isAbsolute(args.manifest)) throw new Error('manifest path must be absolute');
const path = resolve(args.manifest);
const metadata = await stat(path);
if (!metadata.isFile() || metadata.size > 96 * 1024) throw new Error('manifest must be a regular JSON file no larger than 96KB');
const bytes = await readFile(path);
const manifest = JSON.parse(bytes.toString('utf8'));
object(manifest, 'manifest');
inspectKeys(manifest);

const commonKeys = ['schemaVersion', 'kind', 'slug', 'name', 'description', 'category', 'author', 'license', 'licensePolicy', 'version', 'compatibility', 'tokens', 'preview'];
const allowedRoot = manifest.kind === 'full-skin' ? [...commonKeys, 'copyright', 'visual', 'assets'] : commonKeys;
for (const key of Object.keys(manifest)) if (!allowedRoot.includes(key)) throw new Error(`manifest.${key} is not allowed`);
if (manifest.schemaVersion !== '2.0') throw new Error('schemaVersion must equal 2.0');
if (!['theme', 'full-skin'].includes(manifest.kind)) throw new Error('kind must be theme or full-skin');
if (!SLUG.test(manifest.slug) || manifest.slug.length > 64) throw new Error('invalid slug');
if (!VERSION.test(manifest.version)) throw new Error('version must be exact semantic version');
if (
  typeof manifest.license !== 'string' || manifest.license !== manifest.license.trim() ||
  !LICENSE.test(manifest.license)
) throw new Error('license is required and must be a concise SPDX or LicenseRef identifier (maximum 80 characters)');
const licensePolicy = validateLicensePolicy(manifest.licensePolicy, manifest.license);
if (typeof manifest.name !== 'string' || !manifest.name.trim() || typeof manifest.description !== 'string' || !manifest.description.trim()) throw new Error('name and description are required');
if (manifest.category !== undefined && (typeof manifest.category !== 'string' || !manifest.category.trim() || manifest.category.length > 80 || /[\u0000-\u001f\u007f<>]/.test(manifest.category))) throw new Error('category is invalid');
object(manifest.author, 'author', ['name', 'url']);
if (typeof manifest.author.name !== 'string' || !manifest.author.name.trim()) throw new Error('author.name is required');
optionalHttps(manifest.author.url, 'author.url');
validateCompatibility(manifest.compatibility);
validateTokens(manifest.tokens);

let provisionalAssets = false;
if (manifest.kind === 'theme') {
  const preview = object(manifest.preview, 'preview', ['light', 'dark', 'surface']);
  previewUrl(preview.light, 'preview.light'); previewUrl(preview.dark, 'preview.dark');
} else {
  const copyright = object(manifest.copyright, 'copyright', ['source', 'sourceUrl', 'sourceRevision', 'noticeUrl', 'attribution', 'aiGenerated']);
  if (!['original', 'user-owned', 'licensed', 'public-domain', 'generated'].includes(copyright.source) || typeof copyright.aiGenerated !== 'boolean') throw new Error('complete copyright provenance is required');
  optionalHttps(copyright.sourceUrl, 'copyright.sourceUrl');
  optionalHttps(copyright.noticeUrl, 'copyright.noticeUrl');
  if (copyright.noticeUrl) rejectLicenseAsNotice(copyright.noticeUrl, 'copyright.noticeUrl');
  if (
    copyright.attribution !== undefined &&
    (typeof copyright.attribution !== 'string' || copyright.attribution !== copyright.attribution.trim() ||
      !copyright.attribution || copyright.attribution.length > MAX_ATTRIBUTION_LENGTH || /[\u0000-\u001f\u007f<>]/.test(copyright.attribution))
  ) throw new Error('copyright.attribution is invalid');
  if (copyright.source === 'generated' && copyright.aiGenerated !== true) throw new Error('generated art must declare aiGenerated true');
  if (copyright.source === 'licensed' && !copyright.sourceUrl && !copyright.attribution) throw new Error('licensed art requires sourceUrl or attribution');
  if (copyright.sourceRevision !== undefined && !SOURCE_REVISION.test(copyright.sourceRevision)) throw new Error('copyright.sourceRevision must be a lowercase 40- or 64-character revision');
  if (copyright.sourceRevision && !copyright.sourceUrl) throw new Error('copyright.sourceRevision requires sourceUrl');
  if (copyright.sourceRevision) {
    const sourceUrl = new URL(copyright.sourceUrl);
    if (!sourceUrl.pathname.includes(copyright.sourceRevision)) throw new Error('copyright.sourceUrl must contain copyright.sourceRevision');
    if (copyright.noticeUrl) {
      const noticeUrl = new URL(copyright.noticeUrl);
      if (noticeUrl.origin !== sourceUrl.origin || !noticeUrl.pathname.includes(copyright.sourceRevision)) {
        throw new Error('copyright.noticeUrl must share the fixed source origin and revision');
      }
    }
  }
  if (
    copyright.source === 'licensed' && licensePolicy.attributionRequired &&
    (!copyright.attribution || !copyright.noticeUrl)
  ) throw new Error('Attribution-required licensed art requires attribution and noticeUrl');
  const visual = object(manifest.visual, 'visual', ['preset', 'focus', 'surfaceOpacity', 'overlayOpacity', 'borderStrength', 'glowStrength']);
  if (!['glass', 'outline', 'glow'].includes(visual.preset)) throw new Error('invalid visual preset');
  const focus = object(visual.focus, 'visual.focus', ['x', 'y']);
  focusPercent(focus.x, 'visual.focus.x'); focusPercent(focus.y, 'visual.focus.y');
  for (const key of ['surfaceOpacity', 'overlayOpacity', 'borderStrength', 'glowStrength']) ratio(visual[key], `visual.${key}`);

  if (!Array.isArray(manifest.assets) || manifest.assets.length !== 5) throw new Error('full-skin requires exactly five authoring assets');
  const roles = new Set(); const paths = new Set(); const assetsByRole = new Map();
  for (const asset of manifest.assets) {
    const input = object(asset, 'asset', ['role', 'path', 'url', 'sha256', 'mimeType', 'sizeBytes', 'width', 'height']);
    if (!['background', 'sidebar', 'card', 'preview-light', 'preview-dark'].includes(input.role) || roles.has(input.role)) throw new Error('asset roles must be valid and unique');
    roles.add(input.role);
    assetsByRole.set(input.role, input);
    const match = CONTENT_PATH.exec(input.path);
    if (!match || match[1] !== input.sha256 || paths.has(input.path)) throw new Error('asset paths must be unique and content-addressed');
    paths.add(input.path);
    localUrl(input.url, 'asset.url');
    provisionalAssets ||= input.url.startsWith('/api/theme-studio/import/');
    if (input.mimeType !== 'image/webp' || !Number.isInteger(input.sizeBytes) || input.sizeBytes < 1 || input.sizeBytes > 10 * 1024 * 1024) throw new Error('asset MIME, extension, or size is invalid');
    if (!Number.isInteger(input.width) || !Number.isInteger(input.height) || input.width < 1 || input.height < 1 || input.width > 8192 || input.height > 8192 || input.width * input.height > 24_000_000) throw new Error('invalid asset dimensions');
  }
  for (const role of ['background', 'sidebar', 'card', 'preview-light', 'preview-dark']) if (!roles.has(role)) throw new Error(`full-skin is missing the ${role} asset`);
  const preview = object(manifest.preview, 'preview', ['light', 'dark']);
  validatePreviewAsset(preview.light, 'preview.light'); validatePreviewAsset(preview.dark, 'preview.dark');
  if (preview.light.source === 'runtime' || preview.dark.source === 'runtime') throw new Error('authors cannot claim runtime previews before website verification');
  for (const [mode, role] of [['light', 'preview-light'], ['dark', 'preview-dark']]) {
    const asset = assetsByRole.get(role);
    if (
      preview[mode].sha256 !== asset.sha256 || preview[mode].url !== asset.url ||
      preview[mode].width !== asset.width || preview[mode].height !== asset.height
    ) throw new Error(`preview.${mode} metadata must match the ${role} asset`);
  }
}

const site = submissionOrigin(args.site);
const submission = new URL(manifest.kind === 'full-skin' ? '/create' : '/submit', site);
submission.searchParams.set('source', 'dsh-theme-submitter');
submission.searchParams.set('slug', manifest.slug);
process.stdout.write(`${JSON.stringify({
  ready: true, slug: manifest.slug, version: manifest.version, kind: manifest.kind,
  dshPackageVersion: manifest.compatibility.dshPackageVersion,
  manifestSha256: createHash('sha256').update(bytes).digest('hex'),
  provisionalAssets,
  distributionEligibility: licensePolicy.commercialUse === 'allowed'
    ? 'eligible-for-hosted-review'
    : licensePolicy.commercialUse === 'prohibited'
      ? 'external-showcase-only'
      : 'rights-clearance-required',
  submissionUrl: submission.href,
  next: provisionalAssets
    ? 'Sign in, upload the original raster files in Theme Studio, and let the website replace provisional URLs before moderation.'
    : 'Sign in in your browser, review the parsed declaration, and submit it for moderation.',
}, null, 2)}\n`);
