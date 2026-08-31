import { parse as parseJavaScript } from 'acorn';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { gunzipSync } from 'node:zlib';

import {
  inspectTarEntries,
  validateCycloneDxSbom,
  validateHostedArtifact,
} from '../skills/dsh-plugin-installer/scripts/archive-policy.mjs';
import {
  buildHostedAdaptation,
  deterministicGzip,
  loadHostedAdaptation,
  REVIEWED_REACT_CREATE_ELEMENT_POLICY,
  validateHostedAdaptationRecipe,
  validateHostedScriptEntries,
} from '../skills/dsh-plugin-installer/scripts/build-hosted-adaptation.mjs';
import { validatePluginRuntimeProbe } from '../skills/dsh-plugin-installer/scripts/plugin-runtime-probe.mjs';
import { loadHostedAdaptationPlan } from '../skills/dsh-plugin-installer/scripts/hosted-adaptation-plan.mjs';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function testMemberChain(node) {
  if (node?.type === 'Identifier') return [node.name];
  if (node?.type !== 'MemberExpression' || node.computed || node.optional ||
      node.property.type !== 'Identifier') {
    return null;
  }
  const parent = testMemberChain(node.object);
  return parent === null ? null : [...parent, node.property.name];
}

function walkTestAst(node, visitor) {
  visitor(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) {
        if (child !== null && typeof child === 'object' && typeof child.type === 'string') {
          walkTestAst(child, visitor);
        }
      }
    } else if (value !== null && typeof value === 'object' &&
        typeof value.type === 'string') {
      walkTestAst(value, visitor);
    }
  }
}

function reviewedReactSurface(source, tags, components, properties) {
  const ast = parseJavaScript(source, { ecmaVersion: 'latest', sourceType: 'module' });
  walkTestAst(ast, (node) => {
    if (node.type !== 'CallExpression' ||
        testMemberChain(node.callee)?.join('.') !== 'React.createElement') {
      return;
    }
    const element = node.arguments[0];
    if (element?.type === 'Literal' && typeof element.value === 'string') {
      tags.add(element.value);
    } else {
      components.add(testMemberChain(element)?.join('.') ?? `<${element?.type ?? 'missing'}>`);
    }
    const props = node.arguments[1];
    if (props?.type !== 'ObjectExpression') return;
    for (const property of props.properties) {
      if (property.type === 'SpreadElement') {
        properties.add('<spread>');
      } else if (property.computed) {
        properties.add('<computed>');
      } else if (property.key.type === 'Identifier') {
        properties.add(property.key.name);
      } else if (property.key.type === 'Literal' && typeof property.key.value === 'string') {
        properties.add(property.key.value);
      }
    }
  });
}

function tarFixture(entries) {
  const blocks = [];
  for (const entry of entries) {
    const body = Buffer.from(entry.body ?? '');
    const header = Buffer.alloc(512);
    header.write(entry.name, 0, 'utf8');
    header.write('0000644\0', 100, 8, 'ascii');
    header.write('0000000\0', 108, 8, 'ascii');
    header.write('0000000\0', 116, 8, 'ascii');
    header.write(`${body.length.toString(8).padStart(11, '0')}\0`, 124, 12, 'ascii');
    header.write('00000000000\0', 136, 12, 'ascii');
    header.fill(0x20, 148, 156);
    header[156] = (entry.type ?? '0').charCodeAt(0);
    header.write('ustar\0', 257, 6, 'ascii');
    header.write('00', 263, 2, 'ascii');
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148, 8, 'ascii');
    blocks.push(header, body, Buffer.alloc((512 - (body.length % 512)) % 512));
  }
  blocks.push(Buffer.alloc(1024));
  return Buffer.concat(blocks);
}

function localeBlock(source, variable, style) {
  const start = style === 'freeze'
    ? `    const ${variable} = Object.freeze({`
    : style === 'compiled'
      ? `var ${variable} = {`
      : `export const ${variable} = {`;
  const end = style === 'freeze' ? '\n    })' : style === 'compiled' ? '\n};' : '\n} as const';
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `missing locale dictionary ${variable}`);
  const bodyStart = from + start.length;
  const to = source.indexOf(end, bodyStart);
  assert.notEqual(to, -1, `unterminated locale dictionary ${variable}`);
  return source.slice(bodyStart, to);
}

