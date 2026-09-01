import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

import { assertBundledCssSafe } from '../skills/dsh-community-skin-installer/scripts/bundled-skin-policy.mjs';

const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const skillRoot = join(repoRoot, 'skills/dsh-community-skin-installer');
const scripts = {
  authority: join(skillRoot, 'scripts/catalog-authority.mjs'),
  alpha2Authority: join(
    skillRoot,
    'scripts/alpha2-recertification-authority.mjs'
  ),
  alpha2Validate: join(
    skillRoot,
    'scripts/validate-alpha2-recertification.mjs'
  ),
  fetch: join(skillRoot, 'scripts/fetch-skin-center.mjs'),
  inspectBaseline: join(skillRoot, 'scripts/inspect-baseline.mjs'),
  state: join(skillRoot, 'scripts/skin-center-state.mjs'),
  userSkin: join(skillRoot, 'scripts/user-skin.mjs'),
  validate: join(skillRoot, 'scripts/validate-record.mjs'),
};
const catalogPath = join(skillRoot, 'references/community-catalog.json');
const alpha2RecertificationPath = join(
  skillRoot,
  'references/alpha2-recertification.json'
);
const alpha2RecertificationSchemaPath = join(
  skillRoot,
  'references/alpha2-recertification.schema.json'
);
const alpha1HistoricalPath = join(
  skillRoot,
  'references/alpha1-recertification.json'
);
const baselinePolicyPath = join(
  skillRoot,
  'references/baseline-policy.json'
);
const rc8RuntimeReceiptPath = join(
  skillRoot,
  'references/runtime-receipt.rc8.json'
);

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

