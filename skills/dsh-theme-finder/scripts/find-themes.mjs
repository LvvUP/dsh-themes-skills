#!/usr/bin/env node

import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, resolve } from 'node:path';

const MAX_BYTES = 2 * 1024 * 1024;
const EXACT_VERSION = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SHA256 = /^[0-9a-f]{64}$/;
const TOKEN_HASH = 'fe38fdb18dae76f3cc93e3ca3a37bb1916f207180781b1aa8321ee2ddadcb926';
const SELECTOR_HASH = '4c04e9fcff6caccd4c76ebc23a4442d4d1443356d9750f7135506d788a3ec7c7';
const DSH_INTEGRITY = 'sha512-brpZfED7ieRa2PQ5tUxMhHrM1pb2CmKFVM/f6yMULBDMicahk+Z2OsHgTwTDnoiZm23Ftu9rQz0NN4pflaoJcg==';
const FRONTEND_SHA256 = 'a40165a9916acf9c5710e440842c9a56bc472ae9991f37f4675a7664ae784d68';

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    if (!argv[index]?.startsWith('--') || argv[index + 1] == null) throw new Error('Arguments must be --key value pairs');
    values[argv[index].slice(2)] = argv[index + 1];
  }
  if (!values.catalog) throw new Error('--catalog is required');
  values['dsh-version'] ??= '0.1.0-rc.6';
  values.limit ??= '10';
  if (values['dsh-version'] !== '0.1.0-rc.6') throw new Error('Only DSH 0.1.0-rc.6 is verified');
  if (values.kind && !['theme', 'full-skin'].includes(values.kind)) throw new Error('--kind must be theme or full-skin');
  if (values.mode && !['light', 'dark'].includes(values.mode)) throw new Error('--mode must be light or dark');
  const limit = Number(values.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error('--limit must be an integer from 1 to 50');
  values.limit = limit;
  return values;
}

async function readCatalog(source) {
  if (!/^https?:\/\//i.test(source)) {
    if (!isAbsolute(source)) throw new Error('Local catalog paths must be absolute');
    const path = resolve(source);
    const metadata = await stat(path);
    if (!metadata.isFile() || metadata.size > MAX_BYTES) throw new Error('Local catalog must be a regular file no larger than 2MB');
    return { payload: JSON.parse(await readFile(path, 'utf8')), origin: null };
  }
  const url = new URL(source);
  if (url.protocol !== 'https:') throw new Error('Remote catalogs must use HTTPS');
  const response = await fetch(url, { redirect: 'follow', credentials: 'omit', signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error(`Catalog request failed with HTTP ${response.status}`);
  if (new URL(response.url).origin !== url.origin) throw new Error('Redirected catalog URL must remain on the trusted origin');
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_BYTES) throw new Error('Catalog exceeds 2MB');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > MAX_BYTES) throw new Error('Catalog exceeds 2MB');
  return { payload: JSON.parse(bytes.toString('utf8')), origin: new URL(response.url).origin };
}

function catalogItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (payload?.code === 0 && Array.isArray(payload?.data?.items)) return payload.data.items;
  throw new Error('Catalog does not contain an items array');
}

function accepted(item, args, catalogOrigin) {
  if (!item || typeof item !== 'object' || item.status !== 'published' || item.verified !== true) return null;
  const kind = item.kind === 'skin' ? 'full-skin' : item.kind;
  if (!SLUG.test(item.slug) || !['theme', 'full-skin'].includes(kind)) return null;
  if (typeof item.name !== 'string' || typeof item.description !== 'string') return null;
  if (!EXACT_VERSION.test(item.version) || item.compatibility?.dshPackageVersion !== args['dsh-version']) return null;
  if (
    item.compatibility?.schemaVersion !== 2 ||
    item.compatibility?.tokenCatalogSha256 !== TOKEN_HASH ||
    item.compatibility?.selectorCatalogSha256 !== SELECTOR_HASH ||
    item.compatibility?.dshPackageIntegrity !== DSH_INTEGRITY ||
    item.compatibility?.frontendBundleSha256 !== FRONTEND_SHA256
  ) return null;
  if (!SHA256.test(item.package?.sha256)) return null;
  const packageName = `@dsh-themes/${item.slug}`;
  if (item.package.name !== undefined && item.package.name !== packageName) return null;
  if (item.package.fileName !== `${item.slug}-${item.version}.tgz`) return null;
  const expectedIntegrity = `sha256-${Buffer.from(item.package.sha256, 'hex').toString('base64')}`;
  if (item.package.integrity !== expectedIntegrity) return null;
  let packageUrl;
  try {
    packageUrl = catalogOrigin ? new URL(item.package.url, catalogOrigin) : new URL(item.package.url);
  } catch {
    return null;
  }
  if (packageUrl.protocol !== 'https:' || packageUrl.username || packageUrl.password) return null;
  const modes = Array.isArray(item.modes) ? [...new Set(item.modes.filter((mode) => mode === 'light' || mode === 'dark'))].sort() : [];
  if (args.kind && kind !== args.kind) return null;
  if (args.mode && !modes.includes(args.mode)) return null;
  const query = (args.query ?? '').trim().toLocaleLowerCase('en-US');
  if (query) {
    const haystack = `${item.name} ${item.slug} ${item.description} ${item.author?.name ?? ''}`.toLocaleLowerCase('en-US');
    if (!query.split(/\s+/).every((word) => haystack.includes(word))) return null;
  }
  return {
    slug: item.slug,
    kind,
    name: item.name.slice(0, 100),
    description: item.description.slice(0, 500),
    author: typeof item.author?.name === 'string' ? { name: item.author.name.slice(0, 100) } : null,
    license: typeof item.license === 'string' ? item.license.slice(0, 64) : null,
    modes,
    version: item.version,
    verified: true,
    compatibility: {
      dshPackageVersion: args['dsh-version'],
      dshPackageIntegrity: DSH_INTEGRITY,
      frontendBundleSha256: FRONTEND_SHA256,
      tokenCatalogSha256: TOKEN_HASH,
      selectorCatalogSha256: SELECTOR_HASH,
    },
    package: { name: packageName, fileName: item.package.fileName, url: packageUrl.href, sha256: item.package.sha256, integrity: item.package.integrity },
  };
}

const args = parseArgs(process.argv.slice(2));
const input = await readCatalog(args.catalog);
const results = catalogItems(input.payload).map((item) => accepted(item, args, input.origin)).filter(Boolean).slice(0, args.limit);
process.stdout.write(`${JSON.stringify({ dshVersion: args['dsh-version'], count: results.length, items: results }, null, 2)}\n`);
