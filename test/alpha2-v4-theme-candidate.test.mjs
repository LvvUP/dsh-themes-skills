import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';

import {
  loadAlpha2V4CandidateAuthority,
  validateAlpha2V4CandidateAuthority,
  validateAlpha2V4Manifest,
} from '../skills/dsh-theme-manager/scripts/alpha2-v4-candidate.mjs';
import { loadCertifiedAuthority } from '../skills/dsh-theme-manager/scripts/baseline-authority.mjs';
import {
  CURRENT_INSTALLABLE_HOSTED_ARTIFACTS,
  LEGACY_ROLLBACK_HOSTED_ARTIFACTS,
} from '../skills/dsh-theme-manager/scripts/hosted-artifact-authority.mjs';
import { CURRENT_INSTALLABLE_ADD_ARTIFACT_SHA256 } from '../skills/dsh-theme-manager/scripts/runner-policy.mjs';
import { validateReleaseRecord } from '../skills/dsh-theme-manager/scripts/validate-release.mjs';
import { run } from './helpers.mjs';

const candidateScript = resolve(
  'skills/dsh-theme-manager/scripts/alpha2-v4-candidate.mjs'
);
const tokenNames = [
  '--dsw-alias-bg-base',
  '--dsw-alias-bg-layer-1',
  '--dsw-alias-bg-layer-2',
  '--dsw-alias-bg-overlay',
  '--dsw-alias-border-l1',
  '--dsw-alias-border-l2',
  '--dsw-alias-brand-primary',
  '--dsw-alias-label-primary',
  '--dsw-alias-label-secondary',
  '--dsw-alias-state-error-primary',
  '--dsw-alias-state-success-primary',
  '--dsw-alias-state-warn-primary',
  '--dsw-specific-sidebar-fill',
];

function integrity(sha256) {
  return `sha256-${Buffer.from(sha256, 'hex').toString('base64')}`;
}

function candidateTheme(loaded) {
  const candidate = loaded.candidates.find((entry) => entry.slug === 'deep-ocean');
  const payloadSha256 = 'a'.repeat(64);
  return {
    schemaVersion: '4.0',
    kind: 'theme',
    slug: candidate.slug,
    name: 'Deep Ocean',
    description: 'Synthetic contract fixture; not candidate bytes.',
    category: 'blue',
    author: { name: 'DSH Themes' },
    license: 'MIT',
    version: candidate.version,
    compatibility: structuredClone(
      loaded.authority.manifestContract.compatibility
    ),
    tokens: Object.fromEntries(
      tokenNames.map((name) => [name, { light: '#112233', dark: '#AABBCC' }])
    ),
    preview: {
      light: '/imgs/themes/deep-ocean-light.png',
      dark: '/imgs/themes/deep-ocean-dark.png',
      surface: 'DeepSeek Harness Web UI',
    },
    artifact: {
      name: '@dsh-themes/deep-ocean',
      version: candidate.version,
      fileName: `deep-ocean-${candidate.version}.tgz`,
      sha256: candidate.artifactSha256,
      integrity: integrity(candidate.artifactSha256),
      digestScope: 'artifact-tgz',
    },
    payload: {
      fileName: `deep-ocean-${candidate.version}.payload.tar`,
      sha256: payloadSha256,
      integrity: integrity(payloadSha256),
      digestScope: 'canonical-tar-payload-excluding-manifest',
    },
  };
}

