import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { auditCandidateCheckout } from '../skills/dsh-plugin-installer/scripts/audit-candidate-source.mjs';

async function sourceFixture(t, manifest) {
  const source = await mkdtemp(join(tmpdir(), 'dsh-plugin-source-intake-'));
  t.after(() => rm(source, { recursive: true, force: true }));
  execFileSync('git', ['init', '--quiet'], { cwd: source });
  execFileSync('git', ['config', 'user.email', 'tests@example.invalid'], { cwd: source });
  execFileSync('git', ['config', 'user.name', 'DSH Tests'], { cwd: source });
  await writeFile(join(source, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(join(source, 'LICENSE'), 'Permission is hereby granted.\n');
  await writeFile(join(source, 'cordis.patch.yml'), '- id: example\n  name: example-plugin\n');
  await writeFile(join(source, 'pnpm-lock.yaml'), 'lockfileVersion: \'9.0\'\n');
  execFileSync('git', ['add', '.'], { cwd: source });
  execFileSync('git', ['commit', '--quiet', '-m', 'fixture'], { cwd: source });
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: source, encoding: 'utf8' }).trim();
  return { source, commit };
}

function candidate(commit) {
  return {
    catalogId: 3088,
    slug: 'example-plugin',
    title: 'Example Plugin',
    repository: 'https://github.com/example/example-plugin.git',
    commit,
    licenseExpression: 'MIT',
    licenseEvidencePath: 'LICENSE',
    primaryUseCase: 'build-and-review',
    editorialScore: 80,
    status: 'source-intake-pending',
  };
}

const npmMissing = async () => new Response('not found', { status: 404 });

test('source intake proves a clean exact DSH package without executing candidate code', async (t) => {
  const fixture = await sourceFixture(t, {
    name: 'example-plugin',
    version: '1.2.3',
    scripts: { prepare: 'node build.mjs' },
    dsh: { bundle: { patch: './cordis.patch.yml' }, client: { platform: 'web' } },
  });
  const receipt = await auditCandidateCheckout({
    candidate: candidate(fixture.commit),
    source: fixture.source,
    fetchImpl: npmMissing,
  });
  assert.equal(receipt.status, 'source-intake-audited');
  assert.equal(receipt.candidateExecuted, false);
  assert.equal(receipt.source.commit, fixture.commit);
  assert.match(receipt.source.tree, /^[a-f0-9]{40}$/u);
  assert.match(receipt.source.manifestSha256, /^[a-f0-9]{64}$/u);
  assert.match(receipt.source.licenseSha256, /^[a-f0-9]{64}$/u);
  assert.equal(receipt.source.lockfiles[0].path, 'pnpm-lock.yaml');
  assert.equal(receipt.package.name, 'example-plugin');
  assert.equal(receipt.package.version, '1.2.3');
  assert.equal(receipt.package.bundlePatch, 'cordis.patch.yml');
  assert.equal(receipt.package.lifecycle.hooks.prepare, 'node build.mjs');
  assert.equal(receipt.npm, null);
  assert.match(receipt.review.reasons[0], /fixed Git commit or Release asset/);
  assert.equal(receipt.review.runtimeCertified, false);
  assert.equal(receipt.review.distributionApproved, false);
});

test('source intake rejects a repository root that is not a DSH bundle package', async (t) => {
  const fixture = await sourceFixture(t, {
    name: 'unrelated-root',
    version: '1.0.0',
  });
  const receipt = await auditCandidateCheckout({
    candidate: candidate(fixture.commit),
    source: fixture.source,
    fetchImpl: npmMissing,
  });
  assert.equal(receipt.status, 'source-intake-rejected');
  assert.equal(receipt.candidateExecuted, false);
  assert.equal(receipt.review.replacementRequired, true);
  assert.match(receipt.review.reasons[0], /versioned DSH bundle package/);
});

test('source intake excludes unbindable npm bytes without discarding exact Git source evidence', async (t) => {
  const fixture = await sourceFixture(t, {
    name: 'example-plugin',
    version: '1.2.3',
    dsh: { bundle: { patch: './cordis.patch.yml' }, client: { platform: 'web' } },
  });
  const invalidTarball = Buffer.from('not a tar archive', 'utf8');
  const integrity = `sha512-${createHash('sha512').update(invalidTarball).digest('base64')}`;
  const metadata = Buffer.from(JSON.stringify({
    name: 'example-plugin',
    version: '1.2.3',
    dist: {
      tarball: 'https://registry.npmjs.org/example-plugin/-/example-plugin-1.2.3.tgz',
      integrity,
    },
  }), 'utf8');
  const fetchImpl = async (url) => {
    const body = String(url).endsWith('.tgz') ? invalidTarball : metadata;
    return new Response(body, {
      status: 200,
      headers: { 'content-length': String(body.length) },
    });
  };
  const receipt = await auditCandidateCheckout({
    candidate: candidate(fixture.commit),
    source: fixture.source,
    fetchImpl,
  });
  assert.equal(receipt.status, 'source-intake-audited');
  assert.equal(receipt.npm, null);
  assert.match(receipt.review.reasons[0], /Published npm bytes could not be bound/);
  assert.match(receipt.source.manifestSha256, /^[a-f0-9]{64}$/u);
  assert.equal(receipt.review.replacementRequired, false);
});

test('source intake fails closed when checkout HEAD differs from the fixed candidate commit', async (t) => {
  const fixture = await sourceFixture(t, {
    name: 'example-plugin',
    version: '1.0.0',
    dsh: { bundle: { patch: 'cordis.patch.yml' } },
  });
  await assert.rejects(
    () =>
      auditCandidateCheckout({
        candidate: candidate('a'.repeat(40)),
        source: fixture.source,
        fetchImpl: npmMissing,
      }),
    /does not match the exact intake commit/
  );
});