function localeKeys(block) {
  return [...block.matchAll(/(?:^|,)\s*(?:'([^']+)'|([A-Za-z][A-Za-z0-9]*)):\s*/gmu)]
    .map((match) => match[1] ?? match[2]);
}

function git(root, args) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    shell: false,
    windowsHide: true,
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

test('deterministic gzip is portable stored DEFLATE with a fixed header', () => {
  const input = Buffer.alloc(140_000, 0x61);
  const first = deterministicGzip(input);
  const second = deterministicGzip(Buffer.from(input));
  assert.deepEqual(first, second);
  assert.deepEqual(first.subarray(0, 10), Buffer.from([
    0x1f, 0x8b, 0x08, 0x00, 0, 0, 0, 0, 0x00, 0xff,
  ]));
  assert.deepEqual(gunzipSync(first), input);
});

test('hosted adaptation builds exact license, notice, SBOM, and script-free bytes without executing source', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-hosted-adaptation-'));
  const recipeRoot = await mkdtemp(join(tmpdir(), 'dsh-hosted-adaptation-recipe-'));
  try {
    const manifest = Buffer.from(`${JSON.stringify({
      name: 'fixture-plugin',
      version: '1.0.0',
      type: 'module',
      main: 'index.mjs',
      exports: { '.': './index.mjs', './client': './client.js' },
      files: ['index.mjs', 'client.js', 'cordis.patch.yml', 'LICENSE'],
      scripts: { prepare: 'node forbidden-build.js' },
      repository: { type: 'git', url: 'git+https://github.com/example/fixture-plugin.git' },
      dsh: {
        bundle: { patch: './cordis.patch.yml' },
        client: { inject: ['@deepseek-ai/dsh-client-runtime'], platform: 'web' },
      },
      license: 'MIT',
    }, null, 2)}\n`);
    const sourceFiles = new Map([
      ['package.json', manifest],
      ['index.mjs', Buffer.from('export default { name: "fixture-plugin", apply() {} }\n')],
      ['client.js', Buffer.from(
        'window.__ModuleLoader__.load({ id: "fixture-plugin", factory(require) {} })\n'
      )],
      ['cordis.patch.yml', Buffer.from('- insert:\n    - id: fixture-plugin\n      name: fixture-plugin\n')],
      ['LICENSE', Buffer.from('MIT License\nCopyright (c) Fixture\n')],
    ]);
    for (const [path, bytes] of sourceFiles) await writeFile(join(root, path), bytes);
    git(root, ['init', '-q']);
    git(root, ['config', 'user.email', 'fixture@example.test']);
    git(root, ['config', 'user.name', 'Fixture']);
    git(root, ['add', '.']);
    git(root, ['commit', '-q', '-m', 'fixture']);
    const [commit, tree] = git(root, ['rev-parse', 'HEAD', 'HEAD^{tree}']).split(/\r?\n/u);
    const probe = {
      schemaVersion: 1,
      purpose: 'dsh-plugin-alpha2-fixed-runtime-probe',
      authorityEffect: 'contract-only-not-runtime-authority',
      candidateExecuted: false,
      catalogId: 3999,
      baseline: {
        tag: 'dsh-v0.1.2-alpha.2',
        commit: '0a53fb55bea101816fa226bb964ae2bed71c343b',
        tree: '64ccbfa8e0caa4711cd4a75717ef9e022657961b',
      },
      package: {
        name: 'fixture-plugin',
        version: '1.0.0-dsh.alpha2.1',
        profile: 'web',
        cordisEntryId: 'fixture-plugin',
      },
      capabilities: {
        permissions: ['read one fixture projection'],
        network: [],
        processes: [],
        files: [],
        clientServices: ['fixture'],
        remoteMethods: [],
        browserPersistence: 'none',
      },
      combination: {
        additiveSlots: [],
        exclusiveResources: [],
        officialSurfacePreserved: true,
      },
      assertions: [
        { id: 'fixture.ready', class: 'feature-contract', expected: 'The fixture is ready.' },
        {
          id: 'fixture.dispose-zero',
          class: 'teardown-rollback',
          expected: 'The fixture leaves no residue.',
        },
      ],
    };
    const probeBytes = Buffer.from(`${JSON.stringify(probe, null, 2)}\n`);
    await mkdir(join(recipeRoot, 'references', 'plugin-runtime-probes'), { recursive: true });
    await writeFile(join(recipeRoot, 'references', 'plugin-runtime-probes', '3999.json'), probeBytes);
    const recipe = {
      schemaVersion: 1,
      purpose: 'dsh-alpha2-hosted-plugin-adaptation',
      catalogId: 3999,
      slug: 'fixture-plugin',
      baseline: {
        tag: 'dsh-v0.1.2-alpha.2',
        commit: '0a53fb55bea101816fa226bb964ae2bed71c343b',
        tree: '64ccbfa8e0caa4711cd4a75717ef9e022657961b',
      },
      source: {
        repository: 'https://github.com/example/fixture-plugin.git',
        commit,
        tree,
        sourceSubdir: '.',
        manifestSha256: sha256(sourceFiles.get('package.json')),
        packageName: 'fixture-plugin',
        packageVersion: '1.0.0',
        bundlePatch: 'cordis.patch.yml',
      },
      output: {
        packageName: 'fixture-plugin',
        packageVersion: '1.0.0-dsh.alpha2.1',
        description: 'Fixed alpha.2 fixture adaptation',
        assetName: 'fixture-plugin-1.0.0-dsh.alpha2.1.tgz',
        hostEntry: 'index.mjs',
        clientEntry: 'client.js',
        bundlePatch: 'cordis.patch.yml',
        clientInject: [
          '@deepseek-ai/dsh-api-session-controller',
          '@deepseek-ai/dsh-client-ui-renderer',
        ],
        peerDependencies: {
          '@deepseek-ai/dsh-api-session-controller': '0.1.2-alpha.2',
          '@deepseek-ai/dsh-client-ui-renderer': '0.1.2-alpha.2',
          react: '18.2.0',
        },
        files: ['index.mjs', 'client.js', 'cordis.patch.yml', 'LICENSE'].map((path) => ({
          outputPath: path,
          input: {
            kind: 'copy-exact-upstream',
            sourcePath: path,
            sha256: sha256(sourceFiles.get(path)),
          },
        })),
      },
      rights: {
        licenseExpression: 'MIT',
        licensePath: 'LICENSE',
        licenseSha256: sha256(sourceFiles.get('LICENSE')),
        copyrightNotice: 'Copyright (c) Fixture',
        redistribution: 'allowed-with-license-and-modification-notice',
      },
      staticPolicy: {
        computedMembers: [],
        forbiddenUtf8: [
          '@deepseek-ai/dsh-client-runtime',
          'node forbidden-build.js',
        ],
        requiredUtf8: [
          'window.__ModuleLoader__.load',
          '@deepseek-ai/dsh-api-session-controller',
        ],
      },
      runtimeProbe: {
        contractPath: 'references/plugin-runtime-probes/3999.json',
        contractSha256: sha256(probeBytes),
        requiredAssertions: ['fixture.ready', 'fixture.dispose-zero'],
      },
    };
    const recipeBytes = Buffer.from(`${JSON.stringify(recipe, null, 2)}\n`);
    validateHostedAdaptationRecipe(recipe);
    validatePluginRuntimeProbe(probe);
    const first = await buildHostedAdaptation({ recipe, recipeBytes, recipeRoot, source: root });
    const second = await buildHostedAdaptation({ recipe, recipeBytes, recipeRoot, source: root });
    assert.deepEqual(first.artifact, second.artifact);
    assert.equal(first.receipt.candidateExecuted, false);
    assert.equal(first.receipt.publication.installable, false);
    assert.equal(first.receipt.publication.runtimeCertified, false);
    assert.equal(first.receipt.artifact.sha256, sha256(first.artifact));

    const entries = inspectTarEntries(first.artifact);
    const byName = new Map(entries.map((entry) => [entry.name, entry]));
    const packedManifest = JSON.parse(byName.get('package/package.json').body);
    assert.equal(packedManifest.version, '1.0.0-dsh.alpha2.1');
    assert.equal(packedManifest.main, './index.mjs');
    assert.deepEqual(packedManifest.exports, {
      '.': './index.mjs',
      './client': './client.js',
      './package.json': './package.json',
    });
    assert.equal(packedManifest.scripts, undefined);
    assert.equal(packedManifest.devDependencies, undefined);
    assert.equal(packedManifest.dependencies, undefined);
    assert.equal(packedManifest.dshThemes.distribution, undefined);
    assert.equal(packedManifest.dshThemes.installable, undefined);
    assert.equal(packedManifest.dshThemes.runtimeCertified, undefined);
    assert.deepEqual(packedManifest.peerDependencies, {
      '@deepseek-ai/dsh-api-session-controller': '0.1.2-alpha.2',
      '@deepseek-ai/dsh-client-ui-renderer': '0.1.2-alpha.2',
      react: '18.2.0',
    });
    assert.deepEqual(packedManifest.dsh.client.inject, recipe.output.clientInject);
    assert.equal(byName.get('package/LICENSE').body.toString(), sourceFiles.get('LICENSE').toString());
    assert.match(byName.get('package/NOTICE.md').body.toString(), new RegExp(commit, 'u'));
    const sbom = JSON.parse(byName.get('package/SBOM.cdx.json').body);
    assert.equal(sbom.bomFormat, 'CycloneDX');
    assert.equal(sbom.metadata.component.version, '1.0.0-dsh.alpha2.1');
    assert.equal(sbom.metadata.component.hashes, undefined);
    assert.deepEqual(sbom.metadata.component.properties, [{
      name: 'dsh-themes:package-manifest-sha256',
      value: first.receipt.artifact.manifestSha256,
    }]);
    assert.equal(sbom.components.length, 3);
    assert.equal(
      sbom.components.some((entry) =>
        entry['bom-ref'] === sbom.metadata.component['bom-ref']),
      false
    );
    assert.equal(sbom.dependencies.length, 4);
    assert.deepEqual(
      sbom.dependencies.find((entry) => entry.ref === sbom.metadata.component['bom-ref']).dependsOn,
      [
        'pkg:npm/%40deepseek-ai/dsh-api-session-controller@0.1.2-alpha.2',
        'pkg:npm/%40deepseek-ai/dsh-client-ui-renderer@0.1.2-alpha.2',
        'pkg:npm/react@18.2.0',
      ]
    );
    const hostedItem = {
      package: {
        name: recipe.output.packageName,
        version: recipe.output.packageVersion,
        bundlePatch: recipe.output.bundlePatch,
      },
      distribution: {
        kind: 'hosted-plugin-verified',
        artifactBytes: first.receipt.artifact.bytes,
        artifactSha256: first.receipt.artifact.sha256,
        manifestSha256: first.receipt.artifact.manifestSha256,
        licenseFile: {
          path: recipe.rights.licensePath,
          sha256: first.receipt.artifact.licenseSha256,
        },
        noticeFile: {
          path: 'NOTICE.md',
          sha256: first.receipt.artifact.noticeSha256,
        },
        sbom: {
          path: 'SBOM.cdx.json',
          sha256: first.receipt.artifact.sbomSha256,
        },
      },
      rights: {
        licenseExpression: recipe.rights.licenseExpression,
      },
    };
    assert.deepEqual(validateHostedArtifact(first.artifact, hostedItem), {
      packageName: recipe.output.packageName,
      version: recipe.output.packageVersion,
      artifactSha256: first.receipt.artifact.sha256,
      entries: 7,
    });

    validateCycloneDxSbom(sbom, hostedItem, packedManifest);
    const rootCollision = structuredClone(sbom);
    rootCollision.components[0] = structuredClone(rootCollision.metadata.component);
    assert.throws(
      () => validateCycloneDxSbom(rootCollision, hostedItem, packedManifest),
      /root-colliding|peerDependencies/u
    );
    const missingComponent = structuredClone(sbom);
    missingComponent.components.pop();
    assert.throws(
      () => validateCycloneDxSbom(missingComponent, hostedItem, packedManifest),
      /exactly match manifest peerDependencies/u
    );
    const extraComponent = structuredClone(sbom);
    extraComponent.components.push({
      type: 'library',
      name: 'unlisted-package',
      version: '1.0.0',
      purl: 'pkg:npm/unlisted-package@1.0.0',
      'bom-ref': 'pkg:npm/unlisted-package@1.0.0',
      scope: 'required',
    });
    assert.throws(
      () => validateCycloneDxSbom(extraComponent, hostedItem, packedManifest),
      /exactly match manifest peerDependencies/u
    );
    const incompleteRoot = structuredClone(sbom);
    incompleteRoot.dependencies[0].dependsOn.pop();
    assert.throws(
      () => validateCycloneDxSbom(incompleteRoot, hostedItem, packedManifest),
      /root dependsOn/u
    );
    const ambiguousManifestBinding = structuredClone(sbom);
    ambiguousManifestBinding.metadata.component.properties.push({
      name: 'unreviewed:extra-root-property',
      value: 'ambiguous',
    });
    assert.throws(
      () => validateCycloneDxSbom(ambiguousManifestBinding, hostedItem, packedManifest),
      /manifest SHA-256/u
    );

    const bad = structuredClone(recipe);
    bad.staticPolicy.forbiddenUtf8.push('factory(require) {}');
    const badBytes = Buffer.from(`${JSON.stringify(bad, null, 2)}\n`);
    await assert.rejects(
      () => buildHostedAdaptation({ recipe: bad, recipeBytes: badBytes, recipeRoot, source: root }),
      /forbidden static signal/u
    );

    const wrongRecipeBytes = Buffer.from(`${JSON.stringify({
      ...recipe,
      output: { ...recipe.output, description: 'Different valid description' },
    })}\n`);
    await assert.rejects(
      () => buildHostedAdaptation({
        recipe,
        recipeBytes: wrongRecipeBytes,
        recipeRoot,
        source: root,
      }),
      /differs from its digest-bound bytes/u
    );

    const drifting = structuredClone(recipe);
    drifting.output.peerDependencies['@deepseek-ai/dsh-api-session-controller'] = '^0.1.2-alpha.2';
    assert.throws(
      () => validateHostedAdaptationRecipe(drifting),
      /peer dependency closure/u
    );
  } finally {
    await Promise.all([
      rm(root, { recursive: true, force: true }),
      rm(recipeRoot, { recursive: true, force: true }),
    ]);
  }
});

test('hosted adaptation schema is closed and bound to alpha.2', async () => {
  const [schema, probeSchema] = await Promise.all([
    readFile(new URL(
      '../skills/dsh-plugin-installer/references/plugin-hosted-adaptation.schema.json',
      import.meta.url
    )).then(JSON.parse),
    readFile(new URL(
      '../skills/dsh-plugin-installer/references/plugin-runtime-probe.schema.json',
      import.meta.url
    )).then(JSON.parse),
  ]);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.output.properties.hostEntry.$ref, '#/$defs/scriptEntryPath');
  assert.equal(schema.properties.output.properties.clientEntry.$ref, '#/$defs/scriptEntryPath');
  assert.equal(schema.properties.output.properties.clientInject.items.$ref, '#/$defs/dependencyName');
  assert.equal(schema.properties.output.properties.peerDependencies.propertyNames.$ref,
    '#/$defs/dependencyName');
  assert.deepEqual(schema.$defs.dependencyName.allOf[1].not.enum,
    ['constructor', '__proto__', 'prototype']);
  assert.equal(schema.properties.staticPolicy.properties.computedMembers.maxItems, 0);
  assert.equal(schema.properties.staticPolicy.properties.computedMembers.items.$ref, '#/$defs/computedMember');
  assert.equal(schema.$defs.scriptEntryPath.allOf[1].pattern, '\\.(?:js|mjs|cjs)$');
  assert.equal(schema.properties.baseline.properties.tag.const, 'dsh-v0.1.2-alpha.2');
  assert.equal(
    schema.properties.baseline.properties.commit.const,
    '0a53fb55bea101816fa226bb964ae2bed71c343b'
  );
  assert.equal(probeSchema.additionalProperties, false);
  assert.equal(probeSchema.properties.authorityEffect.const, 'contract-only-not-runtime-authority');
});

