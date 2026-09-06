import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import ts from 'typescript';

import { securePremiumHostSource } from './palette-api-security.mjs';

const require = createRequire(import.meta.url);
const esbuild = require(
  createRequire(require.resolve('tsx')).resolve('esbuild')
);
const root = path.dirname(fileURLToPath(import.meta.url));
const runtime =
  process.env.DSH_ALPHA_SOURCE ??
  path.join(os.homedir(), '.dsh-themes/runtimes/0.1.3-alpha.1');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const readJson = async (file) => JSON.parse(await readFile(file, 'utf8'));
const outRoot = path.join(root, 'packages');
const persistence = await readFile(
  path.join(root, 'palette-persistence.js'),
  'utf8'
);
const catalogSlugs = [
  'catppuccin-mocha',
  'gruvbox-dark',
  'everforest',
  'rose-pine',
  'solarized-dark',
  'kanagawa',
  'tokyo-night',
  'tokyo-storm',
  'night-owl',
  'nord',
  'dracula',
  'one-dark',
];
const built = [];

function literal(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
    return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isArrayLiteralExpression(node)) return node.elements.map(literal);
  if (ts.isObjectLiteralExpression(node))
    return Object.fromEntries(
      node.properties.map((property) => {
        if (!ts.isPropertyAssignment(property))
          throw new Error('Only data properties are accepted');
        return [property.name.text, literal(property.initializer)];
      })
    );
  throw new Error(`Unsupported palette expression ${node.kind}`);
}