function directoryRecord(catalog, current, skin) {
  const currentItem = current.items.find(
    (item) => item.catalogId === skin.catalogId && item.slug === skin.slug
  );
  assert.ok(currentItem);
  const verified = currentItem.status === 'runtime-verified';
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
      ...(skin.noticeRequired && skin.slug === 'dsh-deep-whale-maid-atelier'
        ? {
            noticeUrl: `https://github.com/${repository}/blob/${skin.sourceRevision}/${skin.sourceSubdir}/NOTICE`,
          }
        : {}),
      status: skin.directoryRightsStatus,
      attributionRequired: true,
      assetDisclosure: 'Untrusted display metadata.',
      trademarkDisclosure: 'Untrusted display metadata.',
    },
    runtime: {
      status: currentItem.status,
      networkBehavior: 'Untrusted display metadata.',
      riskDisclosure: 'Untrusted display metadata.',
      rollback: 'Untrusted display metadata.',
    },
    distribution: {
      kind: verified ? 'external-runtime-verified' : 'external-showcase',
      installability: verified ? 'community-installer' : 'showcase-only',
      consentRequired: true,
    },
    compatibility: {
      status: verified ? 'verified' : 'verification-pending',
      baseline: current.baseline.dshPackageVersion,
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

test('alpha.2 authority, schema, shared Harness binding, and six planned guards are exact', async () => {
  const authorityBytes = await readFile(alpha2RecertificationPath);
  const schemaBytes = await readFile(alpha2RecertificationSchemaPath);
  assert.equal(
    createHash('sha256').update(authorityBytes).digest('hex'),
    'c1456b221050479e70ee74e7eab5422414a1fe9043f6c63e5d91a194d80e06b8'
  );
  assert.equal(
    createHash('sha256').update(schemaBytes).digest('hex'),
    'ff4ba6954be7213d6ea14804ca67408b14af367ea54834684a6a4d93429d1103'
  );
  const validated = JSON.parse(run(scripts.alpha2Validate, []).stdout);
  assert.equal(
    validated.baselineId,
    'deepseek-harness/dsh-v0.1.2-alpha.2@0a53fb55bea101816fa226bb964ae2bed71c343b'
  );
  assert.equal(validated.requiredItems, 11);
  assert.equal(validated.requiredTasks, 66);
  assert.equal(validated.completedTasks, 0);
  assert.equal(validated.installable, false);
  assert.equal(validated.publicationAllowed, false);
  assert.equal(validated.runtimeExecuted, false);
  assert.equal(validated.receiptProduced, false);
  for (const target of ['darwin-arm64', 'linux-x64', 'win32-x64']) {
    for (const nodeVersion of ['22.19.0', '24.15.0']) {
      const guarded = JSON.parse(
        run(scripts.alpha2Validate, [
          '--planned-target',
          target,
          '--node-version',
          nodeVersion,
        ]).stdout
      );
      assert.equal(guarded.validationMode, 'planned-matrix-static-guard');
      assert.equal(guarded.plannedTarget, target);
      assert.equal(guarded.nodeVersion, nodeVersion);
      assert.equal(guarded.runtimeExecuted, false);
      assert.equal(guarded.receiptProduced, false);
    }
  }
  assert.match(
    run(
      scripts.alpha2Validate,
      ['--planned-target', 'darwin-x64', '--node-version', '22.19.0'],
      { ok: false }
    ).stderr,
    /target must be darwin-arm64, linux-x64, or win32-x64/
  );
  const workflow = await readFile(
    resolve('.github/workflows/alpha2-community-skin-recertification.yml'),
    'utf8'
  );
  assert.match(workflow, /pending-authority guard/);
  assert.match(workflow, /runtimeExecuted!==false/);
  assert.match(workflow, /receiptProduced!==false/);
  assert.doesNotMatch(workflow, /actions\/upload-artifact/);
  assert.doesNotMatch(workflow, /runtime-certification\.mjs run-task/);
});

test('community authority preserves alpha.1 and RC.8 history but closes the alpha.2 gate', async () => {
  const catalogBytes = await readFile(catalogPath);
  const rc8ReceiptBytes = await readFile(rc8RuntimeReceiptPath);
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const current = JSON.parse(
    await readFile(alpha2RecertificationPath, 'utf8')
  );
  const alpha1Bytes = await readFile(alpha1HistoricalPath);
  const policy = JSON.parse(await readFile(baselinePolicyPath, 'utf8'));
  const authoritySource = await readFile(scripts.authority, 'utf8');
  assert.doesNotMatch(authoritySource, /release-state\.json/);
  assert.equal(policy.defaultOperationalLane, 'currentAlpha2');
  assert.equal(policy.currentAlpha2.installable, false);
  assert.equal(policy.currentAlpha2.websiteDistribution, 'external-showcase');
  assert.equal(policy.currentAlpha2.websiteInstallability, 'showcase-only');
  assert.equal(policy.currentAlpha2.websiteCompatibility, 'verification-pending');
  assert.equal(policy.currentAlpha2.communityTasksRequired, 66);
  assert.equal(policy.currentAlpha2.communityTasksCompleted, 0);
  assert.equal(current.baseline.dshPackageVersion, '0.1.2-alpha.2');
  assert.equal(current.baseline.officialTag, 'dsh-v0.1.2-alpha.2');
  assert.equal(
    current.baseline.sourceCommit,
    '0a53fb55bea101816fa226bb964ae2bed71c343b'
  );
  assert.equal(
    current.baseline.sourceTree,
    '64ccbfa8e0caa4711cd4a75717ef9e022657961b'
  );
  assert.equal(current.gate.requiredItems, 11);
  assert.equal(current.gate.completedItems, 0);
  assert.equal(current.gate.completedTasks, 0);
  assert.equal(current.gate.installable, false);
  assert.equal(current.gate.publicationAllowed, false);
  assert.equal(current.gate.runtimeReceiptSetSha256, null);
  assert.equal(current.gate.rollbackReceiptSetSha256, null);
  assert.ok(
    current.items.every(
      (item) =>
        item.status === 'verification-pending' &&
        item.completedTasks === 0 &&
        item.runtimeReceiptSetSha256 === null &&
        item.rollbackReceiptSetSha256 === null
    )
  );
  assert.equal(
    createHash('sha256').update(alpha1Bytes).digest('hex'),
    '9ecc86474cba557c445ae21b8e479aa3f1b55cb8b2768faa6ed73952cc7b1552'
  );
  assert.equal(policy.currentAlpha1.historicalAtCapture, true);
  assert.equal(policy.currentAlpha1.enabled, false);
  assert.equal(policy.currentAlpha1.mayAuthorizeCurrent, false);
  assert.equal(policy.certified.historicalAtCapture, true);
  assert.equal(policy.certified.installableAtCapture, true);
  assert.equal(policy.certified.installable, false);
  assert.equal(policy.certified.mayAuthorizeCurrent, false);
  assert.equal(
    createHash('sha256').update(catalogBytes).digest('hex'),
    '343000de2be72848db4a7838be90e3c41191f164a5a62d8198d154bfe0aa5d99'
  );
  assert.equal(
    createHash('sha256').update(rc8ReceiptBytes).digest('hex'),
    '89bb10b995e7734b6c13ab7d0027d73440f5d8f40b1f618b3c9adbbe52e1b1a1'
  );
  assert.equal(catalog.managerGate.certifiedDshPackageVersion, '0.1.0-rc.8');
  assert.equal(catalog.managerGate.targetDshPackageVersion, '0.1.0-rc.8');
  assert.equal(
    catalog.managerGate.targetRuntimeAttestationSha256,
    '1cd9a0b4a6b9d215f0a1f70a97b4d43eae7bf4f846ae7009b7ddb812823ca0ae'
  );
  assert.equal(
    catalog.managerGate.runtimeReceiptSha256,
    '89bb10b995e7734b6c13ab7d0027d73440f5d8f40b1f618b3c9adbbe52e1b1a1'
  );
  assert.equal(catalog.managerGate.certificationStatus, 'certified-installable');
  assert.equal(catalog.managerGate.installable, true);
  assert.ok(
    catalog.skins.every((skin) => skin.runtimeStatus === 'runtime-verified')
  );
  assert.equal(catalog.skins.length, 11);
  assert.equal(new Set(catalog.skins.map((skin) => skin.skinId)).size, 11);
  const trading = catalog.skins.find((skin) => skin.skinId === 'trading');
  assert.match(trading.riskDisclosure, /qt\.gtimg\.cn/);
  assert.match(trading.riskDisclosure, /dsh-ticker/);
  assert.match(trading.riskDisclosure, /404/);
});

test('baseline inspector defaults to the alpha.2 0/66 current lane', () => {
  const inspected = JSON.parse(
    run(scripts.inspectBaseline, []).stdout
  );
  assert.equal(inspected.lane, 'currentAlpha2');
  assert.equal(inspected.status, 'alpha2-item-runtime-evidence-pending');
  assert.equal(inspected.dshVersion, '0.1.2-alpha.2');
  assert.equal(inspected.inspectionEnabled, true);
  assert.equal(inspected.installable, false);
  assert.equal(inspected.itemsPlanned, 11);
  assert.equal(inspected.itemsVerified, 0);
  assert.equal(inspected.installableRecords, 0);
  assert.equal(inspected.websiteDistribution, 'external-showcase');
  assert.equal(inspected.websiteInstallability, 'showcase-only');
  assert.equal(inspected.websiteCompatibility, 'verification-pending');
});

test('nested directory records inspect but cannot install before alpha.2 recertification', async (t) => {
  const root = await workspace(t);
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  const current = JSON.parse(
    await readFile(alpha2RecertificationPath, 'utf8')
  );
  const skin = catalog.skins.find((candidate) => candidate.skinId === 'qq98');
  assert.ok(skin);
  const input = join(root, 'record.json');
  await writeFile(
    input,
    `${JSON.stringify(directoryRecord(catalog, current, skin), null, 2)}\n`,
    { mode: 0o600 }
  );

  const inspected = JSON.parse(
    run(scripts.validate, ['--input', input, '--mode', 'inspect']).stdout
  );
  assert.equal(inspected.recordShape, 'directory-v1');
  assert.equal(inspected.installable, false);
  assert.deepEqual(inspected.blockingReasons, [
    'item-runtime-verification-pending',
    'alpha2-recertification-gate-not-certified',
  ]);
  assert.equal(inspected.baseline.dshPackageVersion, '0.1.2-alpha.2');

  const blockedInstall = run(
    scripts.validate,
    ['--input', input, '--mode', 'install'],
    { ok: false }
  );
  assert.match(
    blockedInstall.stderr,
    /alpha2-recertification-gate-not-certified/
  );

  const tampered = directoryRecord(catalog, current, skin);
  tampered.source.revision = '0'.repeat(40);
  await writeFile(input, `${JSON.stringify(tampered, null, 2)}\n`, { mode: 0o600 });
  const rejected = run(
    scripts.validate,
    ['--input', input, '--mode', 'inspect'],
    { ok: false }
  );
  assert.match(rejected.stderr, /source\.revision does not match/);

  const promotedSubstitution = directoryRecord(catalog, current, skin);
  promotedSubstitution.distribution = {
    kind: 'external-runtime-verified',
    installability: 'community-installer',
    consentRequired: true,
  };
  await writeFile(input, `${JSON.stringify(promotedSubstitution, null, 2)}\n`, {
    mode: 0o600,
  });
  assert.match(
    run(scripts.validate, ['--input', input, '--mode', 'install'], {
      ok: false,
    }).stderr,
    /distribution\.kind does not match/
  );

  const wrongLicense = directoryRecord(catalog, current, skin);
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

test('all 11 current website records are showcase-only and reject install mode', async (t) => {
  const root = await workspace(t);
  const input = join(root, 'record.json');
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  const current = JSON.parse(
    await readFile(alpha2RecertificationPath, 'utf8')
  );

  assert.equal(catalog.skins.length, 11);
  for (const skin of catalog.skins) {
    const selected = directoryRecord(catalog, current, skin);
    assert.equal(selected.distribution.kind, 'external-showcase');
    assert.equal(selected.distribution.installability, 'showcase-only');
    assert.equal(selected.runtime.status, 'verification-pending');
    assert.equal(selected.compatibility.status, 'verification-pending');
    assert.equal(selected.compatibility.baseline, '0.1.2-alpha.2');
    assert.equal(Object.hasOwn(selected.distribution, 'artifactUrl'), false);
    assert.equal(Object.hasOwn(selected.distribution, 'installCommand'), false);

    await writeFile(input, `${JSON.stringify(selected, null, 2)}\n`, {
      mode: 0o600,
    });
    const inspected = JSON.parse(
      run(scripts.validate, ['--input', input, '--mode', 'inspect']).stdout
    );
    assert.equal(inspected.skin.catalogId, skin.catalogId);
    assert.equal(inspected.installable, false);
    assert.deepEqual(inspected.blockingReasons, [
      'item-runtime-verification-pending',
      'alpha2-recertification-gate-not-certified',
    ]);

    const rejected = run(
      scripts.validate,
      ['--input', input, '--mode', 'install'],
      { ok: false }
    );
    assert.match(
      rejected.stderr,
      /alpha2-recertification-gate-not-certified/
    );
  }
});

test('direct CSS adaptation installation is blocked before touching the profile', async (t) => {
  const root = await workspace(t);
  const dshHome = join(root, 'profile');
  await mkdir(dshHome);
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  const current = JSON.parse(
    await readFile(alpha2RecertificationPath, 'utf8')
  );
  const skin = catalog.skins.find((candidate) => candidate.skinId === 'qq98');
  const input = join(root, 'record.json');
  await writeFile(
    input,
    `${JSON.stringify(directoryRecord(catalog, current, skin), null, 2)}\n`,
    { mode: 0o600 }
  );

  const missingRecord = run(
    scripts.userSkin,
    ['install', '--id', 'qq98', '--dsh-home', dshHome],
    { ok: false }
  );
  assert.match(missingRecord.stderr, /install requires --record/);

  const blocked = run(
    scripts.userSkin,
    [
      'install',
      '--id',
      'qq98',
      '--dsh-home',
      dshHome,
      '--record',
      input,
    ],
    { ok: false }
  );
  assert.match(blocked.stderr, /alpha2-recertification-gate-not-certified/);
  assert.deepEqual(await readdir(dshHome), []);

  const blockedRemove = run(
    scripts.userSkin,
    ['remove', '--id', 'qq98', '--dsh-home', dshHome],
    { ok: false }
  );
  assert.match(blockedRemove.stderr, /alpha2-recertification-gate-not-certified/);
  assert.deepEqual(await readdir(dshHome), []);
});

test('bundled CSS policy rejects every unbound url spelling', () => {
  assert.doesNotThrow(() => assertBundledCssSafe(':root { color: #123456; }'));
  for (const css of [
    '.x { background: url(//attacker.example/pixel); }',
    '.x { background: URL("https://attacker.example/pixel"); }',
    '.x { background: url(data:text/html,attack); }',
    '.x { background: url(./unbound-local.webp); }',
    '.x { background: u/**/rl(//attacker.example/pixel); }',
  ]) {
    assert.throws(() => assertBundledCssSafe(css), /forbidden unbound url/);
  }
  assert.throws(
    () => assertBundledCssSafe('.x { background: u\\72l(//attacker.example); }'),
    /forbidden CSS escape/
  );
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
  await writeFile(
    input,
    `${JSON.stringify([{ name: 'dsh-profile-web', private: true }], null, 2)}\n`,
    { mode: 0o600 }
  );
  assert.equal(
    JSON.parse(run(scripts.state, ['--input', input]).stdout).installed,
    false
  );
  for (const malformed of [null, [], 'invalid']) {
    await writePlugins(malformed);
    assert.match(
      run(scripts.state, ['--input', input], { ok: false }).stderr,
      /dependencies are missing/
    );
  }
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
  await writePlugins({
    '@linxin666/dsh-skins': '0.1.18',
    '@linxin666/dsh-client-ui-skin-center': '0.2.5',
  });
  assert.match(
    run(scripts.state, ['--input', input], { ok: false }).stderr,
    /Legacy aggregate and standalone Skin Center/
  );
});

test('artifact fetcher rejects relative output before network access', () => {
  const result = run(scripts.fetch, ['--output', 'skin-center.tgz'], { ok: false });
  assert.match(result.stderr, /--output must be absolute/);
});

test('artifact fetcher rejects the pending alpha.2 gate before creating output', async (t) => {
  const root = await workspace(t);
  const output = join(root, 'nested', 'skin-center.tgz');
  const result = run(scripts.fetch, ['--output', output], { ok: false });
  assert.match(result.stderr, /alpha2-recertification-gate-not-certified/);
  assert.equal(
    await readFile(output).then(
      () => true,
      (error) => {
        assert.equal(error.code, 'ENOENT');
        return false;
      }
    ),
    false
  );
  assert.deepEqual(await readdir(root), []);
});

test('Finder and Installer retain byte-identical historical RC.8 identity authority', async () => {
  const finderAuthority = await readFile(
    resolve('skills/dsh-theme-finder/references/community-authority.json'),
    'utf8'
  );
  assert.equal(finderAuthority, await readFile(catalogPath, 'utf8'));
});

test('Finder and Installer carry byte-identical current alpha.2 0/66 authority', async () => {
  const finderAuthority = await readFile(
    resolve(
      'skills/dsh-theme-finder/references/community-alpha2-recertification.json'
    ),
    'utf8'
  );
  assert.equal(
    finderAuthority,
    await readFile(alpha2RecertificationPath, 'utf8')
  );
  assert.equal(
    createHash('sha256').update(finderAuthority).digest('hex'),
    'c1456b221050479e70ee74e7eab5422414a1fe9043f6c63e5d91a194d80e06b8'
  );
});

test('local Installer exposes no promoted alpha.2 item receipt set', async () => {
  const catalog = JSON.parse(await readFile(catalogPath, 'utf8'));
  const current = JSON.parse(
    await readFile(alpha2RecertificationPath, 'utf8')
  );
  assert.equal(catalog.skins.length, 11);
  assert.equal(current.items.length, 11);
  assert.equal(current.gate.completedItems, 0);
  assert.equal(current.gate.runtimeReceiptSetSha256, null);
  assert.equal(current.gate.rollbackReceiptSetSha256, null);
  assert.equal(current.gate.completedTasks, 0);
  assert.equal(current.historicalAuthority.alpha1MayAuthorizeAlpha2, false);
  assert.equal(current.historicalAuthority.rc8MayAuthorizeAlpha2, false);
});
