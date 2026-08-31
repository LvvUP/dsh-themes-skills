import { gunzipSync } from 'node:zlib';

const utf8 = new TextDecoder('utf-8', { fatal: true });

const MAX_COMPRESSED_BYTES = 32 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024;
const MAX_ENTRIES = 500;

function fail(message) {
  throw new Error(message);
}

function field(bytes, start, length, label, allowSpacePadding = false) {
  const value = bytes.subarray(start, start + length);
  const nul = value.indexOf(0);
  const body = nul < 0 ? value : value.subarray(0, nul);
  const padding = nul < 0 ? Buffer.alloc(0) : value.subarray(nul + 1);
  if (!padding.every((byte) => byte === 0 || (allowSpacePadding && byte === 0x20))) {
    fail(`archive ${label} contains hidden bytes after NUL padding`);
  }
  try {
    return utf8.decode(body);
  } catch {
    fail(`archive ${label} is not valid UTF-8`);
  }
}

function octal(bytes, start, length, label) {
  const value = field(bytes, start, length, label, true).trim().replace(/^0+/u, '') || '0';
  if (!/^[0-7]+$/u.test(value)) fail(`archive ${label} is not octal`);
  const parsed = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(parsed) || parsed < 0) fail(`archive ${label} is invalid`);
  return parsed;
}

function verifyHeaderChecksum(header) {
  const declared = octal(header, 148, 8, 'header checksum');
  let actual = 0;
  for (let index = 0; index < header.length; index += 1) {
    actual += index >= 148 && index < 156 ? 0x20 : header[index];
  }
  if (declared !== actual) fail('archive header checksum mismatch');
}

function safeEntryPath(name) {
  const parts = name.split('/');
  if (!name || name.length > 512 || name.startsWith('/') || name.startsWith('\\') ||
      name.includes('\\') || /[\u0000-\u001f\u007f:\u2028\u2029]/u.test(name) ||
      parts.some((part) => part === '' || part === '.' || part === '..' ||
        /[. ]$/u.test(part) ||
        /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/iu.test(part))) {
    fail(`archive contains unsafe path ${JSON.stringify(name)}`);
  }
  if (name !== 'package' && !name.startsWith('package/')) {
    fail(`archive entry is outside package/: ${name}`);
  }
}

function assertNoPathConflicts(entries) {
  const normalized = new Map(entries.map((entry) => [
    entry.name.normalize('NFC').toLocaleLowerCase('en-US'),
    entry,
  ]));
  for (const entry of entries) {
    const parts = entry.name.normalize('NFC').toLocaleLowerCase('en-US').split('/');
    for (let length = 1; length < parts.length; length += 1) {
      const ancestor = normalized.get(parts.slice(0, length).join('/'));
      if (ancestor?.type === '0') {
        fail('archive contains a regular-file ancestor/descendant conflict');
      }
    }
  }
}

export function inspectTarEntries(compressed) {
  if (!Buffer.isBuffer(compressed) || compressed.length < 2 ||
      compressed.length > MAX_COMPRESSED_BYTES || compressed[0] !== 0x1f ||
      compressed[1] !== 0x8b) {
    fail('archive compressed size is invalid');
  }
  let tar;
  try {
    tar = gunzipSync(compressed, { maxOutputLength: MAX_UNCOMPRESSED_BYTES });
  } catch (error) {
    throw new Error('archive gzip decoding failed', { cause: error });
  }
  if (tar.length > MAX_UNCOMPRESSED_BYTES || tar.length % 512 !== 0) {
    fail('archive tar size is invalid');
  }
  const entries = [];
  let offset = 0;
  let zeroBlocks = 0;
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) {
      const second = tar.subarray(offset + 512, offset + 1024);
      if (second.length !== 512 || !second.every((byte) => byte === 0)) {
        fail('archive has a zero-block gap before its terminator');
      }
      zeroBlocks = 2;
      offset += 1024;
      break;
    }
    verifyHeaderChecksum(header);
    if (!header.subarray(257, 265).equals(Buffer.from('ustar\0' + '00', 'binary'))) {
      fail('archive header is not canonical POSIX ustar');
    }
    const namePart = field(header, 0, 100, 'entry name');
    const prefix = field(header, 345, 155, 'entry prefix');
    const rawName = prefix ? `${prefix}/${namePart}` : namePart;
    const name = rawName.replace(/\/$/u, '');
    safeEntryPath(name);
    const size = octal(header, 124, 12, 'entry size');
    if (size > MAX_COMPRESSED_BYTES) fail('archive entry is too large');
    const rawType = header[156] === 0 ? '0' : String.fromCharCode(header[156]);
    if (!['0', '5'].includes(rawType)) {
      fail(`archive entry ${name} uses a forbidden link or special type`);
    }
    const type = rawType;
    if (type === '5' && size !== 0) fail(`archive directory ${name} has a body`);
    const bodyStart = offset + 512;
    const bodyEnd = bodyStart + size;
    const paddedEnd = bodyStart + Math.ceil(size / 512) * 512;
    if (bodyEnd > tar.length || paddedEnd > tar.length) fail('archive entry exceeds tar bounds');
    if (!tar.subarray(bodyEnd, paddedEnd).every((byte) => byte === 0)) {
      fail(`archive entry ${name} has non-zero padding`);
    }
    const mode = octal(header, 100, 8, 'entry mode');
    if ((mode & 0o7022) !== 0) fail(`archive entry ${name} uses a dangerous mode`);
    entries.push({
      name,
      type,
      mode,
      size,
      body: Buffer.from(tar.subarray(bodyStart, bodyEnd)),
    });
    if (entries.length > MAX_ENTRIES) fail('archive contains too many entries');
    offset = paddedEnd;
  }
  if (zeroBlocks < 2 || !tar.subarray(offset).every((byte) => byte === 0)) {
    fail('archive has an invalid terminator');
  }
  const names = entries.map((entry) => entry.name);
  if (new Set(names).size !== names.length ||
      names.some((name) => name !== name.normalize('NFC')) ||
      new Set(names.map((name) =>
        name.normalize('NFC').toLocaleLowerCase('en-US'))).size !== names.length) {
    fail('archive contains duplicate or non-portable paths');
  }
  assertNoPathConflicts(entries);
  return entries;
}