function definitionArray(source, variable) {
  const file = ts.createSourceFile(
    'client.js',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  let found;
  const walk = (node) => {
    if (
      ts.isVariableDeclaration(node) &&
      node.name.getText(file) === variable &&
      node.initializer
    ) {
      found = {
        start: node.initializer.getStart(file),
        end: node.initializer.end,
        values: literal(node.initializer),
      };
    }
    ts.forEachChild(node, walk);
  };
  walk(file);
  if (!found) throw new Error(`Missing ${variable} palette declarations`);
  return found;
}

async function validateUpstream(group) {
  const directory = path.join(root, 'upstream', group);
  const source = await readJson(
    path.join(directory, 'DSH-UPSTREAM-SOURCE.json')
  );
  for (const entry of source.files) {
    const bytes = await readFile(path.join(directory, entry.path));
    if (sha256(bytes) !== entry.sha256)
      throw new Error(`Upstream source changed: ${group}/${entry.path}`);
  }
  return { directory, source };
}

function archive(entries) {
  const pieces = [];
  for (const [relative, bytes] of entries.sort(([a], [b]) =>
    a.localeCompare(b)
  )) {
    const header = Buffer.alloc(512);
    header.write(`package/${relative}`, 0, 100);
    for (const [offset, length, value] of [
      [100, 8, 420],
      [108, 8, 0],
      [116, 8, 0],
      [124, 12, bytes.length],
      [136, 12, 0],
    ])
      header.write(
        value.toString(8).padStart(length - 1, '0') + '\0',
        offset,
        length
      );
    header.fill(32, 148, 156);
    header[156] = 48;
    header.write('ustar\0', 257, 6);
    header.write('00', 263, 2);
    header.write(
      header
        .reduce((sum, value) => sum + value, 0)
        .toString(8)
        .padStart(6, '0') + '\0 ',
      148,
      8
    );
    pieces.push(
      header,
      bytes,
      Buffer.alloc((512 - (bytes.length % 512)) % 512)
    );
  }
  pieces.push(Buffer.alloc(1024));
  const gz = gzipSync(Buffer.concat(pieces), { level: 9 });
  gz.writeUInt32LE(0, 4);
  gz[9] = 255;
  return gz;
}

async function packageOutput(group, source, themes, extras = {}) {
  const directory = path.join(outRoot, group);
  await mkdir(directory, { recursive: true });
  const name = `@dsh-themes-community/${group}-alpha`;
  const version = '1.0.0-alpha.2';
  const manifest = {
    name,
    version,
    type: 'module',
    main: './index.js',
    license: 'MIT',
    description: `DSH Themes Alpha adaptation of ${source.repository}`,
    exports: {
      '.': './index.js',
      './client': './client.js',
      './package.json': './package.json',
    },
    files: [
      'index.js',
      'client.js',
      'LICENSE',
      'PROVENANCE.json',
      'cordis.patch.yml',
    ],
    dsh: {
      bundle: { patch: './cordis.patch.yml' },
      client: {
        inject: [
          '@deepseek-ai/dsh-client-locale',
          '@deepseek-ai/dsh-client-ui-theme',
          '@deepseek-ai/dsh-client-ui-settings',
          '@deepseek-ai/dsh-client-ui-slots',
        ],
        platform: 'web',
        immediately: true,
      },
    },
  };
  await writeFile(
    path.join(directory, 'package.json'),
    JSON.stringify(manifest, null, 2) + '\n'
  );
  await writeFile(
    path.join(directory, 'cordis.patch.yml'),
    `- insert:\n    - id: dsh-community-${group}\n      name: '${name}'\n`
  );
  await writeFile(
    path.join(directory, 'LICENSE'),
    await readFile(path.join(root, 'upstream', group, 'LICENSE'))
  );
  const provenance = {
    schemaVersion: 1,
    adaptation: 'DSH Themes',
    targetDshVersion: '0.1.3-alpha.1',
    upstream: source,
    license: 'MIT',
    packageName: name,
    packageVersion: version,
    ...extras,
    securityAdaptation: {
      revision: 'palette-api-auth-20260906',
      officialGuard: 'ctx.connection.requestRejection(req)',
      beforeAnyRouteReadOrWrite: true,
      premiumJsonBodyLimitBytes: group === 'premium' ? 65536 : undefined,
      helper: {
        path: 'themes/community-alpha/palette-api-security.mjs',
        sha256: sha256(
          await readFile(path.join(root, 'palette-api-security.mjs'))
        ),
      },
      buildImplementationSha256: sha256(
        await readFile(fileURLToPath(import.meta.url))
      ),
      ...(group === 'premium'
        ? {}
        : {
            hostTemplateSha256: sha256(
              await readFile(path.join(root, 'palette-host.mjs'))
            ),
          }),
    },
  };
  await writeFile(
    path.join(directory, 'PROVENANCE.json'),
    JSON.stringify(provenance, null, 2) + '\n'
  );
  return { directory, name, version, provenance, themes };
}

async function finish(group, output) {
  const entries = [];
  for (const file of [
    'package.json',
    'index.js',
    'client.js',
    'cordis.patch.yml',
    'LICENSE',
    'PROVENANCE.json',
  ])
    entries.push([file, await readFile(path.join(output.directory, file))]);
  const artifact = archive(entries);
  const fileName = `${group}-alpha-${output.version}.tgz`;
  await mkdir(path.join(root, 'artifacts'), { recursive: true });
  await writeFile(path.join(root, 'artifacts', fileName), artifact);
  built.push({
    group,
    packageName: output.name,
    version: output.version,
    file: `themes/community-alpha/artifacts/${fileName}`,
    sha256: sha256(artifact),
    sizeBytes: artifact.length,
    upstream: output.provenance.upstream.repository,
    sourceCommit: output.provenance.upstream.sourceCommit,
    license: 'MIT',
    themes: output.themes,
    selectionRoute: `/api/dsh-community-palettes/${group}${group === 'premium' ? '/palette' : ''}`,
    runtimeStatus: 'verification-pending',
  });
}

for (const group of ['theme-pack', 'catppuccin', 'solarized']) {
  const { directory, source } = await validateUpstream(group);
  let client = (
    await readFile(path.join(directory, 'lib/client.js'), 'utf8')
  ).replaceAll(
    '@deepseek-ai/dsh-client-runtime/client',
    '@deepseek-ai/dsh-client-store'
  );
  const variable = group === 'catppuccin' ? 'SKINS' : 'THEMES';
  const declaration = definitionArray(client, variable);
  const repairs = [];
  const themes = declaration.values.map((theme) => {
    const originalId = theme.id;
    for (const [token, color] of Object.entries(theme.tokens)) {
      if (String(color).includes('NaN')) {
        if (
          group !== 'theme-pack' ||
          token !== '--dsw-alias-button-floating-hover'
        )
          throw new Error('Unreviewed invalid token');
        const channels = (value) => value.match(/[\d.]+/g).map(Number);
        const base = channels(theme.tokens['--dsw-alias-button-floating-fill']);
        const ink = channels(theme.tokens['--dsw-alias-label-primary']);
        theme.tokens[token] =
          `rgb(${base.map((channel, index) => Math.round(channel + (ink[index] - channel) * 0.05)).join(', ')})`;
        repairs.push({
          theme: originalId,
          token,
          from: color,
          to: theme.tokens[token],
        });
      }
    }
    return {
      ...theme,
      originalId,
      id: `dsh-alpha-${group}-${originalId}`,
      ...(group === 'theme-pack' && catalogSlugs.includes(originalId)
        ? { catalogId: 1101 + catalogSlugs.indexOf(originalId) }
        : {}),
    };
  });
  client =
    client.slice(0, declaration.start) +
    JSON.stringify(themes) +
    client.slice(declaration.end);
  const originalPackage = (await readJson(path.join(directory, 'package.json')))
    .name;
  client = client.replaceAll(
    JSON.stringify(originalPackage),
    JSON.stringify(`@dsh-themes-community/${group}-alpha`)
  );
  client = client.replace(
    'function apply(ctx) {',
    `${persistence}\nfunction apply(ctx) {\nconst selectPalette = installPalettePersistence(ctx, ${variable}, ${JSON.stringify(group)});`
  );
  if (group === 'theme-pack') {
    client = client.replace(
      'const inject = ["slots", "locale", "theme"];',
      'const inject = ["slots", "locale", "theme", "settingsScope"];'
    );
    client = client.replace(
      't("themepack." + th.id)',
      't("themepack." + th.originalId)'
    );
    client = client.replace(
      'title: th.label.en,',
      'title: (th.catalogId ? "#" + th.catalogId + " · " : "") + th.label.en,\n"data-dsh-palette": th.id,\n"data-dsh-catalog-id": th.catalogId,'
    );
    client = client.replace(
      'return { setTheme: (id) => { ctx.theme.setTheme(id); } };',
      'return { setTheme: (id) => { selectPalette(id); } };'
    );
    // The upstream factory injected an unowned style. Move it into a disposable effect.
    const styleStart = client.indexOf('    if (typeof document');
    const styleEnd = client.indexOf('\n    const zh', styleStart);
    const style = client.slice(styleStart, styleEnd);
    client = client.slice(0, styleStart) + client.slice(styleEnd);
    client = client.replace(
      'const selectPalette =',
      `ctx.effect(() => { ${style}\nreturn () => document.querySelector('style[data-plugin-css="' + TAG_ID + '"]')?.remove(); }, 'theme-pack: picker stylesheet');\nconst selectPalette =`
    );
  } else {
    const kind = group === 'catppuccin' ? 'Skin' : 'Theme';
    const lower = kind.toLowerCase();
    client = client.replace(
      '"theme"\n\t\t];',
      '"theme", "settingsScope"\n\t\t];'
    );
    client = client
      .replace('t(`skin.${skin.id}`)', 't(`skin.${skin.originalId}`)')
      .replace('t("theme." + theme.id)', 't("theme." + theme.originalId)');
    client = client.replace(
      '"aria-pressed": selected,',
      `"aria-pressed": selected, "data-dsh-palette": ${lower}.id,`
    );
    const bootStart = client.indexOf(`\t\t\tconst saved = readSaved${kind}();`);
    const storeStart = client.indexOf(`\t\t\tconst ${lower}Store =`, bootStart);
    if (bootStart < 0 || storeStart < 0)
      throw new Error('Missing legacy restore section');
    client = client.slice(0, bootStart) + client.slice(storeStart);
    const listenerStart = client.indexOf(
      '\t\t\tctx.on("theme/change", (snapshot) => {',
      bootStart
    );
    const listenerEnd = client.indexOf(
      '\n\t\t\tctx.effect(() => ctx.locale.register',
      listenerStart
    );
    client =
      client.slice(0, listenerStart) +
      `\t\t\tctx.on("theme/change", sync${kind});\n` +
      client.slice(listenerEnd);
    client = client.replace(
      `ctx.theme.setTheme(id);\n\t\t\t\t\t\twriteSaved${kind}(id);`,
      'selectPalette(id);'
    );
  }
  const publicThemes = themes.map(
    ({ id, originalId, catalogId, colorScheme, name, label, tokens }) => ({
      id,
      originalId,
      ...(catalogId ? { catalogId } : {}),
      name: label?.en ?? name ?? originalId,
      colorScheme,
      baseColor: tokens['--dsw-alias-bg-base'],
    })
  );
  const output = await packageOutput(group, source, publicThemes, {
    changes: [
      'Exact Alpha client injection declarations; no legacy peer dependency installation',
      'Distinct theme IDs prevent collisions between installed palette packages',
      'Selections persist through the official Host settings service and wait for built-in preference readiness',
      'Original palette tokens and selector UI retained; original named CSS selectors remain best-effort styling',
      ...(group === 'theme-pack'
        ? [
            'Directory IDs #1101–#1112 map to exact palette choices; all 16 upstream choices remain available',
            'Picker CSS is disposed with the plugin',
          ]
        : []),
    ],
    tokenRepairs: repairs,
  });
  await writeFile(path.join(output.directory, 'client.js'), client);
  const host = await readFile(path.join(root, 'palette-host.mjs'), 'utf8');
  await esbuild.build({
    stdin: {
      contents: host.replace(
        "import config from './adapter-config.json' with { type: 'json' };",
        `const config = ${JSON.stringify({ group, themes: publicThemes })};`
      ),
      resolveDir: root,
      sourcefile: 'palette-host.mjs',
    },
    outfile: path.join(output.directory, 'index.js'),
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    alias: {
      '@deepseek-ai/schemastery': path.join(
        runtime,
        'vendor/schemastery/lib/index.mjs'
      ),
    },
    logLevel: 'warning',
  });
  await finish(group, output);
}

// Premium's original import dialog, seed derivation and durable Host routes are retained.
{
  const group = 'premium';
  const { directory, source } = await validateUpstream(group);
  const paletteSource = await readFile(
    path.join(directory, 'src/palettes.ts'),
    'utf8'
  );
  const paletteFile = ts.createSourceFile(
    'palettes.ts',
    paletteSource,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  let rawPalettes;
  ts.forEachChild(paletteFile, (node) => {
    if (ts.isVariableStatement(node))
      for (const declaration of node.declarationList.declarations)
        if (declaration.name.getText(paletteFile) === 'PREMIUM_PALETTES')
          rawPalettes = literal(declaration.initializer);
  });
  if (!rawPalettes) throw new Error('Premium palette definitions missing');
  const themes = rawPalettes.map((theme) => ({
    id: `dsh-alpha-premium-${theme.id}`,
    originalId: theme.id,
    name: theme.id,
    colorScheme: theme.colorScheme,
    baseColor: theme.tokens['--dsw-alias-bg-base'],
  }));
  const output = await packageOutput(group, source, themes, {
    changes: [
      'Build original TypeScript and import dialog against Alpha shared modules',
      'Bundle schemastery and clsx without installing obsolete RC.6 peer packages',
      'Prefix theme IDs and custom IDs to prevent palette registry collisions',
      'Preserve eight palettes, seed-color derivation, import, deletion, and Host-backed selection',
    ],
  });
  const transformSource = (contents) => {
    let result = contents
      .replaceAll('@deepseek-ai/dsh-client-ui-premium-themes', output.name)
      .replaceAll('ui-premium-themes', 'dsh-community-premium')
      .replaceAll('/api/premium-themes', '/api/dsh-community-palettes/premium')
      .replaceAll('custom-', 'dsh-alpha-premium-custom-')
      .replaceAll(
        '@deepseek-ai/dsh-client-runtime/client',
        '@deepseek-ai/dsh-client-store'
      );
    // The selected namespace is a fixed valid identifier; the former namespace
    // branding helper was removed from Alpha's public settings entry.
    result = result
      .replace(
        "import { settingsNamespace, type SettingsProvider } from '@deepseek-ai/dsh-settings'",
        "import type { SettingsProvider } from '@deepseek-ai/dsh-settings'"
      )
      .replace(
        'settingsNamespace(PREMIUM_THEMES_SETTINGS_NAMESPACE)',
        'PREMIUM_THEMES_SETTINGS_NAMESPACE'
      );
    for (const theme of rawPalettes)
      result = result
        .replaceAll(`'${theme.id}'`, `'dsh-alpha-premium-${theme.id}'`)
        .replaceAll(`"${theme.id}"`, `"dsh-alpha-premium-${theme.id}"`);
    if (result.includes('let baseSettled = false')) {
      const start = result.indexOf('  let baseSettled = false');
      const end = result.indexOf('\n  const injected =', start);
      result =
        result.slice(0, start) +
        `
  let baseSettled = false
  let previousBase: BasePreference | undefined
  let adoptingBase = false
  let active = true
  ctx.effect(() => () => { active = false }, 'premium: async lifecycle')
  const adoptBase = (): void => {
    const snapshot = baseScope.getSnapshot()
    if (snapshot.status !== 'ready' || snapshot.value === undefined) return
    const base = snapshot.value[BASE_THEME_FIELD] ?? 'system'
    const preserve = !baseSettled || previousBase === base
    previousBase = base
    baseSettled = true
    restoreBase = base
    if (preserve) {
      adoptingBase = true
      queueMicrotask(() => {
        if (active && adopted && current !== OFF && theme.getTheme().preference !== current) theme.setTheme(current)
        adoptingBase = false
      })
    }
  }
  ctx.effect(() => baseScope.subscribe(adoptBase), 'premium: Alpha base adoption')
  adoptBase()
  ctx.on('theme/change', () => {
    if (!adopted || !baseSettled || current === OFF) return
    queueMicrotask(() => {
      if (!active || adoptingBase || theme.getTheme().preference === current) return
      const preference = theme.getTheme().preference
      if (preference === 'light' || preference === 'dark' || preference === 'system') restoreBase = preference
      clearPalette()
    })
  })
` +
        result.slice(end);
      result = result.replace(
        '    applyCustoms(customs)\n    if (!adopted)',
        '    if (!active) return\n    applyCustoms(customs)\n    if (!adopted)'
      );
      result = result.replace(
        '      applySelection(palette, base)\n    }\n  }).catch',
        '      restoreBase = base\n      sync(palette)\n      if (palette !== OFF && baseSettled) applySelection(palette, base)\n    }\n  }).catch'
      );
    }
    return result;
  };
  const external = [
    'react',
    'react/jsx-runtime',
    'react-dom',
    'react-dom/client',
    '@deepseek-ai/cordis',
    '@deepseek-ai/dsh-client-store',
    '@deepseek-ai/dsh-client-ui-slots',
    '@deepseek-ai/dsh-client-web-react',
    '@deepseek-ai/dsh-client-ui-primitives',
  ];
  const css = [];
  const plugin = {
    name: 'reviewed-alpha-source',
    setup(build) {
      build.onLoad({ filter: /\.[cm]?tsx?$/ }, async (args) => {
        let contents = transformSource(await readFile(args.path, 'utf8'));
        if (args.path === path.join(directory, 'src/index.ts')) {
          contents = securePremiumHostSource(
            contents,
            path.join(root, 'palette-api-security.mjs')
          );
        }
        return {
          contents,
          loader: args.path.endsWith('.tsx') ? 'tsx' : 'ts',
          resolveDir: path.dirname(args.path),
        };
      });
      build.onLoad({ filter: /\.module\.css$/ }, async (args) => {
        const lightning = require(
          path.join(runtime, 'node_modules/lightningcss')
        );
        const transformed = lightning.transform({
          filename: path.relative(directory, args.path),
          code: await readFile(args.path),
          cssModules: { pattern: '[hash]_[local]' },
          minify: true,
        });
        css.push({
          file: path.relative(directory, args.path),
          text: transformed.code.toString(),
        });
        return {
          contents: `export default ${JSON.stringify(
            Object.fromEntries(
              Object.entries(transformed.exports ?? {})
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, val]) => [key, val.name])
            )
          )};`,
          loader: 'js',
        };
      });
    },
  };
  const shared = {
    bundle: true,
    target: 'es2024',
    plugins: [plugin],
    alias: {
      '@deepseek-ai/schemastery': path.join(
        runtime,
        'vendor/schemastery/lib/index.mjs'
      ),
      clsx: require.resolve('clsx'),
    },
    logLevel: 'warning',
  };
  await esbuild.build({
    ...shared,
    entryPoints: [path.join(directory, 'src/index.ts')],
    outfile: path.join(output.directory, 'index.js'),
    platform: 'node',
    format: 'esm',
  });
  const client = await esbuild.build({
    ...shared,
    entryPoints: [path.join(directory, 'src/client/index.ts')],
    write: false,
    platform: 'browser',
    format: 'cjs',
    jsx: 'automatic',
    external,
    define: { 'process.env.NODE_ENV': '"production"' },
  });
  const cssCode = JSON.stringify(
    css
      .sort((a, b) => a.file.localeCompare(b.file))
      .map((item) => item.text)
      .join('\n')
  );
  const lifecycle = `const upstreamApply=module.exports.apply; const adaptedExports={...module.exports,apply:(ctx)=>{ctx.effect(()=>{const tag=document.createElement('style');tag.dataset.plugin=${JSON.stringify(output.name)};tag.textContent=${cssCode};document.head.appendChild(tag);return()=>tag.remove();},'premium: owned styles');return upstreamApply(ctx);}};`;
  await writeFile(
    path.join(output.directory, 'client.js'),
    `window.__ModuleLoader__.load({id:${JSON.stringify(output.name)},factory:(require)=>{var module={exports:{}};var exports=module.exports;\n${client.outputFiles[0].text}\n${lifecycle}\nreturn adaptedExports;}});\n`
  );
  await finish(group, output);
}

await writeFile(
  path.join(root, 'catalog.json'),
  JSON.stringify(
    { schemaVersion: 1, targetDshVersion: '0.1.3-alpha.1', groups: built },
    null,
    2
  ) + '\n'
);
console.log(
  JSON.stringify(
    built.map(({ group, sizeBytes, themes }) => ({
      group,
      sizeBytes,
      choices: themes.length,
    }))
  )
);