function candidateFullSkin(loaded) {
  const candidate = loaded.candidates.find(
    (entry) => entry.slug === 'abyssal-maid'
  );
  const payloadSha256 = 'b'.repeat(64);
  const assets = [
    'background',
    'sidebar',
    'card',
    'preview-light',
    'preview-dark',
  ].map((role, index) => {
    const sha256 = String(index + 1).repeat(64);
    return {
      role,
      path: `assets/${sha256}.webp`,
      url: `/__dsh-themes/${candidate.slug}/assets/${sha256}.webp`,
      sha256,
      mimeType: 'image/webp',
      sizeBytes: 1024 + index,
      width: 1440,
      height: 900,
    };
  });
  const previewItem = (role) => {
    const asset = assets.find((entry) => entry.role === role);
    return {
      url: asset.url,
      sha256: asset.sha256,
      width: asset.width,
      height: asset.height,
      source: 'simulated',
    };
  };
  return {
    schemaVersion: '4.0',
    kind: 'full-skin',
    slug: candidate.slug,
    name: 'Abyssal Maid',
    description: 'Synthetic Full Skin fixture; not candidate bytes.',
    category: 'anime-blue',
    author: { name: 'DSH Themes' },
    license: 'MIT',
    version: candidate.version,
    compatibility: structuredClone(
      loaded.authority.manifestContract.compatibility
    ),
    tokens: Object.fromEntries(
      tokenNames.map((name) => [name, { light: '#112233', dark: '#AABBCC' }])
    ),
    preview: {
      light: previewItem('preview-light'),
      dark: previewItem('preview-dark'),
    },
    copyright: {
      source: 'generated',
      attribution: 'Original generated artwork for the synthetic test fixture.',
      aiGenerated: true,
    },
    visual: {
      preset: 'glass',
      focus: { x: 50, y: 50 },
      surfaceOpacity: 0.8,
      overlayOpacity: 0.4,
      borderStrength: 0.5,
      glowStrength: 0.2,
    },
    assets,
    artifact: {
      name: `@dsh-themes/${candidate.slug}`,
      version: candidate.version,
      fileName: `${candidate.slug}-${candidate.version}.tgz`,
      sha256: candidate.artifactSha256,
      integrity: integrity(candidate.artifactSha256),
      digestScope: 'artifact-tgz',
    },
    payload: {
      fileName: `${candidate.slug}-${candidate.version}.payload.tar`,
      sha256: payloadSha256,
      integrity: integrity(payloadSha256),
      digestScope: 'canonical-tar-payload-excluding-manifest',
    },
  };
}

test('alpha.2 V4 authority freezes 54 pending candidates without changing RC.8', async () => {
  const loaded = await loadAlpha2V4CandidateAuthority();
  assert.deepEqual(
    {
      status: loaded.authority.status,
      installable: loaded.authority.installable,
      promotionAllowed: loaded.authority.promotionAllowed,
      candidateCount: loaded.candidates.length,
      themeCount: loaded.candidates.filter((entry) => entry.kind === 'theme')
        .length,
      fullSkinCount: loaded.candidates.filter(
        (entry) => entry.kind === 'full-skin'
      ).length,
      completedJobs: loaded.authority.releaseGate.completedJobs,
      requiredJobs: loaded.authority.releaseGate.requiredJobs,
    },
    {
      status: 'candidate-pending',
      installable: false,
      promotionAllowed: false,
      candidateCount: 54,
      themeCount: 6,
      fullSkinCount: 48,
      completedJobs: 0,
      requiredJobs: 6,
    }
  );

  const certified = await loadCertifiedAuthority();
  assert.equal(certified.version, '0.1.0-rc.8');
  assert.equal(CURRENT_INSTALLABLE_HOSTED_ARTIFACTS.size, 45);
  assert.equal(LEGACY_ROLLBACK_HOSTED_ARTIFACTS.size, 24);
  assert.equal(
    CURRENT_INSTALLABLE_HOSTED_ARTIFACTS.get(
      '@dsh-themes/deep-ocean@1.2.0'
    ),
    '8fca6598f084b47ec07bd00876a686c640ad68f280b5737b789a68fa5df5044f'
  );
  assert.equal(
    loaded.candidates.some((entry) =>
      CURRENT_INSTALLABLE_ADD_ARTIFACT_SHA256.has(entry.artifactSha256)
    ),
    false
  );
});

test('alpha.2 source and official npm evidence stay exact but independent', async () => {
  const { authority } = await loadAlpha2V4CandidateAuthority();
  assert.deepEqual(authority.baseline.provenanceBoundary, {
    officialNpmRuntimeTarget: true,
    sourceCrossBuildIndependent: true,
    sourceCrossBuildIsRuntimeReceipt: false,
    binarySourceEquivalenceClaimed: false,
  });
  assert.equal(authority.baseline.officialSource.tag, 'dsh-v0.1.2-alpha.2');
  assert.equal(
    authority.baseline.officialSource.commitSha1,
    '0a53fb55bea101816fa226bb964ae2bed71c343b'
  );
  assert.equal(
    authority.baseline.officialSource.treeSha1,
    '64ccbfa8e0caa4711cd4a75717ef9e022657961b'
  );
  assert.equal(
    authority.baseline.officialSource.pnpmLockfileSha256,
    '6cc109a574218f51762474455c8d72e5f7c2625aedf25e85569dba1af7adcef0'
  );
  assert.equal(
    authority.baseline.officialNpm.tarballSha256,
    '5bf062a26a490853ffb9294fe3c9fb2047f029be3545612dea45718a81920a47'
  );
});

