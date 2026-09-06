import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

import {
  assertAlphaPortFree,
  stopOwnedAlphaServer,
} from '../../scripts/alpha-owned-server.mjs';
import { stabilizeRuntimeOnboarding } from '../../scripts/full-skin-runtime-matrix.mjs';

// This verifier uses the official CLI and a dedicated Playwright browser profile.
// Server logs contain a local sign-in token and are never copied into receipts.
const root = process.cwd();
const home =
  process.env.DSH_PALETTE_TEST_HOME ??
  resolve(homedir(), '.dsh-themes/testing/community-palettes-alpha');
const wrapper =
  process.env.DSH_ALPHA_LAUNCHER ??
  resolve(
    '../dsh-themes-skills/skills/dsh-theme-manager/scripts/dsh-alpha.mjs'
  );
const cli = resolve('node_modules/.bin/playwright-cli');
const output = resolve(
  process.env.DSH_PALETTE_TEST_OUTPUT ??
    'output/playwright/community-palettes-alpha'
);
const browserSession =
  process.env.DSH_PALETTE_TEST_SESSION ?? 'alpha-palettes';
const groups = JSON.parse(
  readFileSync('themes/community-alpha/catalog.json', 'utf8')
).groups;
const selectedGroup = process.argv
  .find((argument) => argument.startsWith('--group='))
  ?.slice(8);
const targetGroups = selectedGroup
  ? groups.filter((group) => group.group === selectedGroup)
  : groups;
const premiumLabels = [
  '东京夜',
  '北境',
  '摩卡',
  '森林',
  '玫瑰松',
  '鎏金',
  '拿铁',
  '羊皮纸金',
];
const resultFile = `${output}/verified-selections.json`;
const evidence = existsSync(resultFile)
  ? JSON.parse(readFileSync(resultFile, 'utf8'))
  : { choices: [], restarts: [] };
const write = () =>
  writeFileSync(resultFile, JSON.stringify(evidence, null, 2) + '\n');

