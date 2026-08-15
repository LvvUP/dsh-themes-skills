#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { lstat, readFile, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, resolve, sep } from 'node:path';

import sharp from 'sharp';

const TOKENS = [
  '--dsw-alias-bg-base', '--dsw-alias-bg-layer-1', '--dsw-alias-bg-layer-2', '--dsw-alias-bg-overlay',
  '--dsw-alias-border-l1', '--dsw-alias-border-l2', '--dsw-alias-brand-primary', '--dsw-alias-label-primary',
  '--dsw-alias-label-secondary', '--dsw-alias-state-error-primary', '--dsw-alias-state-success-primary',
  '--dsw-alias-state-warn-primary', '--dsw-specific-sidebar-fill',
];
const ROOT_KEYS = new Set(['schemaVersion', 'kind', 'slug', 'name', 'description', 'category', 'version', 'license', 'licensePolicy', 'author', 'copyright', 'compatibility', 'tokens', 'assets', 'visual', 'preview']);
const FORBIDDEN_KEYS = /^(?:scripts?|dependencies|devDependencies|peerDependencies|optionalDependencies|lifecycle|css|html|javascript|code|package|artifact|payload)$/i;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERSION = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
const LICENSE = /^[A-Za-z0-9][A-Za-z0-9.+() -]{0,79}$/;
const SOURCE_REVISION = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const COLOR = /^#[0-9a-fA-F]{6}(?:[0-9a-fA-F]{2})?$/;
const MIME = new Set(['image/webp']);
const ASSET_ROLE = new Set(['background', 'sidebar', 'card', 'preview-light', 'preview-dark']);
const REQUIRED_ROLES = ['background', 'sidebar', 'card', 'preview-light', 'preview-dark'];
const PRESET = new Set(['glass', 'outline', 'glow']);
const MAX_ASSET_BYTES = 10 * 1024 * 1024;
const MAX_ATTRIBUTION_LENGTH = 256;

const COMPATIBILITY = {
  dshPackageVersion: '0.1.0-rc.6',
  dshPackageIntegrity: 'sha512-brpZfED7ieRa2PQ5tUxMhHrM1pb2CmKFVM/f6yMULBDMicahk+Z2OsHgTwTDnoiZm23Ftu9rQz0NN4pflaoJcg==',
  tokenCatalogSha256: 'fe38fdb18dae76f3cc93e3ca3a37bb1916f207180781b1aa8321ee2ddadcb926',
  frontendBundleSha256: 'a40165a9916acf9c5710e440842c9a56bc472ae9991f37f4675a7664ae784d68',
  selectorCatalogSha256: '5bcd9f874095af2114d86f91301868c6b0f2cebe58f51b9919150975d406baa3',
};

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    if (!argv[index]?.startsWith('--') || argv[index + 1] == null) throw new Error('Arguments must be --key value pairs');
    values[argv[index].slice(2)] = argv[index + 1];
  }
  if (!values.input || !values.output) throw new Error('Usage: create-manifest.mjs --input <absolute-json> --output <new-absolute-json>');
  return values;
}