test('strict V4 contract validates the pending Profile, BrowserAuth, modules, font, and receipt shape', async () => {
  const loaded = await loadAlpha2V4CandidateAuthority();
  const result = validateAlpha2V4Manifest(candidateTheme(loaded), loaded);
  assert.equal(result.status, 'candidate-manifest-validated-not-installable');
  assert.equal(result.installable, false);
  assert.equal(result.promotionAllowed, false);
  assert.equal(result.publicId, '#1001');
  assert.deepEqual(
    loaded.authority.manifestContract.compatibility.ui.fontSizes,
    [12, 14, 17]
  );
  assert.equal(
    loaded.authority.manifestContract.compatibility.clientModules.graphShape,
    'entries+batches'
  );
  assert.equal(
    loaded.authority.manifestContract.compatibility.browserAuth.evidencePolicy,
    'redacted-no-token-cookie-or-derived-digest'
  );
});

test('V4 descriptive fields and HTTPS URLs reject malformed optional values', async () => {
  const loaded = await loadAlpha2V4CandidateAuthority();
  const valid = candidateTheme(loaded);
  valid.author.url = 'https://authors.example/dsh?profile=theme';
  validateAlpha2V4Manifest(valid, loaded);

  const attacks = [
    (manifest) => {
      manifest.category = {};
    },
    (manifest) => {
      manifest.category = '';
    },
    (manifest) => {
      manifest.category = 'x'.repeat(121);
    },
    (manifest) => {
      manifest.author.url = 7;
    },
    (manifest) => {
      manifest.author.url = 'http://authors.example/dsh';
    },
    (manifest) => {
      manifest.author.url = 'https://user:secret@authors.example/dsh';
    },
    (manifest) => {
      manifest.author.url = 'https://authors.example/dsh#profile';
    },
  ];
  for (const attack of attacks) {
    const manifest = candidateTheme(loaded);
    attack(manifest);
    assert.throws(
      () => validateAlpha2V4Manifest(manifest, loaded),
      /alpha\.2 V4 candidate refused/u
    );
  }
});

test('V4 local preview and asset URLs reject authority, delimiter, and traversal confusion', async () => {
  const loaded = await loadAlpha2V4CandidateAuthority();
  const themeAttacks = [
    '//evil.example/x',
    '/imgs/themes\\evil.png',
    '/imgs/themes/deep-ocean.png?mode=dark',
    '/imgs/themes/deep-ocean.png#preview',
    '/imgs/themes/%2e%2e/evil.png',
    '/imgs/themes/../evil.png',
    '/imgs//evil.png',
    '/unapproved/evil.png',
  ];
  for (const value of themeAttacks) {
    const manifest = candidateTheme(loaded);
    manifest.preview.light = value;
    assert.throws(
      () => validateAlpha2V4Manifest(manifest, loaded),
      /alpha\.2 V4 candidate refused/u
    );
  }

  for (const attack of [
    (manifest) => {
      manifest.preview.light.url = '//evil.example/x';
    },
    (manifest) => {
      manifest.preview.dark.url =
        '/__dsh-themes/abyssal-maid/assets/5.webp?download=1';
    },
    (manifest) => {
      manifest.assets[0].url =
        '/__dsh-themes/abyssal-maid/assets/%2e%2e/evil.webp';
    },
    (manifest) => {
      manifest.preview.light.sha256 = '9'.repeat(64);
    },
    (manifest) => {
      manifest.preview.dark.width += 1;
    },
  ]) {
    const manifest = candidateFullSkin(loaded);
    attack(manifest);
    assert.throws(
      () => validateAlpha2V4Manifest(manifest, loaded),
      /alpha\.2 V4 candidate refused/u
    );
  }
});

