import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const skillRoot = join(repoRoot, 'skills/dsh-community-skin-installer');
const scripts = {
  authority: join(skillRoot, 'scripts/catalog-authority.mjs'),
  fetch: join(skillRoot, 'scripts/fetch-skin-center.mjs'),
  state: join(skillRoot, 'scripts/skin-center-state.mjs'),
  userSkin: join(skillRoot, 'scripts/user-skin.mjs'),
  validate: join(skillRoot, 'scripts/validate-record.mjs'),
};
const catalogPath = join(skillRoot, 'references/community-catalog.json');

function run(script, args, { ok = true } = {}) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (ok) assert.equal(result.status, 0, result.stderr || result.stdout);
  else assert.notEqual(result.status, 0, 'command unexpectedly succeeded');
  return result;
}

async function workspace(t) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-public-community-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function directoryRecord(catalog, skin) {
  const repository = new URL(skin.sourceRepository).pathname.replace(/^\//, '');
  const sourcePackage = skin.slug === 'dsh-deep-whale-maid-atelier'
    ? { name: 'dsh-deep-whale-maid-atelier', version: undefined }
    : skin.installationMode === 'skin-center-builtin'
      ? { name: catalog.skinCenter.packageName, version: catalog.skinCenter.version }
      : { name: `@linxin666/dsh-client-ui-skin-${skin.skinId}`, version: '0.1.18' };
  const licenseSubdir =
    skin.slug !== 'dsh-deep-whale-maid-atelier' &&
    skin.installationMode === 'skin-center-builtin'
      ? 'packages/skins/skin-center/LICENSE'
      : `${skin.sourceSubdir}/LICENSE`;
  return {
    catalogId: skin.catalogId,
    slug: skin.slug,
    kind: 'skin',
    title: skin.slug,
    summary: 'Untrusted display metadata.',
    author: { key: 'test', name: 'Untrusted author metadata' },
    source: {
      repository,
      revision: skin.sourceRevision,
      subdir: skin.sourceSubdir,
      url: `https://github.com/${repository}/tree/${skin.sourceRevision}/${skin.sourceSubdir}`,
      packageName: sourcePackage.name,
      ...(sourcePackage.version ? { packageVersion: sourcePackage.version } : {}),
      evidence: [],
    },
    rights: {
      licenseExpression: skin.directoryLicenseExpression,
      licenseUrl: `https://github.com/${repository}/blob/${skin.sourceRevision}/${licenseSubdir}`,
      status: skin.directoryRightsStatus,
      attributionRequired: true,
      assetDisclosure: 'Untrusted display metadata.',
      trademarkDisclosure: 'Untrusted display metadata.',
    },
    runtime: {
      status: skin.runtimeStatus,
      networkBehavior: 'Untrusted display metadata.',
      riskDisclosure: 'Untrusted display metadata.',
      rollback: 'Untrusted display metadata.',
    },
    distribution: {
      kind: 'external-showcase',
      installability: 'showcase-only',
      consentRequired: true,
    },
    compatibility: {
      status: 'verification-pending',
      baseline: catalog.baseline.dshPackageVersion,
      evidence: [],
    },
    admission: { status: 'published', reviewedAt: '2026-08-20', notes: [] },
    categories: ['test'],
    capabilities: ['appearance'],
    qualitySignals: [],
    previewAssets: [],
    tags: [],
  };
}

test('community installer scripts are syntactically valid', () => {
  for (const script of Object.values(scripts)) {
    const result = spawnSync(process.execPath, ['--check', script], {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
  }
});

test('community authority is self-contained and keeps both RC.8 gates closed', async () => {
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  const authoritySource = await readFile(scripts.authority, 'utf8');
  assert.doesNotMatch(authoritySource, /release-state\.json/);
  assert.deepEqual(catalog.managerGate, {
    certifiedDshPackageVersion: '0.1.0-rc.6',
    targetDshPackageVersion: '0.1.0-rc.8',
    certificationStatus: 'pending',
    installable: false,
  });
  assert.ok(
    catalog.skins.every((skin) => skin.runtimeStatus === 'verification-pending')
  );
});

test('nested directory records inspect successfully while both install gates remain closed', async (t) => {
  const root = await workspace(t);
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  const skin = catalog.skins.find((candidate) => candidate.skinId === 'qq98');
  assert.ok(skin);
  const input = join(root, 'record.json');
  await writeFile(input, `${JSON.stringify(directoryRecord(catalog, skin), null, 2)}\n`, {
    mode: 0o600,
  });

  const inspected = JSON.parse(
    run(scripts.validate, ['--input', input, '--mode', 'inspect']).stdout
  );
  assert.equal(inspected.recordShape, 'directory-v1');
  assert.equal(inspected.installable, false);
  assert.deepEqual(inspected.blockingReasons, [
    'item-runtime-verification-pending',
    'adjacent-manager-rc8-attestation-not-certified',
  ]);

  const blocked = run(
    scripts.validate,
    ['--input', input, '--mode', 'install'],
    { ok: false }
  );
  assert.match(blocked.stderr, /item-runtime-verification-pending/);

  const tampered = directoryRecord(catalog, skin);
  tampered.source.revision = '0'.repeat(40);
  await writeFile(input, `${JSON.stringify(tampered, null, 2)}\n`, { mode: 0o600 });
  const rejected = run(
    scripts.validate,
    ['--input', input, '--mode', 'inspect'],
    { ok: false }
  );
  assert.match(rejected.stderr, /source\.revision does not match/);

  const wrongLicense = directoryRecord(catalog, skin);
  wrongLicense.rights.licenseUrl =
    `https://github.com/zhu1090093659/dsh-web-ui/blob/${skin.sourceRevision}/README.md`;
  await writeFile(input, `${JSON.stringify(wrongLicense, null, 2)}\n`, {
    mode: 0o600,
  });
  assert.match(
    run(scripts.validate, ['--input', input, '--mode', 'inspect'], {
      ok: false,
    }).stderr,
    /rights\.licenseUrl does not contain the allowlisted sourceSubdir/
  );
});

test('direct CSS adaptation installation is script-gated before touching the profile', async (t) => {
  const root = await workspace(t);
  const dshHome = join(root, 'profile');
  await mkdir(dshHome);
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  const skin = catalog.skins.find((candidate) => candidate.skinId === 'qq98');
  const input = join(root, 'record.json');
  await writeFile(input, `${JSON.stringify(directoryRecord(catalog, skin), null, 2)}\n`, {
    mode: 0o600,
  });

  const missingRecord = run(
    scripts.userSkin,
    ['install', '--id', 'qq98', '--dsh-home', dshHome],
    { ok: false }
  );
  assert.match(missingRecord.stderr, /install requires --record/);

  const pending = run(
    scripts.userSkin,
    ['install', '--id', 'qq98', '--dsh-home', dshHome, '--record', input],
    { ok: false }
  );
  assert.match(pending.stderr, /Installation is blocked/);
  await assert.rejects(access(join(dshHome, 'skins')), /ENOENT/);

  const before = JSON.parse(
    run(scripts.userSkin, ['inspect', '--id', 'qq98', '--dsh-home', dshHome]).stdout
  );
  assert.equal(before.installed, false);
});

test('Skin Center state accepts only the exact standalone 0.2.5 dependency', async (t) => {
  const root = await workspace(t);
  const input = join(root, 'plugins.json');
  const writePlugins = (dependencies) =>
    writeFile(
      input,
      `${JSON.stringify([{ name: 'dsh-profile-web', dependencies }], null, 2)}\n`,
      { mode: 0o600 }
    );

  await writePlugins({});
  assert.equal(JSON.parse(run(scripts.state, ['--input', input]).stdout).installed, false);
  await writePlugins({ '@linxin666/dsh-client-ui-skin-center': '0.2.5' });
  assert.equal(JSON.parse(run(scripts.state, ['--input', input]).stdout).version, '0.2.5');
  await writePlugins({ '@linxin666/dsh-client-ui-skin-center': '^0.2.5' });
  assert.match(
    run(scripts.state, ['--input', input], { ok: false }).stderr,
    /must be exact 0\.2\.5/
  );
  await writePlugins({ '@linxin666/dsh-skins': '0.1.18' });
  assert.match(
    run(scripts.state, ['--input', input], { ok: false }).stderr,
    /Legacy aggregate is a direct dependency/
  );
});

test('artifact fetcher rejects relative output before network access', () => {
  const result = run(scripts.fetch, ['--output', 'skin-center.tgz'], { ok: false });
  assert.match(result.stderr, /--output must be absolute/);
});

test('Finder and Installer carry byte-identical community authority', async () => {
  const finderAuthority = await readFile(
    resolve('skills/dsh-theme-finder/references/community-authority.json'),
    'utf8'
  );
  assert.equal(finderAuthority, await readFile(catalogPath, 'utf8'));
});
