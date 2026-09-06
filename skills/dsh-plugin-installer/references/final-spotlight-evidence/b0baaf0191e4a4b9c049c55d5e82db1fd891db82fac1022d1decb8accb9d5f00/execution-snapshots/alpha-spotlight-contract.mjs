import assert from 'node:assert/strict';

export function assertSpotlightCoexistence(
  proof,
  {
    expectedSkinSha256 = '2e2f0431987db9872de2f7a8fa11d02ea1217a6d8d8b89b8b4173aba227d64e6',
    finalDesktop = false,
  } = {}
) {
  assert.equal(proof.status, 'passed');
  assert.equal(proof.skin.catalogId, 2002);
  assert.equal(proof.skin.slug, 'reasoning-tide');
  assert.equal(proof.skin.packageName, '@dsh-themes/reasoning-tide');
  assert.equal(proof.skin.artifactSha256, expectedSkinSha256);
  assert.deepEqual(
    proof.phases.map((p) => p.phase),
    [
      'before-skin',
      'with-skin',
      'after-spotlight-removal',
      'after-skin-removal',
    ]
  );
  for (const phase of proof.phases) {
    assert.equal(phase.status, 'passed');
    assert.equal(phase.modelTask, false);
    assert.equal(phase.processStopped, true);
    assert.equal(phase.portClosed, true);
    if (finalDesktop)
      assert.deepEqual(phase.portProbe, {
        host: '127.0.0.1',
        port: 4016,
        closed: true,
        code: 'ECONNREFUSED',
      });
    assert.equal(phase.browser.httpStatus, 200);
    assert.deepEqual(phase.browser.unexpectedErrors, []);
    assert.deepEqual(phase.browser.unexpectedRequests, []);
    for (const shot of phase.screenshots) {
      assert.match(shot.sha256, /^[a-f0-9]{64}$/);
      assert.ok(shot.bytes > 1000);
    }
    const expectedSpotlight = ['before-skin', 'with-skin'].includes(
      phase.phase
    );
    const expectedSkin = ['with-skin', 'after-spotlight-removal'].includes(
      phase.phase
    );
    assert.equal(phase.withSpotlight, expectedSpotlight);
    assert.equal(phase.withSkin, expectedSkin);
    for (const [name, expected] of [
      ['@0xsline/dsh-spotlight', expectedSpotlight],
      [proof.skin.packageName, expectedSkin],
    ])
      assert.equal(
        phase.hostEntries.some(
          (e) => e.name === name && e.state === 2 && !e.disabled
        ),
        expected
      );
    const b = phase.browser;
    const expected404 = new Set(
      expectedSkin
        ? []
        : b.resources.map((r) => new URL(r.url, 'http://127.0.0.1:4016').href)
    );
    assert.deepEqual(
      b.failedRequests.filter(
        (r) => !(r.status === 404 && expected404.has(r.url))
      ),
      []
    );
    assert.deepEqual(
      b.errors.filter(
        (e) =>
          !(
            expected404.has(e.url) &&
            e.message ===
              'Failed to load resource: the server responded with a status of 404 (Not Found)'
          )
      ),
      []
    );
    assert.equal(b.before.dataSkin, expectedSkin ? proof.skin.slug : null);
    assert.equal(
      b.before.stylesheet,
      expectedSkin ? '/__dsh-themes/reasoning-tide/skin.css' : null
    );
    assert.ok(b.resources.length >= 2);
    assert.equal(b.resources[0].url, '/__dsh-themes/reasoning-tide/skin.css');
    assert.equal(b.resources[0].expectedSha256, proof.skin.cssSha256);
    for (const resource of b.resources) {
      assert.equal(resource.status, expectedSkin ? 200 : 404);
      if (expectedSkin) assert.equal(resource.sha256, resource.expectedSha256);
    }
    if (expectedSpotlight) {
      assert.equal(phase.screenshots.length, 4);
      assert.equal(b.action.query, '打开插件设置');
      assert.ok(b.action.selectedText.includes('打开插件设置'));
      assert.equal(b.action.settingsDialogVisible, true);
      assert.equal(b.action.pluginSettingsTextPresent, true);
      assert.match(b.action.dialogText, /插件|Plugins/i);
      assert.equal(b.whileOpen.spotlightRootCount, 1);
      assert.equal(b.afterClose.spotlightRootCount, 0);
      assert.equal(b.before.spotlightStyleCount, 1);
      for (const key of [
        'dataSkin',
        'stylesheet',
        'backgroundImage',
        'dark',
        'tokens',
        'shortcutStorage',
      ]) {
        assert.deepEqual(b.whileOpen[key], b.before[key]);
        assert.deepEqual(b.afterClose[key], b.before[key]);
      }
    } else {
      assert.equal(
        phase.screenshots.length,
        finalDesktop && expectedSkin ? 3 : 1
      );
      assert.equal(b.before.spotlightRootCount, 0);
      assert.equal(b.before.spotlightStyleCount, 0);
    }
    if (finalDesktop && (expectedSpotlight || expectedSkin)) {
      const g = b.action?.geometry;
      assert.deepEqual(g?.viewport, { width: 1280, height: 800 });
      assert.ok(Math.abs(g.dialog.width - 800) <= 1);
      assert.ok(Math.abs(g.dialog.x - 240) <= 1);
      assert.equal(g.overlay.width, 1280);
      assert.equal(g.overlay.x, 0);
      assert.equal(g.overlay.y, 0);
      assert.equal(g.overlay.height, 800);
      assert.ok(Math.abs(g.dialog.height - 752) <= 1);
      assert.ok(Math.abs(g.dialog.y - 24) <= 1);
      assert.equal(g.contentHorizontalOverflow, false);
      assert.equal(g.optionsHorizontalOverflow, false);
      assert.ok(g.content.width >= 580 && g.options.width >= 580);
      assert.ok(g.nav.width >= 140 && g.nav.width <= 220);
      assert.ok(g.contentText.trim().length > 20);
      if (!expectedSpotlight) {
        assert.equal(b.action.kind, 'native-settings-after-spotlight-removal');
        assert.equal(b.action.settingsDialogVisible, true);
        assert.equal(b.action.pluginSettingsTextPresent, true);
        for (const key of [
          'tokens',
          'stylesheet',
          'backgroundImage',
          'dataSkin',
        ])
          assert.deepEqual(b.afterClose[key], b.before[key]);
      }
    }
  }
  assert.deepEqual(
    proof.phases[1].browser.before.tokens,
    proof.phases[2].browser.before.tokens
  );
  assert.deepEqual(
    proof.phases[0].browser.before.tokens,
    proof.phases[3].browser.before.tokens
  );
  assert.equal(proof.commands.length, 2);
  assert.ok(proof.commands.every((c) => c.code === 0));
  assert.deepEqual(
    proof.commands.map((c) => c.args.slice(0, 4)),
    [
      ['plugin', '--profile', 'web', 'add'],
      ['plugin', '--profile', 'web', 'remove'],
    ]
  );
  assert.equal(proof.commands[1].args[4], proof.skin.packageName);
}