function browser(command, argument) {
  const result = execFileSync(
    cli,
    [`-s=${browserSession}`, command, ...(argument ? [argument] : [])],
    {
      encoding: 'utf8',
      timeout: 90000,
    }
  );
  if (result.includes('### Error'))
    throw new Error(result.slice(result.indexOf('### Error')));
  return result;
}
function evaluate(code) {
  const text = browser('eval', code);
  return JSON.parse(
    text.split('### Result\n')[1].split('\n### Ran Playwright code')[0]
  );
}
function run(code) {
  browser('run-code', `async page => { ${code} }`);
}
function rgb(value) {
  if (!value.startsWith('#')) return value;
  const hex = value.slice(1);
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  return `rgb(${[0, 2, 4].map((offset) => parseInt(full.slice(offset, offset + 2), 16)).join(', ')})`;
}
function selector(group, theme) {
  if (group.group === 'premium')
    return `page.getByRole('button',{name:${JSON.stringify(premiumLabels[group.themes.indexOf(theme)])},exact:true}).filter({hasNot:page.locator('.dtp-name')})`;
  return `page.locator(${JSON.stringify(`[data-dsh-palette="${theme.id}"]`)})`;
}
function checkCode(group, theme) {
  return `
    const expected = ${JSON.stringify({ id: theme.id, base: rgb(theme.baseColor), scheme: theme.colorScheme, route: group.selectionRoute, key: group.group === 'premium' ? 'palette' : 'selection' })};
    await page.waitForFunction(async (expected) => {
      const state = await (await fetch(expected.route)).json();
      return state[expected.key] === expected.id && getComputedStyle(document.body).backgroundColor === expected.base && document.documentElement.style.colorScheme === expected.scheme;
    }, expected);
    // Repeated sampling deliberately spans settings mirror adoption, the race
    // that previously reverted the theme after an apparently successful save.
    for (let attempt = 0; attempt < 5; attempt++) {
      await page.waitForTimeout(250);
      const actual = await page.evaluate(async (expected) => {
        const state = await (await fetch(expected.route)).json();
        return { selection: state[expected.key], background: getComputedStyle(document.body).backgroundColor, scheme: document.documentElement.style.colorScheme, invalidToken: document.body.style.cssText.includes('NaN') };
      }, expected);
      if (actual.selection !== expected.id || actual.background !== expected.base || actual.scheme !== expected.scheme || actual.invalidToken) throw new Error(JSON.stringify({expected,actual}));
      await page.evaluate((value) => { window.__dshAlphaPaletteEvidence = value; }, actual);
    }
  `;
}
async function login() {
  const text = readFileSync(`${output}/server.log`, 'utf8');
  const url = text.match(/http:\/\/127\.0\.0\.1:3427\/\?token=\S+/)?.[0];
  if (!url) throw new Error('Official server did not produce a sign-in URL');
  browser('goto', url);
  run(
    `await (${stabilizeRuntimeOnboarding.toString()})(page); await page.getByRole('button',{name:'设置',exact:true}).click();`
  );
}
let ownedServer;
function occupied() {
  try {
    return Boolean(
      execFileSync('lsof', ['-ti', 'TCP:3427', '-sTCP:LISTEN'], {
        encoding: 'utf8',
      }).trim()
    );
  } catch (error) {
    if (error.status === 1 && !String(error.stderr ?? '').trim()) return false;
    throw error;
  }
}
async function stop() {
  const child = ownedServer;
  const pid =
    child && child.exitCode === null && child.signalCode === null
      ? child.pid
      : undefined;
  await stopOwnedAlphaServer({
    pid,
    signalGroup: (group, signal) => process.kill(group, signal),
    occupied,
    delay,
  });
  ownedServer = undefined;
}
async function start() {
  assertAlphaPortFree(occupied);
  if (
    ownedServer &&
    ownedServer.exitCode === null &&
    ownedServer.signalCode === null
  )
    throw new Error('An owned palette server is still running');
  writeFileSync(`${output}/server.log`, '', { mode: 0o600 });
  const { openSync, closeSync } = await import('node:fs');
  const log = openSync(`${output}/server.log`, 'a', 0o600);
  const child = spawn(
    process.execPath,
    [wrapper, 'web', '--host', '127.0.0.1', '--port', '3427', '--no-open'],
    {
      cwd: root,
      env: { ...process.env, DSH_HOME: home },
      detached: true,
      stdio: ['ignore', log, log],
    }
  );
  ownedServer = child;
  let spawnError;
  child.once('error', (error) => {
    spawnError = error;
  });
  child.unref();
  closeSync(log);
  for (let attempt = 0; attempt < 100; attempt++) {
    if (spawnError) throw spawnError;
    if (child.exitCode !== null || child.signalCode !== null)
      throw new Error('Owned palette server exited before readiness');
    if (
      readFileSync(`${output}/server.log`, 'utf8').includes(
        'http://127.0.0.1:3427/?token='
      )
    )
      return;
    await delay(100);
  }
  await stop();
  throw new Error('Isolated server did not start');
}

