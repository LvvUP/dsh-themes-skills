import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';

import {
  assertFinalSpotlightCoexistence,
  assertSpotlightCoexistence,
} from './alpha-spotlight-contract.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const publicPath =
  'skills/dsh-plugin-installer/references/top10-installation-alpha.json';
const privatePath = 'themes/compatibility/dsh-top10-alpha.runtime.json';

export const TOP10_TECHNICAL_SHA256 =
  'b53558b77feb6206e7791020713c34cfe54937dd2c3b8a3de39ec02793e276fb';
const technicalFolder =
  'skills/dsh-plugin-installer/references/history/top10-spotlight-technical';
const finalPublicPath =
  'skills/dsh-plugin-installer/references/final-spotlight-coexistence-alpha.json';
const finalPrivatePath =
  'themes/compatibility/dsh-spotlight-final-alpha.runtime.json';

/** Read the exact current package bytes; tar only writes the selected member to stdout. */
export async function readCurrentSpotlightSkin(siteRoot) {
  const index = JSON.parse(
    await readFile(join(siteRoot, 'public/theme-packages/index.json'))
  );
  const row = index.themes.find((item) => item.catalogId === 2002);
  assert.equal(row?.slug, 'reasoning-tide');
  assert.equal(row.kind, 'full-skin');
  assert.equal(row.runtimeMatrix, 'verified-alpha');
  assert.equal(basename(row.artifactFile), row.artifactFile);
  assert.equal(basename(row.manifestFile), row.manifestFile);
  const archive = join(siteRoot, 'artifacts/theme-packages', row.artifactFile);
  assert.equal(sha256(await readFile(archive)), row.artifactSha256);
  const manifestBytes = await readFile(
    join(siteRoot, 'public/theme-packages', row.manifestFile)
  );
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.artifact.sha256, row.artifactSha256);
  assert.equal(manifest.payload.sha256, row.payloadSha256);
  assert.equal(manifest.compatibility.dshPackageVersion, '0.1.3-alpha.1');
  assert.equal(
    manifest.compatibility.officialRelease.sourceCommit,
    'd347e703908d0406b7a7ef80e3a0e594d86b2215'
  );
  const cssSha256 = sha256(
    execFileSync('tar', ['-xOf', archive, 'package/skin.css'])
  );
  const packageManifest = JSON.parse(
    execFileSync('tar', ['-xOf', archive, 'package/package.json'], {
      encoding: 'utf8',
    })
  );
  assert.equal(packageManifest.name, row.packageName);
  assert.equal(packageManifest.version, row.version);
  return {
    archive,
    manifestPath: join(siteRoot, 'public/theme-packages', row.manifestFile),
    manifest,
    skin: {
      catalogId: 2002,
      slug: row.slug,
      packageName: row.packageName,
      version: row.version,
      artifactSha256: row.artifactSha256,
      cssSha256,
      manifestSha256: sha256(manifestBytes),
      payloadSha256: row.payloadSha256,
    },
  };
}