test('hosted recipe rejects unsafe paths, script entry types, collisions, and file ancestors', async () => {
  const { recipe } = await loadHostedAdaptation(3017);
  for (const unsafe of ['../index.mjs', 'CON', 'lib/client.']) {
    const mutated = structuredClone(recipe);
    mutated.output.hostEntry = unsafe;
    mutated.output.files[0].outputPath = unsafe;
    assert.throws(() => validateHostedAdaptationRecipe(mutated), /portable|package path/u);
  }
  const collision = structuredClone(recipe);
  collision.output.files[0].outputPath = 'Package.JSON';
  collision.output.hostEntry = 'Package.JSON';
  assert.throws(
    () => validateHostedAdaptationRecipe(collision),
    /duplicate|omit|portable|reserved|unsafe|output authority/u
  );

  for (const unsafeEntry of ['native.node', 'client.wasm', 'script.json', 'index.MJS']) {
    const mutated = structuredClone(recipe);
    mutated.output.hostEntry = unsafeEntry;
    mutated.output.files[0].outputPath = unsafeEntry;
    assert.throws(
      () => validateHostedAdaptationRecipe(mutated),
      /output authority|safe JavaScript|duplicate|omit/u
    );
  }

  const ancestor = structuredClone(recipe);
  ancestor.output.files.push({
    outputPath: 'NOTICE.md/child.js',
    input: structuredClone(ancestor.output.files[0].input),
  });
  assert.throws(
    () => validateHostedAdaptationRecipe(ancestor),
    /regular-file ancestor\/descendant conflict/u
  );

  const selfDependency = structuredClone(recipe);
  selfDependency.output.peerDependencies[selfDependency.output.packageName] =
    selfDependency.output.packageVersion;
  assert.throws(
    () => validateHostedAdaptationRecipe(selfDependency),
    /peer dependency closure/u
  );

  const reviewedComputedMember = structuredClone(recipe);
  reviewedComputedMember.staticPolicy.computedMembers = [{
    outputPath: reviewedComputedMember.output.clientEntry,
    expression: 'fixture["member"]',
    occurrences: 1,
  }];
  assert.throws(
    () => validateHostedAdaptationRecipe(reviewedComputedMember),
    /exactly an empty array/u
  );

  for (const reserved of ['constructor', '__proto__', 'prototype']) {
    const reservedPeerDependency = structuredClone(recipe);
    Object.defineProperty(reservedPeerDependency.output.peerDependencies, reserved, {
      configurable: true,
      enumerable: true,
      value: '1.0.0',
      writable: true,
    });
    assert.equal(Object.hasOwn(reservedPeerDependency.output.peerDependencies, reserved), true);
    assert.throws(
      () => validateHostedAdaptationRecipe(reservedPeerDependency),
      /peer dependency closure/u,
      `explicit own peer dependency ${reserved}`
    );

    const reservedClientInject = structuredClone(recipe);
    Object.defineProperty(reservedClientInject.output.peerDependencies, reserved, {
      configurable: true,
      enumerable: true,
      value: '1.0.0',
      writable: true,
    });
    reservedClientInject.output.clientInject = [reserved];
    assert.throws(
      () => validateHostedAdaptationRecipe(reservedClientInject),
      /reserved or Node builtin dependency name/u,
      `client inject ${reserved}`
    );
  }
});

test('tar inspection rejects regular-file ancestors in either archive order', () => {
  for (const entries of [
    [
      { name: 'package/NOTICE.md', body: 'notice' },
      { name: 'package/NOTICE.md/child.js', body: 'child' },
    ],
    [
      { name: 'package/NOTICE.md/child.js', body: 'child' },
      { name: 'package/NOTICE.md', body: 'notice' },
    ],
  ]) {
    assert.throws(
      () => inspectTarEntries(tarFixture(entries)),
      /regular-file ancestor\/descendant conflict/u
    );
  }
  assert.equal(inspectTarEntries(tarFixture([
    { name: 'package/lib', type: '5' },
    { name: 'package/lib/client.js', body: 'export default {}' },
  ])).length, 2);
});

test('hosted script gate requires strict UTF-8, parsed syntax, exact imports, and safe capabilities', async () => {
  const { recipe: checkedInRecipe } = await loadHostedAdaptation(3017);
  const recipe = structuredClone(checkedInRecipe);
  recipe.staticPolicy.computedMembers = [];
  const safe = new Map([
    ['index.mjs', Buffer.from('export default { apply() {} }\n')],
    ['client.js', Buffer.from(
      'window.__ModuleLoader__.load({ id: "fixture", factory: (require) => { require("react") } })\n'
    )],
  ]);
  assert.equal(validateHostedScriptEntries(safe, recipe).size, 2);

  const safeDomLifecycle = new Map(safe);
  safeDomLifecycle.set('client.js', Buffer.from(
    'window.__ModuleLoader__.load({ id: "fixture", factory: (require) => {\n' +
    '  const React = require("react")\n' +
    '  React.createElement("span", null)\n' +
    '  if (typeof document !== "undefined" && ' +
    'document.querySelector("style[data-fixture]") === null) {\n' +
    '    const tag = document.createElement("style")\n' +
    '    tag.textContent = ""\n' +
    '    document.head.appendChild(tag)\n' +
    '  }\n' +
    '} })\n'
  ));
  assert.equal(validateHostedScriptEntries(safeDomLifecycle, recipe).size, 2);

  const cases = [
    {
      label: 'invalid UTF-8',
      source: Buffer.from([0xc3, 0x28]),
      pattern: /strict UTF-8/u,
    },
    {
      label: 'syntax error',
      source: Buffer.from('export default {\n'),
      pattern: /does not parse/u,
    },
    {
      label: 'undeclared static import',
      source: Buffer.from('import "node:fs"\n'),
      pattern: /absent from exact peerDependencies/u,
    },
    {
      label: 'dynamic import',
      source: Buffer.from('export default import("react")\n'),
      pattern: /dynamic import/u,
    },
    {
      label: 'non-literal require',
      source: Buffer.from('const dependency = "react"; require(dependency)\n'),
      pattern: /non-literal or indirect require/u,
    },
    {
      label: 'aliased factory require',
      source: Buffer.from(
        'window.__ModuleLoader__.load({ id: "fixture", factory: (require) => {' +
        ' const alias = require; alias("react") } })\n'
      ),
      pattern: /non-literal or indirect require/u,
    },
    {
      label: 'indirect factory require call',
      source: Buffer.from(
        'window.__ModuleLoader__.load({ id: "fixture", factory: (require) => {' +
        ' require.call(null, "react") } })\n'
      ),
      pattern: /non-literal or indirect require/u,
    },
    {
      label: 'require parameter outside the module-loader factory',
      source: Buffer.from('export default function fixture(require) { return 1 }\n'),
      pattern: /non-literal or indirect require/u,
    },
    {
      label: 'renamed module-loader factory parameter',
      source: Buffer.from(
        'window.__ModuleLoader__.load({ id: "fixture", factory: (load) => {' +
        ' load("react") } })\n'
      ),
      pattern: /factory must have the single Identifier parameter require/u,
    },
    {
      label: 'descriptor constructor',
      source: Buffer.from(
        'export default Object.getOwnPropertyDescriptor({}, "constructor").value\n'
      ),
      pattern: /forbidden executable capability getOwnPropertyDescriptor/u,
    },
    {
      label: 'bulk property descriptors',
      source: Buffer.from('export default Object.getOwnPropertyDescriptors({})\n'),
      pattern: /forbidden executable capability getOwnPropertyDescriptors/u,
    },
    {
      label: 'timer callback',
      source: Buffer.from('export default setTimeout(() => {}, 0)\n'),
      pattern: /forbidden executable capability setTimeout/u,
    },
    {
      label: 'interval callback',
      source: Buffer.from('export default setInterval(() => {}, 1000)\n'),
      pattern: /forbidden executable capability setInterval/u,
    },
    {
      label: 'computed document access',
      source: Buffer.from('export default document["coo" + "kie"]\n'),
      pattern: /forbidden computed MemberExpression/u,
    },
    {
      label: 'global escape',
      source: Buffer.from('export default globalThis["fetch"]\n'),
      pattern: /forbidden computed MemberExpression/u,
    },
    {
      label: 'escaped global token',
      source: Buffer.from('export default doc\\u0075ment\n'),
      pattern: /reviewed DOM lifecycle surface/u,
    },
    {
      label: 'module loader computed property',
      source: Buffer.from('export default window.__ModuleLoader__["load"]({})\n'),
      pattern: /forbidden computed MemberExpression/u,
    },
    {
      label: 'Function constructor chain',
      source: Buffer.from(
        'export default (() => {})["con" + "structor"]("return globalThis.process")()\n'
      ),
      pattern: /forbidden computed MemberExpression/u,
    },
    {
      label: 'dynamic member',
      source: Buffer.from('const member = "value"; export default fixture[member]\n'),
      pattern: /forbidden computed MemberExpression/u,
    },
    {
      label: 'computed destructuring property',
      source: Buffer.from('const { ["value"]: value } = fixture; export default value\n'),
      pattern: /forbidden computed Property/u,
    },
    {
      label: 'computed class method',
      source: Buffer.from('class Fixture { ["method"]() {} } export default Fixture\n'),
      pattern: /forbidden computed MethodDefinition/u,
    },
    {
      label: 'computed class field',
      source: Buffer.from('class Fixture { ["field"] = 1 } export default Fixture\n'),
      pattern: /forbidden computed PropertyDefinition/u,
    },
    {
      label: 'non-style element',
      source: Buffer.from('export default document.createElement("iframe")\n'),
      pattern: /owned style element/u,
    },
    {
      label: 'createElement from an unreviewed receiver',
      source: Buffer.from('export default fixture.createElement("style")\n'),
      pattern: /only call React\.createElement or document\.createElement/u,
    },
    {
      label: 'aliased document createElement',
      source: Buffer.from('const create = document.createElement; export default create\n'),
      pattern: /reviewed DOM lifecycle surface/u,
    },
    {
      label: 'document querySelector result escapes comparison',
      source: Buffer.from('export default document.querySelector("style")\n'),
      pattern: /direct null comparison/u,
    },
    {
      label: 'document querySelector loose null comparison',
      source: Buffer.from('export default document.querySelector("style") == null\n'),
      pattern: /direct null comparison/u,
    },
    {
      label: 'appendChild from an unreviewed receiver',
      source: Buffer.from('export default fixture.appendChild(tag)\n'),
      pattern: /only append an owned style to document\.head/u,
    },
    {
      label: 'aliased document head appendChild',
      source: Buffer.from('const append = document.head.appendChild; export default append\n'),
      pattern: /reviewed DOM lifecycle surface/u,
    },
    {
      label: 'DOM ancestry escape',
      source: Buffer.from('export default document.head.ownerDocument\n'),
      pattern: /forbidden DOM capability ownerDocument/u,
    },
    {
      label: 'frame content escape',
      source: Buffer.from('export default fixture.contentWindow\n'),
      pattern: /forbidden DOM capability contentWindow/u,
    },
    {
      label: 'setAttribute plus click escape',
      source: Buffer.from(
        'const tag = document.createElement("style"); ' +
        'tag.setAttribute("data-fixture", "1"); tag.click()\n'
      ),
      pattern: /forbidden DOM capability setAttribute/u,
    },
    {
      label: 'direct DOM click',
      source: Buffer.from('export default document.head.click()\n'),
      pattern: /forbidden DOM capability click/u,
    },
    {
      label: 'DOM event property',
      source: Buffer.from('export default fixture.onclick\n'),
      pattern: /forbidden DOM capability onclick/u,
    },
    {
      label: 'React external resource property',
      source: Buffer.from(
        'export default React.createElement("div", { src: "https://example.invalid/a" })\n'
      ),
      pattern: /React property src is outside the reviewed allowlist/u,
    },
    {
      label: 'React navigation property',
      source: Buffer.from(
        'export default React.createElement("form", { action: "https://example.invalid" })\n'
      ),
      pattern: /React property action is outside the reviewed allowlist/u,
    },
    {
      label: 'React style property',
      source: Buffer.from('export default React.createElement("div", { style: {} })\n'),
      pattern: /React property style is outside the reviewed allowlist/u,
    },
    {
      label: 'React dangerous HTML property',
      source: Buffer.from(
        'export default React.createElement("div", { dangerouslySetInnerHTML: {} })\n'
      ),
      pattern: /React property dangerouslySetInnerHTML is outside the reviewed allowlist/u,
    },
    {
      label: 'React dynamic properties',
      source: Buffer.from('export default React.createElement("div", props)\n'),
      pattern: /React properties must be null or one static object/u,
    },
    {
      label: 'React spread properties',
      source: Buffer.from('export default React.createElement("div", { ...props })\n'),
      pattern: /must not use spread/u,
    },
    {
      label: 'React custom component',
      source: Buffer.from('export default React.createElement(Component, null)\n'),
      pattern: /reviewed React intrinsic tags or React\.Fragment/u,
    },
    {
      label: 'named React createElement import alias',
      source: Buffer.from(
        'import { createElement as render } from "react"; ' +
        'export default render("div", null)\n'
      ),
      pattern: /forbidden named React createElement import/u,
    },
    {
      label: 'destructured require React createElement alias',
      source: Buffer.from(
        'window.__ModuleLoader__.load({ id: "fixture", factory: (require) => {' +
        ' const { createElement: render } = require("react");' +
        ' return render("div", null) } })\n'
      ),
      pattern: /forbidden destructured createElement alias/u,
    },
    {
      label: 'document head removal',
      source: Buffer.from('export default document.head.remove()\n'),
      pattern: /reviewed DOM lifecycle surface/u,
    },
    {
      label: 'document head extraction',
      source: Buffer.from('export default document.head\n'),
      pattern: /reviewed DOM lifecycle surface/u,
    },
    {
      label: 'Error stack receiver',
      source: Buffer.from('export default new Error().stack\n'),
      pattern: /forbidden stack or event introspection capability stack/u,
    },
    {
      label: 'Error captureStackTrace',
      source: Buffer.from('export default Error.captureStackTrace({})\n'),
      pattern: /introspection capability captureStackTrace/u,
    },
    {
      label: 'CallSite receiver introspection',
      source: Buffer.from('export default callSite.getThis()\n'),
      pattern: /introspection capability getThis/u,
    },
    {
      label: 'event view escape',
      source: Buffer.from('export default event.view\n'),
      pattern: /introspection capability view/u,
    },
    {
      label: 'raw CSS URL',
      source: Buffer.from('export default "body{background:url(https://example.invalid)}"\n'),
      pattern: /forbidden CSS import or URL reference/u,
    },
    {
      label: 'decoded CSS URL',
      source: Buffer.from(
        'export default "body{background:\\u0075rl(https://example.invalid)}"\n'
      ),
      pattern: /forbidden CSS import or URL reference/u,
    },
    {
      label: 'decoded CSS import',
      source: Buffer.from('export default "\\x40import \'theme.css\'"\n'),
      pattern: /forbidden CSS import or URL reference/u,
    },
    {
      label: 'split template CSS URL',
      source: Buffer.from('const value = "x"; export default `u${value}rl(`\n'),
      pattern: /forbidden CSS import or URL reference/u,
    },
    {
      label: 'static concatenated CSS URL',
      source: Buffer.from('export default "ur" + "l("\n'),
      pattern: /forbidden CSS import or URL reference/u,
    },
  ];
  for (const fixture of cases) {
    const files = new Map(safe);
    files.set('index.mjs', fixture.source);
    assert.throws(
      () => validateHostedScriptEntries(files, recipe),
      fixture.pattern,
      fixture.label
    );
  }

  for (const reserved of ['constructor', '__proto__', 'prototype']) {
    const reservedRecipe = structuredClone(recipe);
    Object.defineProperty(reservedRecipe.output.peerDependencies, reserved, {
      configurable: true,
      enumerable: true,
      value: '1.0.0',
      writable: true,
    });
    assert.equal(Object.hasOwn(reservedRecipe.output.peerDependencies, reserved), true);
    const files = new Map(safe);
    files.set('index.mjs', Buffer.from(`export default require(${JSON.stringify(reserved)})\n`));
    assert.throws(
      () => validateHostedScriptEntries(files, reservedRecipe),
      /absent from exact peerDependencies/u,
      `require explicit own peer dependency ${reserved}`
    );
  }

  for (const builtin of ['fs', 'child_process', 'http']) {
    const builtinRecipe = structuredClone(recipe);
    builtinRecipe.output.peerDependencies[builtin] = '1.0.0';
    assert.throws(
      () => validateHostedAdaptationRecipe(builtinRecipe),
      /peer dependency closure/u,
      `recipe peer dependency ${builtin}`
    );
    const injectedBuiltinRecipe = structuredClone(builtinRecipe);
    injectedBuiltinRecipe.output.clientInject.push(builtin);
    assert.throws(
      () => validateHostedAdaptationRecipe(injectedBuiltinRecipe),
      /client inject contains a reserved or Node builtin/u,
      `recipe client inject ${builtin}`
    );
    const files = new Map(safe);
    files.set('index.mjs', Buffer.from(
      `export default require(${JSON.stringify(builtin)})\n`
    ));
    assert.throws(
      () => validateHostedScriptEntries(files, builtinRecipe),
      /absent from exact peerDependencies/u,
      `require declared Node builtin ${builtin}`
    );
  }
});

