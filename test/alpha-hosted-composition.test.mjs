import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
  alphaSha256,
  stableAlphaJson,
  validateAlphaHostedAuthority,
} from '../skills/dsh-theme-manager/scripts/alpha-authority.mjs';

const reference = new URL(
  '../skills/dsh-theme-manager/references/',
  import.meta.url
);
const originalBytes = await readFile(
  new URL('alpha-hosted-runtime-final.json', reference)
);
const original = JSON.parse(originalBytes);
const initialAuthorityBytes = await readFile(
  new URL('alpha-hosted-artifacts-initial.json', reference)
).catch((error) => {
  if (error.code !== 'ENOENT') throw error;
  return readFile(new URL('alpha-hosted-artifacts.json', reference));
});
const initialAuthority = JSON.parse(initialAuthorityBytes);
const refreshIds = [2001, 2004, 2006, 2007, 2030, 2044];

function fixture() {
  // Synthetic receipt mutations exercise validation only; never written as runtime evidence.
  const authority = structuredClone(initialAuthority);
  const refresh = {
    ...original,
    results: original.results
      .filter((item) => refreshIds.includes(item.catalogId))
      .map((item) => ({
        ...structuredClone(item),
        artifactSha256: alphaSha256(`fixture:${item.catalogId}`),
      })),
    indexSha256: 'f'.repeat(64),
  };
  const refreshBytes = Buffer.from(JSON.stringify(refresh));
  authority.schemaVersion = 2;
  authority.retainedPackageCount = 48;
  authority.refreshedPackageCount = 6;
  authority.receiptRegistry = [
    {
      id: 'initial-alpha-54',
      file: 'alpha-hosted-runtime-final.json',
      sha256: alphaSha256(originalBytes),
      indexSha256: original.indexSha256,
      verifiedPackageCount: 54,
    },
    {
      id: 'refresh-20260906-6',
      file: 'alpha-hosted-runtime-refresh-20260906.json',
      sha256: alphaSha256(refreshBytes),
      indexSha256: refresh.indexSha256,
      verifiedPackageCount: 6,
    },
  ];
  for (const entry of authority.entries) {
    const proof = refresh.results.find(
      (item) => item.catalogId === entry.catalogId
    );
    entry.runtimeReceiptId = proof ? 'refresh-20260906-6' : 'initial-alpha-54';
    // Bind retained fixture records to the original archive even after a real refresh is published.
    entry.artifactSha256 =
      proof?.artifactSha256 ??
      original.results.find((item) => item.catalogId === entry.catalogId)
        .artifactSha256;
    if (proof) {
      entry.version = entry.version.replace(/alpha\.1$/, 'alpha.2');
      const manifest = entry.releaseRecord.manifest;
      manifest.version = entry.version;
      manifest.artifact.version = entry.version;
      manifest.artifact.sha256 = entry.artifactSha256;
      manifest.artifact.fileName = `${entry.slug}-${entry.version}.tgz`;
      manifest.artifact.integrity = `sha256-${Buffer.from(entry.artifactSha256, 'hex').toString('base64')}`;
      manifest.payload.fileName = `${entry.slug}-${entry.version}.payload.tar`;
      entry.releaseRecord.artifactSha256 = entry.artifactSha256;
      entry.releaseRecord.artifactUrl = `https://dsh-themes.com/api/themes/${entry.slug}/download/${entry.version}`;
      entry.manifestCanonicalSha256 = alphaSha256(stableAlphaJson(manifest));
    }
  }
  const files = new Map([
    ['alpha-hosted-artifacts-initial.json', initialAuthorityBytes],
    ['alpha-hosted-runtime-final.json', originalBytes],
    ['alpha-hosted-runtime-refresh-20260906.json', refreshBytes],
  ]);
  return { authority, files, read: (file) => files.get(file) };
}

test('composed authority uses 48 retained proofs and six exact fresh proofs', () => {
  const f = fixture();
  assert.equal(
    validateAlphaHostedAuthority(f.authority, f.read).entries.length,
    54
  );
});