export function assertTop10CompositeIdentity(
  receipt,
  { technicalBytes, finalBytes, catalogSha256, transitionSha256, helpers }
) {
  assert.equal(receipt.schemaVersion, 3);
  assert.equal(receipt.kind, 'top10-staged-acceptance');
  assert.equal(receipt.status, 'passed');
  assert.equal(receipt.catalogSha256, catalogSha256);
  assert.equal(receipt.recommendationTransitionSha256, transitionSha256);
  assert.equal(receipt.technicalStage.sha256, TOP10_TECHNICAL_SHA256);
  assert.equal(sha256(technicalBytes), TOP10_TECHNICAL_SHA256);
  const technical = JSON.parse(technicalBytes);
  assert.equal(technical.catalogSha256, catalogSha256);
  assert.equal(technical.recommendationTransitionSha256, transitionSha256);
  assert.deepEqual(technical.helperSha256, helpers);
  assert.equal(
    receipt.technicalStage.path,
    'history/top10-spotlight-technical/receipt.json'
  );
  assert.equal(
    receipt.finalCoexistence.path,
    'final-spotlight-coexistence-alpha.json'
  );
  assert.equal(receipt.finalCoexistence.sha256, sha256(finalBytes));
  const final = JSON.parse(finalBytes);
  assert.equal(final.status, 'passed');
  assert.equal(final.kind, 'spotlight-final-skin-coexistence');
  assert.equal(final.technicalReceiptSha256, TOP10_TECHNICAL_SHA256);
  assert.equal(final.catalogSha256, catalogSha256);
  assert.equal(final.recommendationTransitionSha256, transitionSha256);
  assert.deepEqual(final.helperSha256, helpers);
  assert.equal(final.snapshotsUnchangedAtCompletion, true);
  assert.equal(final.modelTask, false);
  assert.equal(final.spotlight.catalogId, 3004);
  assert.deepEqual(
    final.stages.map((s) => [
      s.name,
      s.result.status,
      s.result.items.map((i) => [i.catalogId, i.status]),
    ]),
    [
      ['install-spotlight', 'installed', [[3004, 'installed']]],
      ['remove-spotlight', 'removed', [[3004, 'removed']]],
    ]
  );
  assert.ok(
    final.commands.length > 0 && final.commands.every((c) => c.code === 0)
  );
}

/** Verify archived evidence in a clean checkout instead of trusting paths on the test host. */
export async function verifyMaterializedFinalEvidence(
  final,
  { publicEvidenceRoot, privateEvidenceRoot }
) {
  for (const snapshot of final.executionSnapshots) {
    assert.equal(basename(snapshot.name), snapshot.name);
    assert.equal(
      snapshot.snapshotPath,
      join(final.home, 'execution-snapshots', snapshot.name)
    );
    const relative = join('execution-snapshots', snapshot.name);
    for (const root of [publicEvidenceRoot, privateEvidenceRoot])
      assert.equal(
        sha256(await readFile(join(root, relative))),
        snapshot.sha256,
        'Archived final execution source differs'
      );
  }
  const seen = new Set();
  for (const phase of final.coexistence.phases) {
    const suffixes = phase.withSpotlight
      ? ['before', 'search', 'settings', 'closed']
      : phase.withSkin
        ? ['before', 'settings', 'closed']
        : ['before'];
    assert.deepEqual(
      phase.screenshots.map((shot) => basename(shot.path)),
      suffixes.map((suffix) => `spotlight-${phase.phase}-${suffix}.png`)
    );
    for (const shot of phase.screenshots) {
      const name = basename(shot.path);
      assert.ok(!seen.has(name));
      seen.add(name);
      for (const root of [publicEvidenceRoot, privateEvidenceRoot]) {
        const bytes = await readFile(join(root, 'screenshots', name));
        assert.equal(
          bytes.length,
          shot.bytes,
          'Archived final screenshot size differs'
        );
        assert.equal(
          sha256(bytes),
          shot.sha256,
          'Archived final screenshot digest differs'
        );
      }
    }
  }
}

