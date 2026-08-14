import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export const tokenNames = [
  '--dsw-alias-bg-base', '--dsw-alias-bg-layer-1', '--dsw-alias-bg-layer-2', '--dsw-alias-bg-overlay',
  '--dsw-alias-border-l1', '--dsw-alias-border-l2', '--dsw-alias-brand-primary', '--dsw-alias-label-primary',
  '--dsw-alias-label-secondary', '--dsw-alias-state-error-primary', '--dsw-alias-state-success-primary',
  '--dsw-alias-state-warn-primary', '--dsw-specific-sidebar-fill',
];

export function tokens() {
  return Object.fromEntries(tokenNames.map((name, index) => [name, {
    light: `#${(0xd0d8e0 + index).toString(16).padStart(6, '0')}`,
    dark: `#${(0x101820 + index).toString(16).padStart(6, '0')}`,
  }]));
}

export async function run(script, args, options = {}) {
  return new Promise((resolvePromise) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('close', (code) => resolvePromise({ code, stdout, stderr }));
  });
}

export async function writeAuthoring(directory, overrides = {}) {
  await mkdir(join(directory, 'assets'), { recursive: true });
  const webp = (label) => Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBP'), Buffer.from(label)]);
  await writeFile(join(directory, 'assets', 'background.webp'), webp('background-image'));
  await writeFile(join(directory, 'assets', 'sidebar.webp'), webp('sidebar-image'));
  await writeFile(join(directory, 'assets', 'card.webp'), webp('card-image'));
  await writeFile(join(directory, 'assets', 'preview-light.webp'), webp('preview-light-image'));
  await writeFile(join(directory, 'assets', 'preview-dark.webp'), webp('preview-dark-image'));
  const value = {
    schemaVersion: '2.0',
    kind: 'full-skin',
    slug: 'ocean-workbench',
    name: 'Ocean Workbench',
    description: 'A deterministic test skin.',
    category: 'illustrated',
    version: '1.0.0',
    license: 'CC-BY-4.0',
    author: { name: 'Test Author', url: 'https://example.com/' },
    copyright: { source: 'original', aiGenerated: false },
    compatibility: { dshPackageVersion: '0.1.0-rc.6' },
    tokens: tokens(),
    assets: [
      { role: 'background', sourcePath: 'assets/background.webp', mimeType: 'image/webp', width: 1920, height: 1080 },
      { role: 'sidebar', sourcePath: 'assets/sidebar.webp', mimeType: 'image/webp', width: 900, height: 1600 },
      { role: 'card', sourcePath: 'assets/card.webp', mimeType: 'image/webp', width: 1200, height: 800 },
      { role: 'preview-light', sourcePath: 'assets/preview-light.webp', mimeType: 'image/webp', width: 1440, height: 900 },
      { role: 'preview-dark', sourcePath: 'assets/preview-dark.webp', mimeType: 'image/webp', width: 1440, height: 900 },
    ],
    visual: {
      preset: 'glass', focus: { x: 70, y: 50 }, surfaceOpacity: 0.82,
      overlayOpacity: 0.7, borderStrength: 0.55, glowStrength: 0.15,
    },
    ...overrides,
  };
  const path = join(directory, 'authoring.json');
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`);
  return path;
}
