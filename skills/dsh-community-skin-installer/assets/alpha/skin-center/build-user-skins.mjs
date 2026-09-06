import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../../..');
const original = path.resolve(
  root,
  '../dsh-themes-skills/skills/dsh-community-skin-installer/assets/skins'
);
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const companions = [];
for (const skinId of ['qq98', 'ths']) {
  const source = path.join(original, skinId);
  const destination = path.join(import.meta.dirname, 'user-skins', skinId);
  await mkdir(destination, { recursive: true });
  const files = [];
  for (const name of (await readdir(source)).sort()) {
    const before = await readFile(path.join(source, name));
    let after = before;
    if (name === 'patches.css') {
      assert.ok(before.toString().includes('[data-pane=sidebar]'));
      after = Buffer.from(
        before
          .toString()
          .replaceAll('[data-pane=sidebar]', '[data-slot=sidebar]')
      );
    } else if (name === 'skin.json') {
      const manifest = JSON.parse(before);
      manifest.version = '0.2.5-dsh-themes.2-alpha.1';
      manifest.author += '; Alpha sidebar slot adaptation by DSH Themes';
      manifest.description +=
        ' Alpha 0.1.3-alpha.1 compatibility: sidebar selectors use the official data-slot="sidebar" wrapper.';
      after = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
    } else if (name === 'NOTICE') {
      after = Buffer.from(
        `${before.toString()}\nAlpha compatibility change, 2026-09-06: DSH Themes mechanically replaced the legacy [data-pane=sidebar] selector with the official [data-slot=sidebar] wrapper. Original styles, rights and upstream provenance are retained.\n`
      );
    }
    await writeFile(path.join(destination, name), after);
    files.push({
      path: name,
      sourceSha256: sha(before),
      sha256: sha(after),
      bytes: after.length,
    });
  }
  companions.push({
    kind: 'bundled-user-skin',
    skinId,
    sourcePath: `assets/alpha/skin-center/user-skins/${skinId}`,
    version: '0.2.5-dsh-themes.2-alpha.1',
    files,
  });
}
await writeFile(
  path.join(import.meta.dirname, 'user-skins-provenance.json'),
  `${JSON.stringify({ schemaVersion: 1, sourceDirectory: 'skills/dsh-community-skin-installer/assets/skins', sourceCommit: 'a9b915cee0f12f2fd13a6575bc8feaa9ee09d6ed', sourceRepository: 'zhu1090093659/dsh-web-ui', adaptation: 'Only legacy sidebar selectors and explicit adaptation notices changed.', companions }, null, 2)}\n`
);
console.log(
  JSON.stringify(
    companions.map(({ skinId, files }) => ({
      skinId,
      bytes: files.reduce((sum, file) => sum + file.bytes, 0),
    }))
  )
);