function assertCombinedRuntime(item, runtime) {
  assert.equal(runtime.status, 'boot-passed');
  assert.equal(runtime.profile, item.profile);
  assert.equal(runtime.processStopped, true);
  assert.equal(runtime.hostReady?.hostTreeReady, true);
  assert.equal(runtime.hostReady.packageActive, true);
  assert.ok(
    runtime.hostReady.entries.some(
      (entry) =>
        entry.name === item.packageName && entry.state === 2 && !entry.disabled
    )
  );
  if (item.profile === 'web') {
    assert.equal(runtime.httpStatus, 200);
    assert.equal(runtime.htmlLoaded, true);
    assert.deepEqual(runtime.browser.errors, []);
    assert.deepEqual(runtime.browser.requests, []);
    const client = runtime.browser.clientEvidence;
    assert.equal(client.expected, runtime.expectsClient);
    assert.equal(client.loaded, true);
    if (runtime.expectsClient) {
      assert.equal(client.moduleEntry.id, item.packageName);
      assert.ok(client.batch.entries.includes(item.packageName));
      const matches = (value) => {
        const url = new URL(value);
        return (
          ['127.0.0.1', 'localhost'].includes(url.hostname) &&
          url.pathname + url.search === client.batch.url
        );
      };
      assert.ok(
        client.resources.some(
          (resource) => matches(resource.url) && resource.responseStatus === 200
        )
      );
      assert.ok(
        client.responses.some(
          (response) => matches(response.url) && response.status === 200
        )
      );
    } else {
      assert.equal(client.moduleEntry, null);
      assert.equal(client.batch, null);
    }
  } else {
    assert.equal(item.profile, 'tui');
    const tty = runtime.tui;
    assert.equal(tty.tty, true);
    assert.ok(tty.columns >= 80 && tty.rows >= 24);
    assert.equal(tty.helpSent, true);
    assert.equal(tty.helpRendered, true);
    assert.deepEqual(
      tty.actions.map((action) => [action.kind, action.text]),
      [
        ['local-command', '/help'],
        ['key', 'Ctrl+C'],
      ]
    );
    assert.ok(tty.transcriptBytes > 0);
    assert.equal(tty.childExitCode, 0);
    assert.equal(tty.forcedStop, false);
    assert.equal(tty.modelTaskSent, false);
    assert.equal(tty.processStopped, true);
  }
}

export function assertTop10CollectionReceipt(
  receipt,
  { plugins, catalogSha256, source, helpers, drivers, recommendation }
) {
  assert.equal(receipt.status, 'passed');
  assert.equal(receipt.kind, 'top10-public-entrypoint-lifecycle');
  assert.equal(receipt.dshVersion, source.version);
  assert.equal(receipt.dshSourceRevision, source.commit);
  if (recommendation) {
    assert.equal(receipt.schemaVersion, 2);
    assertSpotlightCoexistence(receipt.spotlightCoexistence);
    assert.equal(
      receipt.recommendationTransitionSha256,
      recommendation.transitionSha256
    );
  }
  assert.equal(
    receipt.catalogSha256,
    catalogSha256,
    'Top 10 receipt predates the final 100 recipes'
  );
  assert.deepEqual(
    receipt.helperSha256,
    helpers,
    'Top 10 installer implementation changed after verification'
  );
  assert.equal(receipt.snapshotsUnchangedAtCompletion, true);
  assert.deepEqual(
    receipt.executionSnapshots.map((snapshot) => snapshot.name),
    [
      'install-plugins.mjs',
      'uninstall-plugins.mjs',
      'dsh-alpha.mjs',
      'verify-dsh-top10-runtime.mjs',
      'verify-dsh-plugin-runtime.mjs',
      ...(recommendation
        ? [
            'verify-dsh-spotlight-runtime.mjs',
            'dsh-plugin-optional-runtime.mjs',
            'plugin-recommendation-contract.mjs',
          ]
        : []),
    ]
  );
  for (const snapshot of receipt.executionSnapshots) {
    assert.match(snapshot.sha256, /^[a-f0-9]{64}$/);
    assert.equal(
      snapshot.snapshotPath,
      join(receipt.home, 'execution-snapshots', snapshot.name)
    );
    const expected = helpers[snapshot.name] ?? drivers?.[snapshot.name];
    if (expected)
      assert.equal(
        snapshot.sha256,
        expected,
        `Stale execution snapshot: ${snapshot.name}`
      );
  }
  assert.equal(receipt.modelTask, false);
  assert.deepEqual(
    receipt.items.map((item) => item.catalogId),
    plugins.top10
  );
  const items = plugins.top10.map((id) =>
    plugins.items.find((item) => item.catalogId === id)
  );
  for (const item of items) {
    const recorded = receipt.items.find(
      (row) => row.catalogId === item.catalogId
    );
    for (const key of ['packageName', 'profile', 'sourceRevision', 'specifier'])
      assert.equal(recorded[key], item[key]);
    assert.deepEqual(recorded.artifact, item.artifact ?? null);
    const rows = receipt.runtime.filter(
      (row) => row.catalogId === item.catalogId
    );
    assert.equal(rows.length, 1);
    assertCombinedRuntime(item, rows[0].runtime);
  }
  assert.equal(receipt.runtime.length, 10);
  const stages = [
    'install-top10',
    'repeat-install-top10',
    'remove-pair-for-controlled-install-failure',
    'partial-install-disappeared-private-archive',
    'repair-controlled-install-failure',
    'uninstall-top10',
    'repeat-uninstall-top10',
  ];
  assert.deepEqual(
    receipt.stages.map((stage) => stage.name),
    stages
  );
  function checkStage(name, status, ids, itemStatus) {
    const result = receipt.stages.find((stage) => stage.name === name).result;
    assert.equal(result.status, status);
    assert.deepEqual(
      result.items.map((item) => item.catalogId),
      ids
    );
    if (itemStatus)
      assert.ok(result.items.every((item) => item.status === itemStatus));
    return result;
  }
  checkStage(stages[0], 'installed', plugins.top10, 'installed');
  checkStage(stages[1], 'installed', plugins.top10, 'already-installed');
  checkStage(stages[2], 'removed', [3092, 3052], 'removed');
  const partial = checkStage(stages[3], 'incomplete', [3092, 3052]);
  assert.deepEqual(
    partial.items.map((item) => item.status),
    ['failed', 'installed']
  );
  checkStage(stages[4], 'installed', [3092], 'installed');
  checkStage(stages[5], 'removed', plugins.top10, 'removed');
  checkStage(stages[6], 'removed', plugins.top10, 'already-removed');
  const failed = receipt.commands.filter((command) => command.code !== 0);
  assert.equal(
    failed.length,
    1,
    'Only the controlled missing private archive may fail'
  );
  assert.equal(failed[0].args[3], 'add');
  assert.equal(
    basename(failed[0].args[4]),
    'controlled-missing-private-artifact.tgz'
  );
  assert.ok(Number.isInteger(failed[0].code) && failed[0].code > 0);
  assert.equal(
    receipt.commands.filter((command) => command.args[3] === 'add').length,
    13
  );
  assert.equal(
    receipt.commands.filter((command) => command.args[3] === 'remove').length,
    12
  );
}