test('checked-in hosted adaptation assets and probes remain exactly recipe-bound', async () => {
  const expected = new Map([
    [3004, {
      packageName: '@dsh-themes/dsh-spotlight',
      packageVersion: '0.0.2-dsh.alpha2.1',
      commit: 'dd7ef5ed160aa1a624559de16eafd4ea9406d7ed',
      tree: '7a5fb2e5e2275cd194d47f6340aa73a0edf42991',
    }],
    [3006, {
      packageName: '@dsh-themes/dsh-better-model-selector',
      packageVersion: '1.0.0-dsh.alpha2.1',
      commit: '4781f4c215f1ad4d55a44e1409bafe58f05b721f',
      tree: '8840140ed08a525005e3468348e8d5370416e371',
    }],
    [3008, {
      packageName: '@dsh-themes/dsh-view-modes',
      packageVersion: '1.0.0-dsh.alpha2.1',
      commit: 'a57d237e03b6488875cb7cc2a90bf6a37512632d',
      tree: '5f84cf31a180a1aced2496e8e391f0751d836e41',
    }],
    [3010, {
      packageName: '@dsh-themes/dsh-openpencil',
      packageVersion: '0.1.0-dsh.alpha2.1',
      commit: 'df71f28b8e29c76a7785e50461bc1065cdb5a899',
      tree: '902f49e8877d4364cffd36d6a20af6defa68fde8',
    }],
    [3011, {
      packageName: '@dsh-themes/arcana',
      packageVersion: '0.1.0-dsh.alpha2.1',
      commit: '82f910c0b5e645c65c2a34be0b0e47035d0489a7',
      tree: '36cb0b3210b87a8c57d9d13845d8b1564842b126',
    }],
    [3017, {
      packageName: '@dsh-themes/plugin-list-plus',
      packageVersion: '0.1.0-dsh.alpha2.1',
      commit: 'f62e6ba7be47f42accae372bb84dc879972d071a',
      tree: '8fa40ba5c5f3ba78a54db05a39487b4a79a81f34',
    }],
    [3040, {
      packageName: '@dsh-themes/dsh-kanban',
      packageVersion: '0.1.1-dsh.alpha2.1',
      commit: 'f7fa24c14db47ee4827cad5c827ad7aa3fd13434',
      tree: '322fe7f98155d8cee98918f235ce4602ffe3cbc3',
    }],
    [3041, {
      packageName: '@dsh-themes/context-vista',
      packageVersion: '0.1.0-dsh.alpha2.1',
      commit: 'fdde2e6da8524cd5ea27598c19eae744d4a1078a',
      tree: '1dcfc8e5952365ec142eafcc6ddd007e0b6fb6b5',
    }],
    [3042, {
      packageName: '@dsh-themes/dsh-wikilink',
      packageVersion: '0.2.0-dsh.alpha2.1',
      commit: '7f0203b6690588f30b7a9a35af37c1978a7caacc',
      tree: 'aefb3d89dd6dffb9b3a0b5b43adfbbe6a1c5b4e3',
    }],
    [3050, {
      packageName: '@dsh-themes/dsh-automation',
      packageVersion: '0.1.7-dsh.alpha2.1',
      commit: '5ae28f209c0253461131613fc1b2ea27920bec67',
      tree: 'ac7485a58d484abf6149681403c307958e8214ac',
    }],
  ]);
  const reviewedReactTags = new Set();
  const reviewedReactComponents = new Set();
  const reviewedReactProperties = new Set();
  for (const [catalogId, identity] of expected) {
    const context = await loadHostedAdaptation(catalogId);
    const reviewedScripts = new Map();
    assert.equal(context.recipe.catalogId, catalogId);
    assert.equal(context.recipe.output.packageName, identity.packageName);
    assert.equal(context.recipe.output.packageVersion, identity.packageVersion);
    assert.equal(context.recipe.source.commit, identity.commit);
    assert.equal(context.recipe.source.tree, identity.tree);

    for (const file of context.recipe.output.files) {
      if (file.input.kind !== 'reviewed-replacement') continue;
      const bytes = await readFile(new URL(
        `../skills/dsh-plugin-installer/${file.input.replacementPath}`,
        import.meta.url
      ));
      assert.equal(sha256(bytes), file.input.replacementSha256, `${catalogId}:${file.outputPath}`);
      if (/\.(?:js|mjs|cjs)$/u.test(file.outputPath)) {
        reviewedScripts.set(file.outputPath, bytes);
        reviewedReactSurface(
          bytes.toString('utf8'),
          reviewedReactTags,
          reviewedReactComponents,
          reviewedReactProperties
        );
      }
    }
    assert.equal(validateHostedScriptEntries(reviewedScripts, context.recipe).size, 2);
    const probeBytes = await readFile(new URL(
      `../skills/dsh-plugin-installer/${context.recipe.runtimeProbe.contractPath}`,
      import.meta.url
    ));
    assert.equal(sha256(probeBytes), context.recipe.runtimeProbe.contractSha256);
    const probe = validatePluginRuntimeProbe(JSON.parse(probeBytes));
    assert.equal(probe.candidateExecuted, false);
    assert.deepEqual(
      probe.assertions.map((assertion) => assertion.id),
      context.recipe.runtimeProbe.requiredAssertions
    );
  }
  assert.deepEqual(
    [...reviewedReactTags].toSorted(),
    REVIEWED_REACT_CREATE_ELEMENT_POLICY.intrinsicTags
  );
  assert.deepEqual([...reviewedReactComponents], ['React.Fragment']);
  assert.deepEqual(
    [...reviewedReactProperties].toSorted(),
    REVIEWED_REACT_CREATE_ELEMENT_POLICY.propertyNames
  );
});