test('V4 copyright fields enforce HTTPS, attribution, licensed, and generated boundaries', async () => {
  const loaded = await loadAlpha2V4CandidateAuthority();
  validateAlpha2V4Manifest(candidateFullSkin(loaded), loaded);

  const licensedByAttribution = candidateFullSkin(loaded);
  licensedByAttribution.copyright.source = 'licensed';
  licensedByAttribution.copyright.aiGenerated = false;
  licensedByAttribution.copyright.attribution = 'Licensed artwork by Example.';
  validateAlpha2V4Manifest(licensedByAttribution, loaded);

  const licensedByUrl = candidateFullSkin(loaded);
  licensedByUrl.copyright.source = 'licensed';
  licensedByUrl.copyright.aiGenerated = false;
  licensedByUrl.copyright.sourceUrl =
    'https://rights.example/artwork?license=example';
  delete licensedByUrl.copyright.attribution;
  validateAlpha2V4Manifest(licensedByUrl, loaded);

  const attacks = [
    (manifest) => {
      manifest.copyright.sourceUrl = 7;
    },
    (manifest) => {
      manifest.copyright.sourceUrl = 'http://rights.example/artwork';
    },
    (manifest) => {
      manifest.copyright.sourceUrl =
        'https://user:secret@rights.example/artwork';
    },
    (manifest) => {
      manifest.copyright.sourceUrl =
        'https://rights.example/artwork#license';
    },
    (manifest) => {
      manifest.copyright.attribution = {};
    },
    (manifest) => {
      manifest.copyright.attribution = '';
    },
    (manifest) => {
      manifest.copyright.source = 'licensed';
      manifest.copyright.aiGenerated = false;
      delete manifest.copyright.sourceUrl;
      delete manifest.copyright.attribution;
    },
    (manifest) => {
      manifest.copyright.aiGenerated = false;
    },
  ];
  for (const attack of attacks) {
    const manifest = candidateFullSkin(loaded);
    attack(manifest);
    assert.throws(
      () => validateAlpha2V4Manifest(manifest, loaded),
      /alpha\.2 V4 candidate refused/u
    );
  }
});

test('V4 validation fails closed for downgrade, mixed baseline, missing receipt, and fake passing evidence', async () => {
  const loaded = await loadAlpha2V4CandidateAuthority();
  const attacks = [
    (manifest) => {
      manifest.schemaVersion = '3.0';
    },
    (manifest) => {
      manifest.compatibility.source.commitSha1 = '1'.repeat(40);
    },
    (manifest) => {
      manifest.compatibility.dshPackageVersion = '0.1.0-rc.8';
    },
    (manifest) => {
      delete manifest.compatibility.certification.runtimeReceipt;
    },
    (manifest) => {
      const receipt = manifest.compatibility.certification.runtimeReceipt;
      manifest.compatibility.certification.status = 'verified';
      manifest.compatibility.certification.installability = 'manager';
      receipt.status = 'verified';
      receipt.completedJobs = 6;
      receipt.receiptSha256 = '1'.repeat(64);
      receipt.jobs = Array.from({ length: 6 }, () => ({ conclusion: 'success' }));
    },
  ];
  for (const attack of attacks) {
    const manifest = candidateTheme(loaded);
    attack(manifest);
    assert.throws(
      () => validateAlpha2V4Manifest(manifest, loaded),
      /alpha\.2 V4 candidate refused/u
    );
  }

  for (const attack of [
    (authority) => {
      authority.installable = true;
    },
    (authority) => {
      authority.promotionAllowed = true;
    },
    (authority) => {
      authority.releaseGate.completedJobs = 6;
      authority.releaseGate.runtimeReceiptSetSha256 = '2'.repeat(64);
    },
  ]) {
    const authority = structuredClone(loaded.authority);
    attack(authority);
    assert.throws(
      () => validateAlpha2V4CandidateAuthority(authority),
      /alpha\.2 V4 candidate refused/u
    );
  }
});

test('candidate manifest bytes, promotion commands, and current-install attempts remain blocked', async (t) => {
  const loaded = await loadAlpha2V4CandidateAuthority();
  const manifest = candidateTheme(loaded);
  await assert.rejects(
    () =>
      validateReleaseRecord(
        {
          verified: true,
          distribution: {
            kind: 'hosted-verified-artifact',
            installability: 'manager',
            redistribution: 'allowed',
            previewPolicy: 'hosted',
          },
          artifactUrl:
            'https://themes.example/api/themes/deep-ocean/download/2.0.0',
          artifactSha256: manifest.artifact.sha256,
          manifest,
        },
        { origin: 'https://themes.example' }
      ),
    /unsupported manifest schemaVersion/u
  );

  const promotion = await run(candidateScript, ['promote']);
  assert.notEqual(promotion.code, 0);
  assert.match(promotion.stderr, /installation and promotion are disabled/u);

  const directory = await mkdtemp(join(tmpdir(), 'dsh-v4-candidate-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const input = join(directory, 'synthetic-manifest.json');
  await writeFile(input, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  const rawValidation = await run(candidateScript, [
    'validate-manifest',
    '--input',
    input,
  ]);
  assert.notEqual(rawValidation.code, 0);
  assert.match(rawValidation.stderr, /manifest bytes differ/u);
});