/** Final acceptance uses the current exact first-party artifact, not the old visual diagnosis. */
export function assertFinalSpotlightCoexistence(proof, { skin, manifest }) {
  assert.notEqual(
    skin.artifactSha256,
    '2e2f0431987db9872de2f7a8fa11d02ea1217a6d8d8b89b8b4173aba227d64e6'
  );
  assert.deepEqual(proof.skin, skin);
  assert.equal(manifest.slug, skin.slug);
  assert.equal(manifest.version, skin.version);
  assert.equal(manifest.artifact.sha256, skin.artifactSha256);
  assertSpotlightCoexistence(proof, {
    expectedSkinSha256: skin.artifactSha256,
    finalDesktop: true,
  });
  for (const phase of proof.phases) {
    assert.deepEqual(
      phase.browser.resources.map((r) => ({
        url: r.url,
        sha256: r.expectedSha256,
      })),
      [
        {
          url: '/__dsh-themes/reasoning-tide/skin.css',
          sha256: skin.cssSha256,
        },
        ...manifest.assets.map((a) => ({ url: a.url, sha256: a.sha256 })),
      ]
    );
    if (phase.withSkin) {
      assert.deepEqual(
        Object.keys(phase.browser.before.tokens),
        Object.keys(manifest.tokens)
      );
      for (const [key, pair] of Object.entries(manifest.tokens))
        assert.equal(
          phase.browser.before.tokens[key].toUpperCase(),
          pair[phase.browser.before.dark ? 'dark' : 'light'].toUpperCase()
        );
    }
  }
}