function object(value, label, allowedKeys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label} must be an object`);
  if (allowedKeys) {
    for (const key of Object.keys(value)) if (!allowedKeys.includes(key)) throw new Error(`${label}.${key} is not allowed`);
  }
  return value;
}

function rejectForbidden(value, path = '$') {
  if (Array.isArray(value)) return value.forEach((item, index) => rejectForbidden(item, `${path}[${index}]`));
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.test(key)) throw new Error(`Forbidden executable or publisher field at ${path}.${key}`);
    rejectForbidden(child, `${path}.${key}`);
  }
}

function text(value, label, max) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f\u007f<>]/.test(value)) throw new Error(`${label} is invalid`);
  return value.trim();
}

function httpsUrl(value, label) {
  if (value == null) return undefined;
  const url = new URL(text(value, label, 2048));
  if (url.protocol !== 'https:' || url.username || url.password) throw new Error(`${label} must be a credential-free HTTPS URL`);
  return url.href;
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

function normalizeLicensePolicy(value, identifier) {
  const policy = object(value, 'licensePolicy', ['url', 'commercialUse', 'attributionRequired', 'shareAlikeRequired']);
  if (typeof policy.url !== 'string') throw new Error('licensePolicy.url is required');
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
  return {
    url: httpsUrl(policy.url, 'licensePolicy.url'),
    commercialUse: policy.commercialUse,
    attributionRequired: policy.attributionRequired,
    shareAlikeRequired: policy.shareAlikeRequired,
  };
}

function previewUrl(value, label) {
  const input = text(value, label, 2048);
  if (input.startsWith('/')) {
    if (!/^\/(?:theme-studio|imgs|theme-packages)\/[A-Za-z0-9][A-Za-z0-9._~!$&'()*+,;=:@%/-]*$/.test(input) || decodeURIComponent(input).split('/').some((part) => part === '..' || part === '.')) throw new Error(`${label} is not a safe local URL`);
    return input;
  }
  return httpsUrl(input, label);
}

function ratio(value, label) {
  if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error(`${label} must be between 0 and 1`);
  return value;
}

function focusPercent(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 100) throw new Error(`${label} must be an integer percentage from 0 to 100`);
  return value;
}

async function decodeWebp(bytes, sourcePath) {
  if (bytes.length > MAX_ASSET_BYTES) throw new Error(`Asset exceeds 10MB: ${sourcePath}`);
  const image = sharp(bytes, {
    animated: true,
    failOn: 'error',
    limitInputPixels: 24_000_000,
    sequentialRead: true,
  });
  let metadata;
  try {
    metadata = await image.metadata();
  } catch {
    throw new Error(`Asset is not a decodable WebP image: ${sourcePath}`);
  }
  const pages = metadata.pages ?? 1;
  if (metadata.format !== 'webp') throw new Error(`Asset is not a WebP image: ${sourcePath}`);
  if (pages !== 1 || metadata.pageHeight !== undefined) {
    throw new Error(`Animated or multi-page WebP assets are not allowed: ${sourcePath}`);
  }
  const { width, height } = metadata;
  if (
    !Number.isInteger(width) || !Number.isInteger(height) ||
    width < 1 || height < 1 || width > 8192 || height > 8192 ||
    width * height > 24_000_000
  ) {
    throw new Error(`Invalid decoded asset dimensions: ${sourcePath}`);
  }
  try {
    const decoded = await image.clone().raw().toBuffer({ resolveWithObject: true });
    if (decoded.info.width !== width || decoded.info.height !== height) {
      throw new Error('decoded dimensions changed');
    }
  } catch {
    throw new Error(`Asset cannot be fully decoded as WebP: ${sourcePath}`);
  }
  return { width, height };
}

async function normalizeAsset(asset, base) {
  object(asset, 'asset', ['role', 'sourcePath', 'mimeType', 'width', 'height']);
  if (!ASSET_ROLE.has(asset.role)) throw new Error(`Unsupported asset role: ${asset.role}`);
  const sourcePath = text(asset.sourcePath, 'asset.sourcePath', 300).replaceAll('\\', '/');
  if (!/^assets\/[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(sourcePath) || sourcePath.includes('..') || sourcePath.includes('//')) throw new Error(`Unsafe asset sourcePath: ${sourcePath}`);
  if (!MIME.has(asset.mimeType)) throw new Error(`Unsupported asset MIME: ${asset.mimeType}`);
  if (!Number.isInteger(asset.width) || !Number.isInteger(asset.height)) throw new Error(`Invalid declared asset dimensions: ${sourcePath}`);
  const resolved = resolve(base, sourcePath);
  if (!resolved.startsWith(`${resolve(base)}${sep}`)) throw new Error(`Asset escapes authoring directory: ${sourcePath}`);
  const metadata = await lstat(resolved);
  if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error(`Asset must be a regular non-symlink file: ${sourcePath}`);
  const actual = await realpath(resolved);
  if (!actual.startsWith(`${await realpath(base)}${sep}`)) throw new Error(`Asset resolves outside authoring directory: ${sourcePath}`);
  if (metadata.size > MAX_ASSET_BYTES) throw new Error(`Asset exceeds 10MB: ${sourcePath}`);
  const bytes = await readFile(actual);
  const decoded = await decodeWebp(bytes, sourcePath);
  if (asset.width !== decoded.width || asset.height !== decoded.height) {
    throw new Error(`Declared asset dimensions do not match decoded WebP: ${sourcePath}`);
  }
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  const fileName = `${sha256}.webp`;
  return {
    role: asset.role,
    path: `assets/${fileName}`,
    url: `/api/theme-studio/import/${fileName}`,
    sha256,
    mimeType: asset.mimeType,
    sizeBytes: bytes.length,
    width: decoded.width,
    height: decoded.height,
  };
}

function normalizeTokens(source) {
  const input = object(source, 'tokens');
  if (Object.keys(input).length !== TOKENS.length || Object.keys(input).some((name) => !TOKENS.includes(name))) throw new Error('tokens must contain exactly the 13-token catalog');
  const output = {};
  for (const name of TOKENS) {
    const pair = object(input[name], name, ['light', 'dark']);
    if (!COLOR.test(pair.light) || !COLOR.test(pair.dark)) throw new Error(`${name} must use 6- or 8-digit hexadecimal colors`);
    output[name] = { light: pair.light.toLowerCase(), dark: pair.dark.toLowerCase() };
  }
  return output;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!isAbsolute(args.input) || !isAbsolute(args.output)) throw new Error('input and output must use absolute paths');
  const source = JSON.parse(await readFile(resolve(args.input), 'utf8'));
  object(source, 'root');
  rejectForbidden(source);
  for (const key of Object.keys(source)) if (!ROOT_KEYS.has(key)) throw new Error(`Unknown root field: ${key}`);
  if (source.schemaVersion !== '2.0') throw new Error('schemaVersion must equal 2.0');
  if (!['theme', 'full-skin'].includes(source.kind)) throw new Error('kind must be theme or full-skin');
  if (!SLUG.test(source.slug) || source.slug.length > 64) throw new Error('slug must be lowercase kebab-case');
  if (!VERSION.test(source.version)) throw new Error('version must be exact semantic version');
  if (typeof source.license !== 'string' || source.license !== source.license.trim() || !LICENSE.test(source.license)) {
    throw new Error('license must be a concise SPDX or LicenseRef identifier');
  }
  const licensePolicy = normalizeLicensePolicy(source.licensePolicy, source.license);
  object(source.compatibility, 'compatibility', ['dshPackageVersion']);
  if (source.compatibility.dshPackageVersion !== '0.1.0-rc.6') throw new Error('Only DSH 0.1.0-rc.6 is verified');
  const author = object(source.author, 'author', ['name', 'url']);
  const common = {
    schemaVersion: '2.0', kind: source.kind, slug: source.slug,
    name: text(source.name, 'name', 120), description: text(source.description, 'description', 1000),
    ...(source.category ? { category: text(source.category, 'category', 80) } : {}),
    author: { name: text(author.name, 'author.name', 100), ...(author.url ? { url: httpsUrl(author.url, 'author.url') } : {}) },
    license: source.license, licensePolicy, version: source.version, compatibility: COMPATIBILITY, tokens: normalizeTokens(source.tokens),
  };

  let manifest;
  if (source.kind === 'theme') {
    if (source.assets || source.visual || source.copyright) throw new Error('theme authoring must not include full-skin fields');
    const preview = object(source.preview, 'preview', ['light', 'dark', 'surface']);
    manifest = {
      ...common,
      preview: {
        light: previewUrl(preview.light, 'preview.light'),
        dark: previewUrl(preview.dark, 'preview.dark'),
        ...(preview.surface ? { surface: text(preview.surface, 'preview.surface', 120) } : {}),
      },
    };
  } else {
    if (source.preview) throw new Error('full-skin preview is derived from local assets');
    const copyright = object(source.copyright, 'copyright', ['source', 'sourceUrl', 'sourceRevision', 'noticeUrl', 'attribution', 'aiGenerated']);
    if (!['original', 'user-owned', 'licensed', 'public-domain', 'generated'].includes(copyright.source) || typeof copyright.aiGenerated !== 'boolean') throw new Error('copyright source and aiGenerated are required');
    if (copyright.source === 'generated' && copyright.aiGenerated !== true) throw new Error('generated art must declare aiGenerated true');
    if (copyright.source === 'licensed' && !copyright.sourceUrl && !copyright.attribution) throw new Error('licensed art requires sourceUrl or attribution');
    if (copyright.sourceRevision !== undefined && !SOURCE_REVISION.test(copyright.sourceRevision)) {
      throw new Error('copyright.sourceRevision must be a lowercase 40- or 64-character revision');
    }
    if (copyright.sourceRevision && !copyright.sourceUrl) throw new Error('copyright.sourceRevision requires sourceUrl');
    if (copyright.sourceRevision) {
      const sourceUrl = new URL(httpsUrl(copyright.sourceUrl, 'copyright.sourceUrl'));
      if (!sourceUrl.pathname.includes(copyright.sourceRevision)) {
        throw new Error('copyright.sourceUrl must contain copyright.sourceRevision');
      }
      if (copyright.noticeUrl) {
        const noticeUrl = new URL(httpsUrl(copyright.noticeUrl, 'copyright.noticeUrl'));
        rejectLicenseAsNotice(noticeUrl.href, 'copyright.noticeUrl');
        if (noticeUrl.origin !== sourceUrl.origin || !noticeUrl.pathname.includes(copyright.sourceRevision)) {
          throw new Error('copyright.noticeUrl must share the fixed source origin and revision');
        }
      }
    }
    if (
      copyright.source === 'licensed' && licensePolicy.attributionRequired &&
      (!copyright.attribution || !copyright.noticeUrl)
    ) {
      throw new Error('Attribution-required licensed art requires attribution and noticeUrl');
    }
    if (copyright.noticeUrl && !copyright.sourceRevision) {
      rejectLicenseAsNotice(
        httpsUrl(copyright.noticeUrl, 'copyright.noticeUrl'),
        'copyright.noticeUrl',
      );
    }
    const sourceAssets = source.assets;
    if (!Array.isArray(sourceAssets) || sourceAssets.length !== 5) throw new Error('full-skin requires the five local asset roles');
    const assets = [];
    for (const asset of sourceAssets) assets.push(await normalizeAsset(asset, dirname(resolve(args.input))));
    const roles = new Set(assets.map((asset) => asset.role));
    if (roles.size !== assets.length) throw new Error('asset roles must be unique');
    for (const role of REQUIRED_ROLES) if (!roles.has(role)) throw new Error(`full-skin is missing the ${role} asset`);
    if (new Set(assets.map((asset) => asset.path)).size !== assets.length) throw new Error('asset contents must be unique');
    assets.sort((left, right) => left.role.localeCompare(right.role));
    const visual = object(source.visual, 'visual', ['preset', 'focus', 'surfaceOpacity', 'overlayOpacity', 'borderStrength', 'glowStrength']);
    if (!PRESET.has(visual.preset)) throw new Error('Unsupported visual preset');
    const focus = object(visual.focus, 'visual.focus', ['x', 'y']);
    const previewLight = assets.find((asset) => asset.role === 'preview-light');
    const previewDark = assets.find((asset) => asset.role === 'preview-dark');
    const previewFrom = (asset) => ({ url: asset.url, sha256: asset.sha256, width: asset.width, height: asset.height, source: 'simulated' });
    manifest = {
      ...common,
      copyright: {
        source: copyright.source,
        ...(copyright.sourceUrl ? { sourceUrl: httpsUrl(copyright.sourceUrl, 'copyright.sourceUrl') } : {}),
        ...(copyright.sourceRevision ? { sourceRevision: copyright.sourceRevision } : {}),
        ...(copyright.noticeUrl ? { noticeUrl: httpsUrl(copyright.noticeUrl, 'copyright.noticeUrl') } : {}),
        ...(copyright.attribution ? { attribution: text(copyright.attribution, 'copyright.attribution', MAX_ATTRIBUTION_LENGTH) } : {}),
        aiGenerated: copyright.aiGenerated,
      },
      visual: {
        preset: visual.preset, focus: { x: focusPercent(focus.x, 'visual.focus.x'), y: focusPercent(focus.y, 'visual.focus.y') },
        surfaceOpacity: ratio(visual.surfaceOpacity, 'visual.surfaceOpacity'), overlayOpacity: ratio(visual.overlayOpacity, 'visual.overlayOpacity'),
        borderStrength: ratio(visual.borderStrength, 'visual.borderStrength'), glowStrength: ratio(visual.glowStrength, 'visual.glowStrength'),
      },
      assets,
      preview: { light: previewFrom(previewLight), dark: previewFrom(previewDark) },
    };
  }

  await writeFile(resolve(args.output), `${JSON.stringify(stable(manifest), null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  process.stdout.write(`${JSON.stringify({ output: resolve(args.output), kind: manifest.kind, assets: manifest.assets?.length ?? 0, dshPackageVersion: COMPATIBILITY.dshPackageVersion, provisionalAssets: manifest.kind === 'full-skin' })}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