test('#3006 reviewed bundle statically owns one reversible model seat and official services', async () => {
  const bundle = await readFile(new URL(
    '../skills/dsh-plugin-installer/assets/hosted-adaptations/3006/lib/client.js',
    import.meta.url
  ), 'utf8');
  assert.match(bundle, /id: '@dsh-themes\/dsh-better-model-selector'/u);
  assert.match(
    bundle,
    /const inject = \['slots', 'sessions', 'modelDirectories', 'locale', 'settingsScope'\]/u
  );
  assert.match(bundle, /ctx\.settingsScope\.bind\(\{[\s\S]+namespace: SETTINGS_NAMESPACE/u);
  assert.match(bundle, /ctx\.modelDirectories\.directoryFor\(sessionId\)/u);
  assert.match(bundle, /ctx\.slots\.inject\('conversation\.input\.model'/u);
  assert.match(bundle, /name: 'conversation\.input\.model',[\s\S]+priority: -1/u);
  assert.match(bundle, /ctx\.locale\.register\(LOCALE_NAMESPACE/u);
  assert.match(bundle, /return function \(\) \{ favorites\.dispose\(\) \}/u);
  assert.match(bundle, /return function \(\) \{ tag\.remove\(\) \}/u);
  assert.doesNotMatch(
    bundle,
    /@deepseek-ai\/dsh-client-runtime|ctx\.remote|ctx\.connection|fetch\(|WebSocket|localStorage|document\.cookie|innerHTML/u
  );
});

test('#3008 reviewed bundle is one real alpha.2 read-only Chat projection View', async () => {
  const [{ recipe }, bundle] = await Promise.all([
    loadHostedAdaptation(3008),
    readFile(new URL(
      '../skills/dsh-plugin-installer/assets/hosted-adaptations/3008/lib/client.js',
      import.meta.url
    ), 'utf8'),
  ]);
  assert.deepEqual(recipe.output.clientInject, [
    '@deepseek-ai/dsh-api-session-controller',
    '@deepseek-ai/dsh-client-locale',
    '@deepseek-ai/dsh-client-ui-chat',
    '@deepseek-ai/dsh-client-ui-conversation',
    '@deepseek-ai/dsh-client-ui-renderer',
    '@deepseek-ai/dsh-client-ui-session',
  ]);
  assert.deepEqual(Object.keys(recipe.output.peerDependencies), [
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-api-session-controller',
    '@deepseek-ai/dsh-client-locale',
    '@deepseek-ai/dsh-client-ui-chat',
    '@deepseek-ai/dsh-client-ui-conversation',
    '@deepseek-ai/dsh-client-ui-renderer',
    '@deepseek-ai/dsh-client-ui-session',
    'react',
  ]);
  assert.match(bundle, /id: '@dsh-themes\/dsh-view-modes'/u);
  assert.match(bundle, /const inject = \['slots', 'uiConversation', 'locale'\]/u);
  assert.match(bundle, /ctx\.slots\.inject\('conversation\.view'/u);
  assert.match(
    bundle,
    /name: 'conversation\.view',[\s\S]+id: VIEW_ID,[\s\S]+order: 20,[\s\S]+label: function \(\) \{ return t\('tab'\) \},[\s\S]+locale: NS/u
  );
  assert.match(
    bundle,
    /inject: function \(sessionId\) \{[\s\S]+hooks: \{[\s\S]+viewChat: ctx\.uiConversation\.binding\(sessionId\)\.target\('chat'\)/u
  );
  assert.match(
    bundle,
    /props\.useViewChat\(function \(snapshot\) \{[\s\S]+snapshot\.navigation\.items\(\)/u
  );
  assert.match(bundle, /const \[mode, setMode\] = React\.useState\('normal'\)/u);
  assert.match(bundle, /if \(mode === 'summary'\) return items\.slice\(-1\)/u);
  assert.match(bundle, /if \(mode === 'normal'\) return items\.slice\(-NORMAL_TURN_LIMIT\)/u);
  assert.match(bundle, /React\.createElement\('article'/u);
  assert.match(bundle, /React\.createElement\('header'/u);
  assert.match(bundle, /React\.createElement\('ul'/u);
  assert.match(bundle, /React\.createElement\('li'/u);
  assert.match(bundle, /'aria-pressed': mode === entry/u);
  assert.match(bundle, /ctx\.locale\.register\(NS, \{ zh, en \}\)/u);
  assert.doesNotMatch(
    bundle,
    /uiConversation\.views\.register|conversation\.phase|props\.useConversation|props\.useSessions|document\.|style:|fetch\(|XMLHttpRequest|WebSocket|EventSource|localStorage|sessionStorage|document\.cookie|ctx\.remote|ctx\.connection|node:fs|node:child_process/u
  );
});

test('#3010 reviewed bundle exposes only explicit .op path-to-draft review actions', async () => {
  const [{ recipe }, bundle] = await Promise.all([
    loadHostedAdaptation(3010),
    readFile(new URL(
      '../skills/dsh-plugin-installer/assets/hosted-adaptations/3010/lib/client.js',
      import.meta.url
    ), 'utf8'),
  ]);
  assert.equal(
    recipe.source.manifestSha256,
    'd942a0a9d0a7a3ef81ca86687f0fbd7e08970445cea658e3768dfecd85c6edac'
  );
  assert.equal(
    recipe.rights.licenseSha256,
    '07810262dcd2df061e16ae24c3a9a7a3cd265ddfc2bfb073544cd11af22d7812'
  );
  assert.deepEqual(
    recipe.output.files.map((file) => [
      file.outputPath,
      file.input.sourcePath,
      file.input.sourceSha256 ?? file.input.sha256,
    ]),
    [
      ['lib/index.js', 'src/index.ts', '8f649bfd2aacaa714e7a8c57728ee2fa043fb30d3f0157e3b2effff838f25015'],
      ['lib/client.js', 'src/client/index.tsx', '6a258a7f036a36a17696cc0505eecb9620855c0f76e29d6251cb0eae0b0cd262'],
      ['cordis.patch.yml', 'cordis.patch.yml', '224785e0a3f0b7f06774f0c10fffcb8c3e6c5ab5e57187941418e4bedf50341d'],
      ['LICENSE', 'LICENSE', '07810262dcd2df061e16ae24c3a9a7a3cd265ddfc2bfb073544cd11af22d7812'],
    ]
  );
  assert.match(bundle, /id: '@dsh-themes\/dsh-openpencil'/u);
  assert.match(bundle, /const inject = \['slots', 'locale', 'remote', 'remote\.fileReferences'\]/u);
  assert.match(bundle, /ctx\.remote\.fileReferences\.list\(sessionId, query, signal\)/u);
  assert.match(bundle, /ctx\.slots\.inject\('conversation\.input\.overlay'/u);
  assert.match(bundle, /id: 'dsh-openpencil-review-picker'/u);
  assert.match(bundle, /candidate\.kind !== 'file'/u);
  assert.match(bundle, /\.endsWith\('\.op'\)/u);
  assert.match(bundle, /props\.inputActions\.setDraft/u);
  assert.match(bundle, /mode === 'review' \? 'reviewPrompt' : 'planPrompt'/u);
  assert.match(bundle, /new AbortController\(\)/u);
  assert.match(bundle, /ctx\.locale\.register\(NS, \{ zh, en \}\)/u);
  assert.doesNotMatch(
    bundle,
    /@deepseek-ai\/dsh-client-runtime|ctx\.fs|ctx\.tools|ctx\.sessions|ctx\.connection|fetch\(|WebSocket|localStorage|sessionStorage|document\.|window\.location|innerHTML|node:fs|node:path|node:child_process|process\.env/u
  );
});

test('#3011 reviewed bundle is an explicit memory-only deck over the Commands Remote', async () => {
  const [{ recipe }, bundle] = await Promise.all([
    loadHostedAdaptation(3011),
    readFile(new URL(
      '../skills/dsh-plugin-installer/assets/hosted-adaptations/3011/lib/client.js',
      import.meta.url
    ), 'utf8'),
  ]);
  assert.equal(
    recipe.source.manifestSha256,
    'cc8aaa5902d470caa148e8f632c736ca596e7d76f4352740cc84c113cf2297b2'
  );
  assert.equal(
    recipe.rights.licenseSha256,
    '29ca4f9a12bad476f6d9f0187e501a9095315ba1dc6bfb40ba9d9f7cefaa4ecb'
  );
  assert.deepEqual(
    recipe.output.files.map((file) => [
      file.outputPath,
      file.input.sourcePath,
      file.input.sourceSha256 ?? file.input.sha256,
    ]),
    [
      ['lib/index.js', 'lib/index.js', '013e1bc291f4c03bb703c3ec3e13795bcc0dca62d33215a9a6e89cf0a43516f8'],
      ['lib/client.js', 'lib/client.js', '0a95bcde5551c0d84577add03a1c3b9732633363e81961d6a36f54b648e390c2'],
      ['cordis.patch.yml', 'cordis.patch.yml', '1ea4d61f445815f60619ef896b7d8e57c7b0b50ac97b46ffd520a58eef4cdc3d'],
      ['LICENSE', 'LICENSE', '29ca4f9a12bad476f6d9f0187e501a9095315ba1dc6bfb40ba9d9f7cefaa4ecb'],
    ]
  );
  assert.match(bundle, /id: '@dsh-themes\/arcana'/u);
  assert.match(bundle, /const inject = \['slots', 'sessions', 'locale', 'remote', 'remote\.commands'\]/u);
  assert.match(bundle, /ctx\.remote\.commands\.list\(sessionId\)/u);
  assert.match(bundle, /ctx\.remote\.commands\.execute\(sessionId, line, \[\], signal\)/u);
  assert.match(bundle, /ctx\.slots\.inject\('sidebar\.footer\.action'/u);
  assert.match(bundle, /id: 'arcana-command-deck-trigger'/u);
  assert.match(bundle, /ctx\.slots\.inject\('shell\.overlay'/u);
  assert.match(bundle, /id: 'arcana-command-deck'/u);
  assert.match(bundle, /const \[usage, setUsage\] = React\.useState\(function \(\) \{ return \[\] \}\)/u);
  assert.match(bundle, /usageCount\(usage, right\.name\) - usageCount\(usage, left\.name\)/u);
  assert.match(bundle, /command\.input === undefined/u);
  assert.match(bundle, /new AbortController\(\)/u);
  assert.match(bundle, /sessions\.current !== selectedSessionId/u);
  assert.match(bundle, /currentSession\.current = sessions\.current/u);
  assert.match(bundle, /currentSession\.current !== requestedSessionId/u);
  assert.match(bundle, /view\.sessionId === sessions\.current/u);
  assert.match(bundle, /view\.sessionId !== sessionId/u);
  assert.match(bundle, /choose\(command, currentView\.sessionId\)/u);
  assert.match(bundle, /setSelected\(Object\.freeze\(\{ command, sessionId \}\)\)/u);
  assert.match(bundle, /result\.value\.result\.kind === 'success'/u);
  assert.match(
    bundle,
    /React\.useEffect\(function \(\) \{[\s\S]{0,300}setSelected\(null\)[\s\S]{0,160}setArgument\(''\)[\s\S]{0,160}setMessage\(''\)[\s\S]{0,100}\}, \[sessions\.current\]\)/u
  );
  assert.match(bundle, /ctx\.effect\(function \(\) \{ return controller\.dispose \}/u);
  assert.match(bundle, /ctx\.locale\.register\(NS, \{ zh, en \}\)/u);
  assert.doesNotMatch(
    bundle,
    /@deepseek-ai\/dsh-client-runtime|session\.command\(|remote\.\$on|ctx\.fs|ctx\.tools|ctx\.connection|fetch\(|WebSocket|localStorage|sessionStorage|document\.|window\.location|innerHTML|node:fs|node:path|node:child_process|process\.env|console\./u
  );
});

test('#3017 reviewed browser bundle statically binds React and reversible additive ownership', async () => {
  const bundle = await readFile(new URL(
    '../skills/dsh-plugin-installer/assets/hosted-adaptations/3017/client.js',
    import.meta.url
  ), 'utf8');
  assert.match(bundle, /id: "@dsh-themes\/plugin-list-plus"/u);
  assert.match(bundle, /require\("react"\)/u);
  assert.match(bundle, /var inject = \["slots", "locale", "remote", "remote\.pluginInventory"\]/u);
  assert.match(bundle, /ctx\.remote\.pluginInventory\.list\(\)/u);
  assert.match(bundle, /ctx\.slots\.inject\("settings\.plugins\.tab"/u);
  assert.match(bundle, /name: "settings\.plugins\.tab"[\s\S]+id: "dsh-themes-plus"/u);
  assert.match(bundle, /ctx\.locale\.register\(NS/u);
  assert.match(bundle, /tag\.remove\(\)/u);
  assert.doesNotMatch(
    bundle,
    /fetch\(|WebSocket|localStorage|document\.cookie|innerHTML|node:fs|node:child_process/u
  );
});

test('#3040 reviewed bundle preserves a reversible five-column board on official alpha.2 slots', async () => {
  const [{ recipe }, bundle] = await Promise.all([
    loadHostedAdaptation(3040),
    readFile(new URL(
      '../skills/dsh-plugin-installer/assets/hosted-adaptations/3040/lib/client.js',
      import.meta.url
    ), 'utf8'),
  ]);
  assert.equal(
    recipe.source.manifestSha256,
    'e2a91d09eb4978e2ac75e9e742044e57f39e37015b08a4867114e2f19171dbf8'
  );
  assert.equal(
    recipe.rights.licenseSha256,
    'cbc550d2e5a273ed1ad52ea1f4a9dbc991032bed8bc3203e8f81f6f72cd9b6f2'
  );
  assert.deepEqual(
    recipe.output.files.map((file) => [
      file.outputPath,
      file.input.sourcePath,
      file.input.sourceSha256 ?? file.input.sha256,
    ]),
    [
      [
        'lib/index.js',
        'src/index.ts',
        '88e6c394e8980a82a76acb0a22c26b8b846336ab83fce23d7fdf03eac9ee727b',
      ],
      [
        'lib/client.js',
        'src/client/Kanban.tsx',
        '871a37d663af144372339c5290f1a55322eeb26a0171d4b096de6f77a4577b3e',
      ],
      [
        'cordis.patch.yml',
        'cordis.patch.yml',
        '929ab1a18725d614ecc83c2a54d2f7303c900ba582413eba2e70efc822c338e8',
      ],
      [
        'LICENSE',
        'LICENSE',
        'cbc550d2e5a273ed1ad52ea1f4a9dbc991032bed8bc3203e8f81f6f72cd9b6f2',
      ],
    ]
  );
  assert.match(bundle, /id: '@dsh-themes\/dsh-kanban'/u);
  assert.match(bundle, /var React = require\('react'\)/u);
  assert.match(bundle, /const inject = \['slots', 'sessions', 'locale'\]/u);
  assert.match(
    bundle,
    /Object\.freeze\(\['inbox', 'ready', 'running', 'blocked', 'done'\]\)/u
  );
  assert.match(bundle, /props\.useSessions\(function \(state\) \{ return state \}\)/u);
  assert.match(
    bundle,
    /props\.useSessionPendingInteraction\(function \(state\) \{ return state \}\)/u
  );
  assert.match(bundle, /React\.useSyncExternalStore\(/u);
  assert.match(bundle, /ctx\.slots\.inject\('sidebar\.footer\.action'/u);
  assert.match(bundle, /name: 'sidebar\.footer\.action',[\s\S]+id: 'dsh-kanban-trigger'/u);
  assert.match(bundle, /ctx\.slots\.inject\('shell\.overlay'/u);
  assert.match(bundle, /name: 'shell\.overlay',[\s\S]+id: 'dsh-kanban-board'/u);
  assert.match(bundle, /ctx\.sessions\.open\(sessionId\)/u);
  assert.match(bundle, /ctx\.sessions\.clear\(\)/u);
  assert.match(bundle, /'data-dsh-kanban-ephemeral': PROBES\.ephemeral/u);
  assert.match(bundle, /ctx\.locale\.register\(NS, \{ zh, en \}\)/u);
  assert.match(bundle, /return function \(\) \{ tag\.remove\(\) \}/u);
  assert.match(bundle, /ctx\.effect\(function \(\) \{ return controller\.dispose \}/u);
  assert.match(bundle, /:not\(\[tabindex="-1"\]\)/u);
  assert.match(bundle, /returnFocusTarget = candidate/u);
  assert.match(bundle, /target\.isConnected === true/u);
  assert.match(bundle, /target\.focus\(\)/u);
  assert.doesNotMatch(
    bundle,
    /@deepseek-ai\/dsh-client-runtime|ctx\.remote|ctx\.connection|ctx\.uiWorkspace|ctx\.workspaces|fetch\(|WebSocket|localStorage|sessionStorage|document\.cookie|window\.location|history\.|createPortal|data-conversation-scroll|innerHTML|node:fs|node:child_process/u
  );
});

test('#3041 reviewed browser bundle is a reversible read-only three-projection view', async () => {
  const bundle = await readFile(new URL(
    '../skills/dsh-plugin-installer/assets/hosted-adaptations/3041/lib/client.js',
    import.meta.url
  ), 'utf8');
  assert.match(bundle, /id: '@dsh-themes\/context-vista'/u);
  assert.match(bundle, /var React = require\('react'\)/u);
  assert.match(bundle, /const inject = \['slots', 'locale'\]/u);
  assert.match(bundle, /props\.useProjection\('tokenUsage'\)/u);
  assert.match(bundle, /props\.useProjection\('contextPressure'\)/u);
  assert.match(bundle, /props\.useProjection\('contextBreakdown'\)/u);
  assert.match(bundle, /ctx\.slots\.inject\('conversation\.input\.dock'/u);
  assert.match(bundle, /name: 'conversation\.input\.dock',[\s\S]+id: 'context-vista'/u);
  assert.match(bundle, /ctx\.locale\.register\(NS, \{ zh, en \}\)/u);
  assert.match(bundle, /return function \(\) \{ tag\.remove\(\) \}/u);
  assert.doesNotMatch(
    bundle,
    /@deepseek-ai\/dsh-client-runtime|ctx\.remote|ctx\.connection|fetch\(|WebSocket|localStorage|document\.cookie|innerHTML|node:fs|node:child_process/u
  );
});

test('#3042 reviewed browser bundle writes one standard reference from the official path-only index', async () => {
  const bundle = await readFile(new URL(
    '../skills/dsh-plugin-installer/assets/hosted-adaptations/3042/lib/client.js',
    import.meta.url
  ), 'utf8');
  assert.match(bundle, /id: '@dsh-themes\/dsh-wikilink'/u);
  assert.match(bundle, /var React = require\('react'\)/u);
  assert.match(bundle, /const inject = \['slots', 'locale', 'remote', 'remote\.fileReferences'\]/u);
  assert.match(bundle, /ctx\.remote\.fileReferences\.list\(sessionId, query, signal\)/u);
  assert.match(bundle, /ctx\.slots\.inject\('conversation\.input\.overlay'/u);
  assert.match(bundle, /name: 'conversation\.input\.overlay',[\s\S]+id: 'dsh-wikilink-picker'/u);
  assert.match(bundle, /candidate\.kind !== 'file'/u);
  assert.match(bundle, /props\.inputActions\.setDraft\(/u);
  assert.match(bundle, /new AbortController\(\)/u);
  assert.match(bundle, /ctx\.locale\.register\(NS, \{ zh, en \}\)/u);
  assert.match(bundle, /return function \(\) \{ tag\.remove\(\) \}/u);
  assert.doesNotMatch(
    bundle,
    /@deepseek-ai\/dsh-client-runtime|ctx\.remote\.\$mount|ctx\.typert|agent\/pre-step|fetch\(|WebSocket|localStorage|sessionStorage|document\.cookie|addEventListener\(|innerHTML|node:fs|node:path|node:child_process/u
  );
});

test('#3050 reviewed bundle keeps plans in memory and delegates only after explicit clicks', async () => {
  const bundle = await readFile(new URL(
    '../skills/dsh-plugin-installer/assets/hosted-adaptations/3050/lib/client.js',
    import.meta.url
  ), 'utf8');
  assert.match(bundle, /id: '@dsh-themes\/dsh-automation'/u);
  assert.match(bundle, /const inject = \['slots', 'sessions', 'locale'\]/u);
  assert.match(bundle, /const \[plans, setPlans\] = React\.useState\(function \(\) \{ return \[\] \}\)/u);
  assert.match(bundle, /ctx\.sessions\.binding\(sessionId\)/u);
  assert.match(bundle, /session\.beginSubmission\(\{ text, images: \[\] \}\)/u);
  assert.match(bundle, /session\.prompt\(\[\{ type: 'text', text \}\], 'queue', signal, handle\.requestId\)/u);
  assert.match(bundle, /schedule_create/u);
  assert.match(bundle, /sessions\.currentAddress === undefined/u);
  assert.match(bundle, /currentSummary\.origin !== 'subagent'/u);
  assert.match(bundle, /const currentId = regularRootSessionId\(sessions\)/u);
  assert.match(bundle, /const session = currentId === undefined \? undefined : props\.sessionFor\(currentId\)/u);
  assert.match(bundle, /if \(session === undefined\) \{ setMessage\(props\.t\('noSession'\)\); return \}/u);
  assert.match(bundle, /DSH3050_PROBE:ROOT_SESSION_ONLY_V1/u);
  assert.match(bundle, /DSH3050_PROBE:INHERITED_SESSION_PERMISSIONS_V1/u);
  assert.match(bundle, /cannot call or constrain tools/u);
  assert.match(bundle, /inherits the root session/u);
  assert.match(bundle, /network, process, or file actions/u);
  assert.match(bundle, /onClick: function \(\) \{ void act\('run', plan\) \}/u);
  assert.match(bundle, /onClick: function \(\) \{ void act\('schedule', plan\) \}/u);
  assert.match(bundle, /ctx\.slots\.inject\('sidebar\.footer\.action'/u);
  assert.match(bundle, /ctx\.slots\.inject\('shell\.overlay'/u);
  assert.match(bundle, /ctx\.effect\(function \(\) \{ return controller\.dispose \}/u);
  assert.match(bundle, /return function \(\) \{ tag\.remove\(\) \}/u);
  assert.doesNotMatch(
    bundle,
    /@deepseek-ai\/dsh-client-runtime|@deepseek-ai\/dsh-host-apiproxy|ctx\.storage|ctx\.agents|ctx\.tools|ctx\.subprocess|fetch\(|XMLHttpRequest|WebSocket|EventSource|localStorage|sessionStorage|document\.cookie|setInterval|setTimeout|node:fs|node:child_process/u
  );
});

test('#3050 root-session gate behavior rejects subagents, addressed sessions, and missing summaries', async () => {
  const bundle = await readFile(new URL(
    '../skills/dsh-plugin-installer/assets/hosted-adaptations/3050/lib/client.js',
    import.meta.url
  ), 'utf8');
  let definition;
  runInNewContext(bundle, {
    window: {
      __ModuleLoader__: {
        load(value) { definition = value; },
      },
    },
  });
  assert.equal(definition.id, '@dsh-themes/dsh-automation');
  const exports = definition.factory((name) => {
    assert.equal(name, 'react');
    return {};
  });
  const select = exports.reviewRegularRootSessionId;
  assert.equal(typeof select, 'function');
  assert.equal(select({ current: 'root', currentAddress: undefined, byId: { root: { origin: 'user' } } }), 'root');
  assert.equal(select({ current: 'fork', currentAddress: undefined, byId: { fork: { origin: 'fork' } } }), 'fork');
  assert.equal(select({ current: 'sub', currentAddress: undefined, byId: { sub: { origin: 'subagent' } } }), undefined);
  assert.equal(select({ current: 'root', currentAddress: ['nested'], byId: { root: { origin: 'user' } } }), undefined);
  assert.equal(select({ current: 'missing', currentAddress: undefined, byId: {} }), undefined);
  assert.equal(select({ current: undefined, currentAddress: undefined, byId: {} }), undefined);
});

test('reviewed browser adaptations carry complete, reversible eight-locale dictionaries', async () => {
  const localeVariables = ['en', 'zh', 'zhHant', 'ja', 'ko', 'fr', 'de', 'es'];
  const expectedExtraLocales = ['zh-Hant', 'ja', 'ko', 'fr', 'de', 'es'];
  const cases = [
    {
      id: 3004,
      url: '../skills/dsh-plugin-installer/assets/hosted-adaptations/3004/lib/client.js',
      style: 'freeze',
      expectedKeys: 17,
      expectedModelPlaceholders: 0,
      expectedMessagePlaceholders: 0,
      register: /disposers\.push\(ctx\.locale\.register\(NS, \{ zh, en \}\)\)[\s\S]+for \(const \[locale, dictionary\] of EXTRA_DICTIONARIES\) disposers\.push\(ctx\.locale\.register\(NS, locale, dictionary\)\)[\s\S]+for \(let index = disposers\.length - 1; index >= 0; index -= 1\) disposers\.at\(index\)\(\)/u,
    },
    {
      id: 3006,
      url: '../skills/dsh-plugin-installer/assets/hosted-adaptations/3006/lib/client.js',
      style: 'freeze',
      expectedKeys: 29,
      expectedModelPlaceholders: 2,
      expectedMessagePlaceholders: 3,
      register: /disposers\.push\(ctx\.locale\.register\(LOCALE_NAMESPACE, \{ zh, en \}\)\)[\s\S]+for \(const \[locale, dictionary\] of EXTRA_DICTIONARIES\)[\s\S]+disposers\.push\(ctx\.locale\.register\(LOCALE_NAMESPACE, locale, dictionary\)\)[\s\S]+for \(let index = disposers\.length - 1; index >= 0; index -= 1\) disposers\.at\(index\)\(\)/u,
    },
    {
      id: 3008,
      url: '../skills/dsh-plugin-installer/assets/hosted-adaptations/3008/lib/client.js',
      style: 'freeze',
      expectedKeys: 17,
      expectedModelPlaceholders: 0,
      expectedMessagePlaceholders: 0,
      register: /disposers\.push\(ctx\.locale\.register\(NS, \{ zh, en \}\)\)[\s\S]+for \(const \[locale, dictionary\] of EXTRA_DICTIONARIES\)[\s\S]+if \(disposed\) return[\s\S]+for \(let index = disposers\.length - 1; index >= 0; index -= 1\) disposers\.at\(index\)\(\)/u,
    },
    {
      id: 3010,
      url: '../skills/dsh-plugin-installer/assets/hosted-adaptations/3010/lib/client.js',
      style: 'freeze',
      expectedKeys: 11,
      expectedModelPlaceholders: 0,
      expectedMessagePlaceholders: 0,
      register: /disposers\.push\(ctx\.locale\.register\(NS, \{ zh, en \}\)\)[\s\S]+for \(const \[locale, dictionary\] of EXTRA_DICTIONARIES\) disposers\.push\(ctx\.locale\.register\(NS, locale, dictionary\)\)[\s\S]+for \(let index = disposers\.length - 1; index >= 0; index -= 1\) disposers\.at\(index\)\(\)/u,
    },
    {
      id: 3011,
      url: '../skills/dsh-plugin-installer/assets/hosted-adaptations/3011/lib/client.js',
      style: 'freeze',
      expectedKeys: 15,
      expectedModelPlaceholders: 0,
      expectedMessagePlaceholders: 0,
      register: /disposers\.push\(ctx\.locale\.register\(NS, \{ zh, en \}\)\)[\s\S]+for \(const \[locale, dictionary\] of EXTRA_DICTIONARIES\) disposers\.push\(ctx\.locale\.register\(NS, locale, dictionary\)\)[\s\S]+for \(let index = disposers\.length - 1; index >= 0; index -= 1\) disposers\.at\(index\)\(\)/u,
    },
    {
      id: 3017,
      label: 'reviewed source',
      url: '../skills/dsh-plugin-installer/assets/hosted-adaptations/3017/client/index.tsx',
      style: 'plain',
      expectedKeys: 27,
      expectedModelPlaceholders: 0,
      expectedMessagePlaceholders: 0,
      register: /disposers\.push\(ctx\.locale\.register\(NS, \{ zh, en \}\)\)[\s\S]+for \(const \[locale, dictionary\] of EXTRA_DICTIONARIES\)[\s\S]+disposers\.push\(ctx\.locale\.register\(NS, locale, dictionary\)\)[\s\S]+for \(let index = disposers\.length - 1; index >= 0; index -= 1\) disposers\.at\(index\)\?\.\(\)/u,
    },
    {
      id: 3017,
      label: 'reviewed compiled bundle',
      url: '../skills/dsh-plugin-installer/assets/hosted-adaptations/3017/client.js',
      style: 'compiled',
      expectedKeys: 27,
      expectedModelPlaceholders: 0,
      expectedMessagePlaceholders: 0,
      register: /disposers\.push\(ctx\.locale\.register\(NS, \{ zh, en \}\)\);[\s\S]+for \(const \[locale, dictionary\] of EXTRA_DICTIONARIES\)[\s\S]+disposers\.push\(ctx\.locale\.register\(NS, locale, dictionary\)\);[\s\S]+for \(let index = disposers\.length - 1; index >= 0; index -= 1\) disposers\.at\(index\)\?\.\(\);/u,
    },
    {
      id: 3040,
      url: '../skills/dsh-plugin-installer/assets/hosted-adaptations/3040/lib/client.js',
      style: 'freeze',
      expectedKeys: 26,
      expectedModelPlaceholders: 0,
      expectedMessagePlaceholders: 0,
      register: /disposers\.push\(ctx\.locale\.register\(NS, \{ zh, en \}\)\)[\s\S]+for \(const \[locale, dictionary\] of EXTRA_DICTIONARIES\)[\s\S]+disposers\.push\(ctx\.locale\.register\(NS, locale, dictionary\)\)[\s\S]+for \(let index = disposers\.length - 1; index >= 0; index -= 1\) disposers\.at\(index\)\(\)/u,
    },
    {
      id: 3041,
      url: '../skills/dsh-plugin-installer/assets/hosted-adaptations/3041/lib/client.js',
      style: 'freeze',
      expectedKeys: 15,
      expectedModelPlaceholders: 0,
      expectedMessagePlaceholders: 0,
      register: /disposers\.push\(ctx\.locale\.register\(NS, \{ zh, en \}\)\)[\s\S]+for \(const \[locale, dictionary\] of EXTRA_DICTIONARIES\)[\s\S]+disposers\.push\(ctx\.locale\.register\(NS, locale, dictionary\)\)[\s\S]+for \(let index = disposers\.length - 1; index >= 0; index -= 1\) disposers\.at\(index\)\(\)/u,
    },
    {
      id: 3042,
      url: '../skills/dsh-plugin-installer/assets/hosted-adaptations/3042/lib/client.js',
      style: 'freeze',
      expectedKeys: 8,
      expectedModelPlaceholders: 0,
      expectedMessagePlaceholders: 0,
      register: /disposers\.push\(ctx\.locale\.register\(NS, \{ zh, en \}\)\)[\s\S]+for \(const \[locale, dictionary\] of EXTRA_DICTIONARIES\)[\s\S]+disposers\.push\(ctx\.locale\.register\(NS, locale, dictionary\)\)[\s\S]+for \(let index = disposers\.length - 1; index >= 0; index -= 1\) disposers\.at\(index\)\(\)/u,
    },
    {
      id: 3050,
      url: '../skills/dsh-plugin-installer/assets/hosted-adaptations/3050/lib/client.js',
      style: 'freeze',
      expectedKeys: 27,
      expectedModelPlaceholders: 0,
      expectedMessagePlaceholders: 0,
      register: /disposers\.push\(ctx\.locale\.register\(NS, \{ zh, en \}\)\)[\s\S]+for \(const \[locale, dictionary\] of EXTRA_DICTIONARIES\) disposers\.push\(ctx\.locale\.register\(NS, locale, dictionary\)\)[\s\S]+for \(let index = disposers\.length - 1; index >= 0; index -= 1\) disposers\.at\(index\)\(\)/u,
    },
  ];

  for (const fixture of cases) {
    const source = await readFile(new URL(fixture.url, import.meta.url), 'utf8');
    const blocks = localeVariables.map((variable) => localeBlock(source, variable, fixture.style));
    const keySets = blocks.map(localeKeys);
    assert.equal(keySets[0].length, fixture.expectedKeys, `#${fixture.id}:en key count`);
    for (const [index, keys] of keySets.entries()) {
      assert.deepEqual(keys, keySets[0], `#${fixture.id}:${localeVariables[index]} keys`);
      assert.equal(
        blocks[index].match(/\{model\}/gu)?.length ?? 0,
        fixture.expectedModelPlaceholders,
        `#${fixture.id}:${localeVariables[index]} {model}`
      );
      assert.equal(
        blocks[index].match(/\{message\}/gu)?.length ?? 0,
        fixture.expectedMessagePlaceholders,
        `#${fixture.id}:${localeVariables[index]} {message}`
      );
    }
    const extraBlock = source.match(/(?:const|var) EXTRA_DICTIONARIES[^=]*= [^[]*\[([\s\S]*?)\n\s*\]/u)?.[1];
    assert.ok(extraBlock, `#${fixture.id}: extra locale table`);
    assert.deepEqual(
      [...extraBlock.matchAll(/\[(?:'([^']+)'|"([^"]+)"),/gu)]
        .map((match) => match[1] ?? match[2]),
      expectedExtraLocales,
      `#${fixture.id}:${fixture.label ?? 'reviewed bundle'} extra locale order`
    );
    assert.match(source, fixture.register, `#${fixture.id}: reversible locale ownership`);
  }
});

test('#3004 refreshes official directories only when stable inputs change', async () => {
  const source = await readFile(new URL(
    '../skills/dsh-plugin-installer/assets/hosted-adaptations/3004/lib/client.js',
    import.meta.url
  ), 'utf8');
  assert.match(
    source,
    /\[visible, sessions\.current, props\.listCommands, props\.listPlugins\]/u
  );
  assert.match(source, /result\.value\.result\.kind === 'success'/u);
  assert.match(source, /currentSession\.current = sessions\.current/u);
  assert.match(source, /currentSession\.current !== requestedSessionId/u);
  assert.match(source, /view\.sessionId === currentViewSessionId/u);
  assert.match(source, /sessionId: currentView\.sessionId/u);
  assert.match(source, /view\.sessionId !== item\.sessionId/u);
  assert.match(source, /props\.executeCommand\(item\.sessionId, '\/' \+ item\.id\)/u);
  assert.match(source, /const t = ctx\.locale\.bind\(NS\)/u);
  assert.match(source, /description: t\('subtitle'\)/u);
  assert.match(source, /label: t\('trigger'\), detail: t\('subtitle'\)/u);
  assert.match(source, /document\.querySelector\(selector\)/u);
  assert.doesNotMatch(
    source,
    /description: 'Open the Spotlight|label: 'Open Spotlight'|detail: 'Search official directories'/u
  );
  assert.doesNotMatch(source, /\[visible, sessions\.current, props\]/u);
});

test('hosted adaptation CI matrix contains only immutable build-only identities', async () => {
  const plan = await loadHostedAdaptationPlan();
  assert.deepEqual(plan, [
    {
      catalogId: 3004,
      repository: '0xsline/dsh-spotlight',
      commit: 'dd7ef5ed160aa1a624559de16eafd4ea9406d7ed',
      tree: '7a5fb2e5e2275cd194d47f6340aa73a0edf42991',
      assetName: 'dsh-spotlight-0.0.2-dsh.alpha2.1.tgz',
    },
    {
      catalogId: 3006,
      repository: 'Khellendros97/dsh-better-model-selector',
      commit: '4781f4c215f1ad4d55a44e1409bafe58f05b721f',
      tree: '8840140ed08a525005e3468348e8d5370416e371',
      assetName: 'dsh-better-model-selector-1.0.0-dsh.alpha2.1.tgz',
    },
    {
      catalogId: 3008,
      repository: 'NigelYao/dsh-view-modes',
      commit: 'a57d237e03b6488875cb7cc2a90bf6a37512632d',
      tree: '5f84cf31a180a1aced2496e8e391f0751d836e41',
      assetName: 'dsh-view-modes-1.0.0-dsh.alpha2.1.tgz',
    },
    {
      catalogId: 3010,
      repository: 'ZSeven-W/dsh-openpencil',
      commit: 'df71f28b8e29c76a7785e50461bc1065cdb5a899',
      tree: '902f49e8877d4364cffd36d6a20af6defa68fde8',
      assetName: 'dsh-openpencil-0.1.0-dsh.alpha2.1.tgz',
    },
    {
      catalogId: 3011,
      repository: 'GooodWei/arcana',
      commit: '82f910c0b5e645c65c2a34be0b0e47035d0489a7',
      tree: '36cb0b3210b87a8c57d9d13845d8b1564842b126',
      assetName: 'arcana-0.1.0-dsh.alpha2.1.tgz',
    },
    {
      catalogId: 3017,
      repository: 'yibiner/dsh-plugin-list-plus',
      commit: 'f62e6ba7be47f42accae372bb84dc879972d071a',
      tree: '8fa40ba5c5f3ba78a54db05a39487b4a79a81f34',
      assetName: 'dsh-plugin-list-plus-0.1.0-dsh.alpha2.1.tgz',
    },
    {
      catalogId: 3040,
      repository: 'Ericwong5021/dsh-kanban',
      commit: 'f7fa24c14db47ee4827cad5c827ad7aa3fd13434',
      tree: '322fe7f98155d8cee98918f235ce4602ffe3cbc3',
      assetName: 'dsh-kanban-0.1.1-dsh.alpha2.1.tgz',
    },
    {
      catalogId: 3041,
      repository: 'GooodWei/context-vista',
      commit: 'fdde2e6da8524cd5ea27598c19eae744d4a1078a',
      tree: '1dcfc8e5952365ec142eafcc6ddd007e0b6fb6b5',
      assetName: 'context-vista-0.1.0-dsh.alpha2.1.tgz',
    },
    {
      catalogId: 3042,
      repository: 'zhaoscsc/dsh-wikilink',
      commit: '7f0203b6690588f30b7a9a35af37c1978a7caacc',
      tree: 'aefb3d89dd6dffb9b3a0b5b43adfbbe6a1c5b4e3',
      assetName: 'dsh-wikilink-0.2.0-dsh.alpha2.1.tgz',
    },
    {
      catalogId: 3050,
      repository: 'titanwings/dsh-automation',
      commit: '5ae28f209c0253461131613fc1b2ea27920bec67',
      tree: 'ac7485a58d484abf6149681403c307958e8214ac',
      assetName: 'dsh-automation-0.1.7-dsh.alpha2.1.tgz',
    },
  ]);
  const [workflow, ordinaryCi] = await Promise.all([
    readFile(new URL(
      '../.github/workflows/alpha2-plugin-hosted-adaptations.yml',
      import.meta.url
    ), 'utf8'),
    readFile(new URL('../.github/workflows/ci.yml', import.meta.url), 'utf8'),
  ]);
  assert.match(workflow, /Build twice without running candidate code/u);
  assert.match(workflow, /cmp .*hosted-a/u);
  assert.match(workflow, /candidateExecuted/u);
  assert.match(workflow, /paths:\n\s+- package\.json\n\s+- package-lock\.json/u);
  const exactAuthorityInstall = 'run: npm ci --ignore-scripts';
  assert.equal(workflow.split(exactAuthorityInstall).length - 1, 2);
  assert.match(workflow, /working-directory: authority\n        run: npm ci --ignore-scripts/u);
  assert.doesNotMatch(
    workflow.replaceAll(exactAuthorityInstall, 'run: authority-dependencies-only'),
    /\bnpm (?:ci|install|run)\b|\bpnpm\b|\byarn\b|\bbun\b|\bprepare\b|\bpostinstall\b/u
  );
  for (const source of [workflow, ordinaryCi]) {
    const uses = [...source.matchAll(/^[ \t]*(?:-[ \t]+)?uses:[ \t]+([^\s#]+)/gmu)]
      .map((match) => match[1]);
    assert.ok(uses.length > 0);
    assert.ok(uses.every((value) => /@[a-f0-9]{40}$/u.test(value)), uses.join(', '));
  }
  assert.match(ordinaryCi, /actions\/checkout@[a-f0-9]{40}[\s\S]+persist-credentials: false/u);
});