test('composition rejects old archives relabeled alpha.2 and any change to the other 48 records', () => {
  for (const mutate of [
    (f) => {
      const entry = f.authority.entries.find((item) => item.catalogId === 2001);
      const old = initialAuthority.entries.find(
        (item) => item.catalogId === 2001
      );
      entry.artifactSha256 = old.artifactSha256;
      entry.releaseRecord.artifactSha256 = old.artifactSha256;
      entry.releaseRecord.manifest.artifact.sha256 = old.artifactSha256;
      entry.releaseRecord.manifest.artifact.integrity =
        old.releaseRecord.manifest.artifact.integrity;
      entry.manifestCanonicalSha256 = alphaSha256(
        stableAlphaJson(entry.releaseRecord.manifest)
      );
      const receipt = JSON.parse(
        f.files.get('alpha-hosted-runtime-refresh-20260906.json')
      );
      receipt.results.find((item) => item.catalogId === 2001).artifactSha256 =
        old.artifactSha256;
      const bytes = Buffer.from(JSON.stringify(receipt));
      f.files.set('alpha-hosted-runtime-refresh-20260906.json', bytes);
      f.authority.receiptRegistry[1].sha256 = alphaSha256(bytes);
    },
    (f) => {
      f.authority.entries.find((item) => item.catalogId === 1001).version =
        '99.0.0';
    },
    (f) => {
      f.authority.entries.find((item) => item.catalogId === 1001).kind =
        'full-skin';
    },
    (f) => {
      f.authority.entries.find((item) => item.catalogId === 1001).name =
        'Changed retained name';
    },
    (f) => {
      f.authority.entries.find((item) => item.catalogId === 2001).version =
        '1.1.1-alpha.1';
    },
    (f) => {
      f.authority.entries.find(
        (item) => item.catalogId === 2001
      ).payloadSha256 = 'e'.repeat(64);
    },
    (f) => {
      f.authority.entries.find(
        (item) => item.catalogId === 2001
      ).manifestCanonicalSha256 = 'e'.repeat(64);
    },
    (f) => {
      f.authority.entries.find(
        (item) => item.catalogId === 2001
      ).releaseRecord.manifest.artifact.version = '1.1.1-alpha.1';
    },
    (f) => {
      f.files.set(
        'alpha-hosted-artifacts-initial.json',
        Buffer.from(JSON.stringify({ ...initialAuthority, status: 'pending' }))
      );
    },
  ]) {
    const f = fixture();
    mutate(f);
    assert.throws(() => validateAlphaHostedAuthority(f.authority, f.read));
  }
});

test('composition rejects stale archives, reassigned old IDs, missing receipts and altered historical evidence', () => {
  for (const mutate of [
    (f) => {
      f.authority.entries.find((x) => x.catalogId === 2001).artifactSha256 =
        original.results.find((x) => x.catalogId === 2001).artifactSha256;
    },
    (f) => {
      f.authority.entries.find((x) => x.catalogId === 1001).runtimeReceiptId =
        'refresh-20260906-6';
    },
    (f) => {
      f.authority.receiptRegistry.pop();
    },
    (f) => {
      f.authority.receiptRegistry[0].sha256 = '0'.repeat(64);
    },
    (f) => {
      f.authority.receiptRegistry[1].file = '../outside.json';
    },
    (f) => {
      f.authority.refreshedPackageCount = 54;
    },
  ]) {
    const f = fixture();
    mutate(f);
    assert.throws(() => validateAlphaHostedAuthority(f.authority, f.read));
  }
});

test('rehashed refresh receipts still require every actual lifecycle phase', () => {
  const f = fixture();
  const receipt = JSON.parse(
    f.files.get('alpha-hosted-runtime-refresh-20260906.json')
  );
  receipt.results[0].coldRestart.status = 'pending';
  const bytes = Buffer.from(JSON.stringify(receipt));
  f.files.set('alpha-hosted-runtime-refresh-20260906.json', bytes);
  f.authority.receiptRegistry[1].sha256 = alphaSha256(bytes);
  assert.throws(
    () => validateAlphaHostedAuthority(f.authority, f.read),
    /Missing final lifecycle evidence/
  );
});