export async function auditTop10Collection({
  siteRoot,
  skillsRoot,
  plugins,
  source,
  recommendation,
}) {
  let bytes;
  try {
    bytes = await readFile(join(skillsRoot, publicPath));
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    return {
      status: 'pending',
      reason: 'top10-combination-verification-pending',
      catalogIds: plugins.top10,
    };
  }
  const receipt = JSON.parse(bytes);
  if (recommendation) {
    assert.equal(receipt.catalogSha256, recommendation.catalogSha256);
    assert.equal(
      receipt.recommendationTransitionSha256,
      recommendation.transitionSha256
    );
  }
  if (receipt.status !== 'passed' && !receipt.technicalStage)
    return {
      status: 'pending',
      reason: 'top10-combination-verification-not-passed',
      catalogIds: plugins.top10,
    };
  assert.equal(
    sha256(await readFile(join(siteRoot, privatePath))),
    sha256(bytes),
    'Private and public Top 10 receipts differ'
  );
  const helpers = {};
  for (const name of ['install-plugins.mjs', 'uninstall-plugins.mjs'])
    helpers[name] = sha256(
      await readFile(
        join(skillsRoot, 'skills/dsh-plugin-installer/scripts', name)
      )
    );
  helpers['dsh-alpha.mjs'] = sha256(
    await readFile(
      join(skillsRoot, 'skills/dsh-theme-manager/scripts/dsh-alpha.mjs')
    )
  );
  if (recommendation && receipt.technicalStage) {
    const technicalBytes = await readFile(
      join(skillsRoot, technicalFolder, 'receipt.json')
    );
    assert.equal(sha256(technicalBytes), TOP10_TECHNICAL_SHA256);
    assert.equal(receipt.technicalStage.sha256, TOP10_TECHNICAL_SHA256);
    assert.equal(
      receipt.technicalStage.path,
      'history/top10-spotlight-technical/receipt.json'
    );
    assert.equal(
      sha256(
        await readFile(
          join(
            siteRoot,
            'themes/compatibility/history/top10-spotlight-technical/receipt.json'
          )
        )
      ),
      TOP10_TECHNICAL_SHA256
    );
    const technical = JSON.parse(technicalBytes);
    const archivedDrivers = {};
    for (const snapshot of technical.executionSnapshots) {
      assert.equal(basename(snapshot.name), snapshot.name);
      const snapshotBytes = await readFile(
        join(skillsRoot, technicalFolder, 'execution-snapshots', snapshot.name)
      );
      assert.equal(sha256(snapshotBytes), snapshot.sha256);
      archivedDrivers[snapshot.name] = snapshot.sha256;
    }
    const catalogBytes = await readFile(
      join(skillsRoot, 'skills/dsh-plugin-installer/references/plugins.json')
    );
    assert.equal(
      sha256(await readFile(join(skillsRoot, technicalFolder, 'catalog.json'))),
      sha256(catalogBytes)
    );
    assertTop10CollectionReceipt(technical, {
      plugins,
      source,
      helpers,
      drivers: archivedDrivers,
      recommendation,
      catalogSha256: sha256(catalogBytes),
    });
    if (receipt.status !== 'passed')
      return {
        status: 'pending',
        reason: 'top10-technical-passed-final-skin-coexistence-pending',
        catalogIds: plugins.top10,
        technicalReceiptSha256: TOP10_TECHNICAL_SHA256,
      };
    const finalBytes = await readFile(join(skillsRoot, finalPublicPath));
    assert.equal(
      sha256(await readFile(join(siteRoot, finalPrivatePath))),
      sha256(finalBytes)
    );
    assertTop10CompositeIdentity(receipt, {
      technicalBytes,
      finalBytes,
      catalogSha256: sha256(catalogBytes),
      transitionSha256: recommendation.transitionSha256,
      helpers,
    });
    const final = JSON.parse(finalBytes);
    assert.equal(final.dshVersion, source.version);
    assert.equal(final.dshSourceRevision, source.commit);
    const spotlight = plugins.items.find((item) => item.catalogId === 3004);
    assert.deepEqual(final.spotlight, {
      catalogId: spotlight.catalogId,
      packageName: spotlight.packageName,
      profile: spotlight.profile,
      sourceRevision: spotlight.sourceRevision,
      specifier: spotlight.specifier,
      artifact: spotlight.artifact,
    });
    const snapshots = [
      [
        'install-plugins.mjs',
        join(
          skillsRoot,
          'skills/dsh-plugin-installer/scripts/install-plugins.mjs'
        ),
      ],
      [
        'uninstall-plugins.mjs',
        join(
          skillsRoot,
          'skills/dsh-plugin-installer/scripts/uninstall-plugins.mjs'
        ),
      ],
      [
        'dsh-alpha.mjs',
        join(skillsRoot, 'skills/dsh-theme-manager/scripts/dsh-alpha.mjs'),
      ],
      [
        'verify-dsh-spotlight-final-runtime.mjs',
        join(siteRoot, 'scripts/verify-dsh-spotlight-final-runtime.mjs'),
      ],
      [
        'verify-dsh-spotlight-final-surface.mjs',
        join(siteRoot, 'scripts/verify-dsh-spotlight-final-surface.mjs'),
      ],
      [
        'verify-dsh-plugin-runtime.mjs',
        join(siteRoot, 'scripts/verify-dsh-plugin-runtime.mjs'),
      ],
      [
        'dsh-plugin-optional-runtime.mjs',
        join(siteRoot, 'scripts/dsh-plugin-optional-runtime.mjs'),
      ],
      [
        'plugin-recommendation-contract.mjs',
        join(skillsRoot, 'scripts/plugin-recommendation-contract.mjs'),
      ],
      [
        'alpha-plugin-collection-contract.mjs',
        join(siteRoot, 'scripts/alpha-plugin-collection-contract.mjs'),
      ],
      [
        'alpha-spotlight-contract.mjs',
        join(siteRoot, 'scripts/alpha-spotlight-contract.mjs'),
      ],
    ];
    assert.deepEqual(
      final.executionSnapshots.map((s) => s.name),
      snapshots.map(([name]) => name)
    );
    for (const [name, path] of snapshots)
      assert.equal(
        final.executionSnapshots.find((s) => s.name === name).sha256,
        sha256(await readFile(path))
      );
    const currentSkin = await readCurrentSpotlightSkin(siteRoot);
    assertFinalSpotlightCoexistence(final.coexistence, currentSkin);
    await verifyMaterializedFinalEvidence(final, {
      publicEvidenceRoot: join(
        skillsRoot,
        'skills/dsh-plugin-installer/references/final-spotlight-evidence',
        sha256(finalBytes)
      ),
      privateEvidenceRoot: join(
        siteRoot,
        'themes/compatibility/final-spotlight-evidence',
        sha256(finalBytes)
      ),
    });
    assert.deepEqual(
      final.commands
        .filter((c) => c.args[3] === 'add')
        .map((c) => basename(c.args[4])),
      [basename(spotlight.artifact.path), basename(currentSkin.archive)]
    );
    assert.deepEqual(
      final.commands
        .filter((c) => c.args[3] === 'remove')
        .map((c) => c.args[4]),
      [spotlight.packageName, currentSkin.skin.packageName]
    );
    for (const command of final.coexistence.commands)
      assert.ok(
        final.commands.some(
          (c) => JSON.stringify(c) === JSON.stringify(command)
        )
      );
    assert.equal(receipt.visualReview.status, 'passed');
    assert.equal(receipt.visualReview.finalReceiptSha256, sha256(finalBytes));
    assert.deepEqual(
      receipt.visualReview.settingsScreenshots,
      final.coexistence.phases
        .filter((p) => p.withSpotlight || p.withSkin)
        .map(
          (p) =>
            p.screenshots.find((s) => s.path.endsWith('-settings.png')).sha256
        )
    );
    return {
      status: 'passed',
      catalogIds: plugins.top10,
      receiptSha256: sha256(bytes),
      technicalReceiptSha256: TOP10_TECHNICAL_SHA256,
      finalCoexistenceReceiptSha256: sha256(finalBytes),
      publicPath,
      privatePath,
    };
  }
  if (receipt.status !== 'passed')
    return {
      status: 'pending',
      reason: 'top10-combination-verification-not-passed',
      catalogIds: plugins.top10,
    };
  // A new Web recommendation cannot promote the known alpha.1 technical-only run directly.
  assert.equal(
    Boolean(recommendation),
    false,
    'Current recommendation requires separately verified final skin coexistence'
  );
  const drivers = {};
  for (const name of [
    'verify-dsh-top10-runtime.mjs',
    'verify-dsh-plugin-runtime.mjs',
    ...(recommendation
      ? ['verify-dsh-spotlight-runtime.mjs', 'dsh-plugin-optional-runtime.mjs']
      : []),
  ]) {
    drivers[name] = sha256(await readFile(join(siteRoot, 'scripts', name)));
  }
  if (recommendation)
    drivers['plugin-recommendation-contract.mjs'] = sha256(
      await readFile(
        join(skillsRoot, 'scripts/plugin-recommendation-contract.mjs')
      )
    );
  assertTop10CollectionReceipt(receipt, {
    plugins,
    source,
    helpers,
    drivers,
    recommendation,
    catalogSha256: sha256(
      await readFile(
        join(skillsRoot, 'skills/dsh-plugin-installer/references/plugins.json')
      )
    ),
  });
  return {
    status: 'passed',
    catalogIds: plugins.top10,
    receiptSha256: sha256(bytes),
    publicPath,
    privatePath,
  };
}