// Lifecycle runs establish ownership themselves; an existing listener is never
// adopted merely because it uses the expected port or profile path.
const managesServer = ['--restarts', '--custom-restart', '--recover'].some(
  (flag) => process.argv.includes(flag)
);
try {
  if (managesServer) await start();
  if (managesServer || process.argv.includes('--login')) await login();
  if (process.argv.includes('--choices')) {
    evidence.choices = selectedGroup
      ? evidence.choices.filter((item) => item.group !== selectedGroup)
      : [];
    for (const group of targetGroups) {
      run(
        `await page.evaluate(() => { window.__dshAlphaPaletteBatch = []; });` +
          group.themes
            .map(
              (theme) => `{
      await ${selector(group, theme)}.click(); ${checkCode(group, theme)}
      await page.evaluate((metadata) => { window.__dshAlphaPaletteBatch.push({...metadata,observed:window.__dshAlphaPaletteEvidence}); }, ${JSON.stringify({ group: group.group, ...theme })});
    }`
            )
            .join('\n')
      );
      evidence.choices.push(...evaluate('() => window.__dshAlphaPaletteBatch'));
      write();
      console.log(`Verified ${group.group}: ${group.themes.length} choices`);
    }
  }
  if (process.argv.includes('--restarts')) {
    evidence.restarts = selectedGroup
      ? evidence.restarts.filter((item) => item.group !== selectedGroup)
      : [];
    for (const group of targetGroups) {
      const themes =
        group.group === 'theme-pack'
          ? group.themes.filter((theme) => theme.catalogId)
          : [group.themes[0]];
      for (const theme of themes) {
        run(
          `await ${selector(group, theme)}.click(); ${checkCode(group, theme)}`
        );
        if (theme.catalogId) {
          const selected = evaluate(`async () => {
          const response = await fetch('/api/dsh-community-palettes/theme-pack', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({catalogId:${theme.catalogId},base:'system'})});
          const body = await response.json();
          return {status:response.status,selection:body.selection};
        }`);
          if (selected.status !== 200 || selected.selection !== theme.id)
            throw new Error(
              'Numbered activation did not persist the exact palette'
            );
        }
        await stop();
        await start();
        await login();
        run(checkCode(group, theme));
        evidence.restarts.push({
          group: group.group,
          catalogId:
            theme.catalogId ??
            { catppuccin: 1201, solarized: 1202, premium: 1203 }[group.group],
          id: theme.id,
          observed: evaluate('() => window.__dshAlphaPaletteEvidence'),
        });
        write();
        console.log(`Cold restart passed: ${theme.catalogId ?? group.group}`);
      }
    }
  }

  if (process.argv.includes('--custom-restart')) {
    const group = groups.find((item) => item.group === 'premium');
    const state = evaluate(
      `async () => await (await fetch(${JSON.stringify(group.selectionRoute)})).json()`
    );
    const rawId = state.palette.replace('dsh-alpha-premium-custom-', '');
    const custom = state.customPalettes[rawId];
    if (!custom || custom.name !== 'DSH Alpha QA')
      throw new Error('Expected only the explicit QA import fixture');
    const theme = {
      id: state.palette,
      baseColor: custom.colors.base,
      colorScheme: custom.colorScheme,
    };
    run(
      `await page.getByRole('button',{name:'增大字号',exact:true}).click(); ${checkCode(group, theme)}`
    );
    run(
      `await page.getByRole('button',{name:'减小字号',exact:true}).click(); ${checkCode(group, theme)}`
    );
    await stop();
    await start();
    await login();
    run(checkCode(group, theme));
    evidence.customImport = {
      name: custom.name,
      colors: custom.colors,
      themeId: theme.id,
      fontChangePreserved: true,
      coldRestart: evaluate('() => window.__dshAlphaPaletteEvidence'),
    };
    write();
    console.log('Premium custom import, font changes and cold restart passed');
  }

  if (process.argv.includes('--recover')) {
    const before = evaluate(`async () => ({
    background:getComputedStyle(document.body).backgroundColor,
    ownedStyleCount:document.querySelectorAll('style[data-plugin="@dsh-themes-community/premium-alpha"]').length,
    custom:await(await fetch('/api/dsh-community-palettes/premium/palette')).json(),
    userAgent:navigator.userAgent
  })`);
    if (Object.keys(before.custom.customPalettes).length)
      throw new Error('QA custom palette was not removed');
    await stop();
    const removed = execFileSync(
      process.execPath,
      [
        wrapper,
        'plugin',
        '--profile',
        'web',
        'remove',
        ...groups.map((group) => group.packageName),
      ],
      {
        env: { ...process.env, DSH_HOME: home },
        encoding: 'utf8',
        timeout: 30000,
      }
    );
    writeFileSync(`${output}/final-uninstall.log`, removed);
    await start();
    await login();
    const restored = evaluate(`async () => ({
    background:getComputedStyle(document.body).backgroundColor,
    inlineBase:document.body.style.getPropertyValue('--dsw-alias-bg-base'),
    paletteCards:document.querySelectorAll('[data-dsh-palette]').length,
    ownedStyles:document.querySelectorAll('style[data-plugin="@dsh-themes-community/premium-alpha"],style[data-plugin-css="dsh-theme-pack"]').length,
    routes:await Promise.all(${JSON.stringify(groups.map((group) => group.selectionRoute))}.map(async route=>({route,status:(await fetch(route)).status})))
  })`);
    if (
      restored.background !== 'rgb(255, 255, 255)' ||
      restored.inlineBase ||
      restored.paletteCards ||
      restored.ownedStyles ||
      restored.routes.some((route) => route.status !== 404)
    )
      throw new Error('Uninstall did not restore the baseline');
    evidence.recovery = { before, after: restored, customFixtureDeleted: true };
    write();
    await stop();
    browser('close', '');
    console.log(
      'All four packages uninstalled; controls, custom tokens and routes are gone'
    );
  }
} finally {
  if (managesServer) await stop();
}
