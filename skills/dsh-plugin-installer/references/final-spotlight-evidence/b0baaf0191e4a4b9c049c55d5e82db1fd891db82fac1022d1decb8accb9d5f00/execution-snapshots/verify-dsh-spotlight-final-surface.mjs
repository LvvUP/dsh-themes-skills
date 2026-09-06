// Final desktop coexistence after the first-party Settings containment fix.
// Earlier technical driver bytes remain in history; no model/provider actions.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { createConnection } from 'node:net';
import { join } from 'node:path';

import { browserCommand } from './verify-dsh-plugin-runtime.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** A listening but unresponsive HTTP service is never reported as stopped. */
export function probeLoopbackPort(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: '127.0.0.1', port });
    let finished = false;
    const finish = (closed, code) => {
      if (finished) return;
      finished = true;
      socket.destroy();
      resolve({ host: '127.0.0.1', port, closed, code });
    };
    socket.once('connect', () => finish(false, 'CONNECTED'));
    socket.once('error', (error) =>
      finish(error.code === 'ECONNREFUSED', error.code ?? 'UNKNOWN')
    );
    socket.setTimeout(1000, () => finish(false, 'TIMEOUT'));
  });
}

export async function checkFinalSpotlightSurface({
  env,
  skillsRoot,
  phase,
  skin,
  manifest,
  cssSha256,
  withSpotlight,
  withSkin,
}) {
  const folder = join(env.DSH_HOME, 'spotlight-' + phase);
  const probePath = folder + '.mjs',
    patchPath = folder + '.yml';
  const names = ['@0xsline/dsh-spotlight', skin.packageName];
  await writeFile(
    probePath,
    `export const name='spotlight-coexistence-probe'; export function apply(ctx){ctx.get('appReady').onReady(()=>{const entries=[...ctx.get('loader').entries()].filter(e=>${JSON.stringify(names)}.includes(e.options.name)).map(e=>({name:e.options.name,state:e.fiber?.state,disabled:e.disabled}));process.stdout.write('SPOTLIGHT_READY '+JSON.stringify(entries)+'\\n');});}\n`
  );
  await writeFile(
    patchPath,
    `- insert:\n    - id: spotlight-coexistence-probe\n      name: ${JSON.stringify(probePath)}\n`
  );
  const child = spawn(
    process.execPath,
    [
      join(skillsRoot, 'skills/dsh-theme-manager/scripts/dsh-alpha.mjs'),
      'web',
      '--patch',
      patchPath,
      '--no-open',
      '--host',
      '127.0.0.1',
      '--port',
      '4016',
    ],
    { env, detached: true, shell: false, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  let stdout = '',
    stderr = '',
    exited = false;
  child.stdout.on('data', (bytes) => {
    stdout += bytes;
  });
  child.stderr.on('data', (bytes) => {
    stderr += bytes;
  });
  child.once('exit', () => {
    exited = true;
  });
  const record = {
    phase,
    withSpotlight,
    withSkin,
    modelTask: false,
    status: 'running',
    screenshots: [],
  };
  const redact = (value) =>
    value.replace(/([?&]token=)[A-Za-z0-9_-]+/g, '$1[local-token]');
  try {
    for (let i = 0; i < 80 && !exited && !stdout.includes('dsh web:'); i++)
      await sleep(500);
    const url = stdout.match(
      /http:\/\/127\.0\.0\.1:4016\/\?token=[A-Za-z0-9_-]+/
    )?.[0];
    assert.ok(url, 'Official authenticated Web URL missing');
    const open = await browserCommand([
      'open',
      'about:blank',
      '--browser=chrome',
    ]);
    assert.equal(open.code, 0);
    const result = await browserCommand([
      'run-code',
      `async page => {
      const errors=[],failedRequests=[],consoleMessages=[];
      page.on('pageerror',e=>errors.push({message:e.message,url:null}));
      page.on('console',m=>{consoleMessages.push({type:m.type(),text:m.text(),url:m.location().url});if(m.type()==='error')errors.push({message:m.text(),url:m.location().url});});
      page.on('response',r=>{if(r.status()>=400)failedRequests.push({url:r.url(),status:r.status()});});
      await page.setViewportSize({width:1280,height:800});
      await page.emulateMedia({colorScheme:'light'});
      const response=await page.goto(${JSON.stringify(url)});
      await page.waitForTimeout(1500);
      const onboardingActions=[];
      for(const label of [/^(Continue|继续)$/,/^(Configure later|稍后配置)$/]) {
        const button=page.getByRole('button',{name:label}).first();
        let visible=false;
        try {await button.waitFor({state:'visible',timeout:10000});visible=true;}
        catch(error){if(error.name!=='TimeoutError')throw error;}
        if(visible){const text=await button.innerText();await button.click();await button.waitFor({state:'hidden',timeout:10000});onboardingActions.push({kind:'normal-button-click',text});}
      }
      await page.waitForFunction(()=>!document.getElementById('root')?.inert,{},{timeout:10000});
      await page.waitForTimeout(700);
      const observe=()=>page.evaluate(({tokenNames})=>({dataSkin:document.documentElement.dataset.dshSkin??null,stylesheet:document.querySelector('link[data-dsh-themes-skin]')?.getAttribute('href')??null,backgroundImage:getComputedStyle(document.body).backgroundImage,dark:document.body.hasAttribute('data-ds-dark-theme'),tokens:Object.fromEntries(tokenNames.map(key=>[key,getComputedStyle(document.body).getPropertyValue(key).trim()])),spotlightRootCount:document.querySelectorAll('[data-dsh-spotlight-root]').length,spotlightStyleCount:document.querySelectorAll('#dsh-spotlight-style').length,shortcutStorage:localStorage.getItem('dsh.spotlight.shortcut.v1')}),{tokenNames:${JSON.stringify(Object.keys(manifest.tokens))}});
      const before=await observe();
      await page.screenshot({path:${JSON.stringify(folder + '-before.png')},animations:'disabled'});
      let action=null,whileOpen=null,afterClose=null,searchScreenshot=null;
      if(${withSpotlight}) {
        await page.keyboard.press('Meta+k');
        const input=page.locator('[data-dsh-spotlight-input]');
        await input.waitFor({state:'visible',timeout:5000});
        await input.fill('打开插件设置');
        const selected=page.locator('[data-dsh-spotlight-option]').filter({hasText:'打开插件设置'}).first();
        await selected.waitFor({state:'visible',timeout:5000});
        const selectedText=await selected.innerText();
        whileOpen=await observe();
        await page.screenshot({path:${JSON.stringify(folder + '-search.png')},animations:'disabled'});
        await selected.click();
        const dialog=page.getByRole('dialog',{name:/^(Settings|设置)$/,exact:true});
        await dialog.waitFor({state:'visible',timeout:5000});
        await page.waitForTimeout(500);
        const dialogText=await dialog.innerText();
        if(!/插件|Plugins/i.test(dialogText))throw Error('Plugin settings were not rendered');
        await page.screenshot({path:${JSON.stringify(folder + '-settings.png')},animations:'disabled'});
        const geometry=await dialog.evaluate(node=>{
          const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
          const nav=node.querySelector(':scope > nav'),content=nav?.nextElementSibling,options=content?.lastElementChild;
          return {viewport:{width:innerWidth,height:innerHeight},dialog:rect(node),overlay:rect(node.parentElement),nav:rect(nav),content:rect(content),options:rect(options),contentHorizontalOverflow:content.scrollWidth>content.clientWidth+1,optionsHorizontalOverflow:options.scrollWidth>options.clientWidth+1,contentText:options?.textContent?.slice(0,500)??''};
        });
        action={query:'打开插件设置',selectedText,settingsDialogVisible:true,pluginSettingsTextPresent:true,dialogText:dialogText.slice(0,3500),geometry};
        await dialog.getByRole('button',{name:/^(Close|关闭)$/,exact:true}).click();
        await page.keyboard.press('Meta+k');await input.waitFor({state:'visible'});await page.keyboard.press('Escape');
        await input.waitFor({state:'detached'});
        afterClose=await observe();
        await page.screenshot({path:${JSON.stringify(folder + '-closed.png')},animations:'disabled'});
      }
      if(!${withSpotlight} && ${withSkin}) {
        await page.getByRole('button',{name:/^(Settings|设置)$/,exact:true}).first().click();
        const dialog=page.getByRole('dialog',{name:/^(Settings|设置)$/,exact:true});
        await dialog.waitFor({state:'visible',timeout:5000});
        await dialog.locator('nav button').filter({hasText:/^(插件|Plugins)$/}).first().click();
        await page.waitForTimeout(500);
        const dialogText=await dialog.innerText();
        const geometry=await dialog.evaluate(node=>{
          const rect=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
          const nav=node.querySelector(':scope > nav'),content=nav?.nextElementSibling,options=content?.lastElementChild;
          return {viewport:{width:innerWidth,height:innerHeight},dialog:rect(node),overlay:rect(node.parentElement),nav:rect(nav),content:rect(content),options:rect(options),contentHorizontalOverflow:content.scrollWidth>content.clientWidth+1,optionsHorizontalOverflow:options.scrollWidth>options.clientWidth+1,contentText:options?.textContent?.slice(0,500)??''};
        });
        action={kind:'native-settings-after-spotlight-removal',settingsDialogVisible:true,pluginSettingsTextPresent:/插件|Plugins/i.test(dialogText),dialogText:dialogText.slice(0,3500),geometry};
        await page.screenshot({path:${JSON.stringify(folder + '-settings.png')},animations:'disabled'});
        await dialog.getByRole('button',{name:/^(Close|关闭)$/,exact:true}).click();
        afterClose=await observe();
        await page.screenshot({path:${JSON.stringify(folder + '-closed.png')},animations:'disabled'});
      }
      const resources=await page.evaluate(async({assets,cssSha,slug,expectedPresent})=>{
        const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),x=>x.toString(16).padStart(2,'0')).join('');
        const out=[];
        for(const a of [{url:'/__dsh-themes/'+slug+'/skin.css',sha256:cssSha},...assets]){const r=await fetch(a.url,{cache:'no-store'});out.push({url:a.url,status:r.status,sha256:await hash(await r.arrayBuffer()),expectedSha256:a.sha256,expectedPresent});}
        return out;
      },{assets:${JSON.stringify(manifest.assets)},cssSha:${JSON.stringify(cssSha256)},slug:${JSON.stringify(skin.slug)},expectedPresent:${withSkin}});
      return {httpStatus:response.status(),onboardingActions,before,whileOpen,afterClose,action,resources,errors,failedRequests,consoleMessages};
    }`,
    ]);
    await writeFile(folder + '-browser.log', redact(result.output));
    const parsed = result.output.match(/### Result\s*\n(\{[^\n]+\})/);
    assert.ok(parsed, result.output);
    record.browser = JSON.parse(parsed[1]);
    record.hostEntries = JSON.parse(
      stdout.match(/^SPOTLIGHT_READY (\[[^\n]*\])$/m)?.[1] ?? 'null'
    );
    assert.ok(Array.isArray(record.hostEntries));
    for (const [name, expected] of [
      [names[0], withSpotlight],
      [names[1], withSkin],
    ])
      assert.equal(
        record.hostEntries.some(
          (e) => e.name === name && e.state === 2 && !e.disabled
        ),
        expected
      );
    const b = record.browser;
    assert.equal(b.httpStatus, 200);
    const expected404 = new Set(
      withSkin
        ? []
        : b.resources.map((r) => new URL(r.url, 'http://127.0.0.1:4016').href)
    );
    b.unexpectedRequests = b.failedRequests.filter(
      (r) => !(r.status === 404 && expected404.has(r.url))
    );
    b.unexpectedErrors = b.errors.filter(
      (e) =>
        !(
          expected404.has(e.url) &&
          e.message ===
            'Failed to load resource: the server responded with a status of 404 (Not Found)'
        )
    );
    assert.deepEqual(b.unexpectedRequests, []);
    assert.deepEqual(b.unexpectedErrors, []);
    if (withSkin) {
      assert.equal(b.before.dataSkin, skin.slug);
      assert.equal(
        b.before.stylesheet,
        '/__dsh-themes/' + skin.slug + '/skin.css'
      );
      assert.ok(
        b.before.backgroundImage.includes(
          '6b7166ad02be7628997058500b5c2c44e43d43b7c0feb128a550e42ac92e06b1'
        )
      );
      for (const [key, pair] of Object.entries(manifest.tokens))
        assert.equal(
          b.before.tokens[key].toUpperCase(),
          pair[b.before.dark ? 'dark' : 'light'].toUpperCase()
        );
      for (const r of b.resources) {
        assert.equal(r.status, 200);
        assert.equal(r.sha256, r.expectedSha256);
      }
    } else {
      assert.equal(b.before.dataSkin, null);
      assert.equal(b.before.stylesheet, null);
      assert.ok(b.resources.every((r) => r.status === 404));
    }
    if (withSpotlight) {
      assert.equal(b.before.spotlightStyleCount, 1);
      assert.equal(b.whileOpen.spotlightRootCount, 1);
      assert.equal(b.action.settingsDialogVisible, true);
      assert.equal(b.afterClose.spotlightRootCount, 0);
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
      assert.equal(b.before.spotlightStyleCount, 0);
      assert.equal(b.before.spotlightRootCount, 0);
    }
    if (withSpotlight || withSkin) {
      const g = b.action.geometry;
      assert.deepEqual(g.viewport, { width: 1280, height: 800 });
      assert.ok(
        Math.abs(g.dialog.width - 800) <= 1,
        'Settings must retain its full desktop width'
      );
      assert.ok(
        Math.abs(g.dialog.x - 240) <= 1,
        'Settings must center in the viewport'
      );
      assert.ok(
        g.overlay.width === 1280 && g.overlay.x === 0,
        'Settings overlay must cover the viewport'
      );
      assert.equal(g.overlay.y, 0);
      assert.equal(g.overlay.height, 800);
      assert.ok(Math.abs(g.dialog.height - 752) <= 1);
      assert.ok(Math.abs(g.dialog.y - 24) <= 1);
      assert.equal(g.contentHorizontalOverflow, false);
      assert.equal(g.optionsHorizontalOverflow, false);
      assert.ok(
        g.content.width >= 580 && g.options.width >= 580,
        'Settings content must remain readable beside navigation'
      );
      assert.ok(g.nav.width >= 140 && g.nav.width <= 220);
      assert.ok(
        g.contentText.trim().length > 20,
        'Actual settings content must be rendered'
      );
    }
    for (const suffix of [
      'before',
      ...(withSpotlight
        ? ['search', 'settings', 'closed']
        : withSkin
          ? ['settings', 'closed']
          : []),
    ]) {
      const p = folder + '-' + suffix + '.png',
        bytes = await readFile(p);
      record.screenshots.push({
        path: p,
        bytes: bytes.length,
        sha256: sha256(bytes),
      });
    }
    record.status = 'passed';
  } catch (error) {
    record.status = 'failed';
    record.error = error.stack;
  } finally {
    await browserCommand(['close']).catch(() => {});
    try {
      process.kill(-child.pid, 'SIGTERM');
    } catch {}
    for (let i = 0; i < 40 && !exited; i++) await sleep(100);
    record.processStopped = exited;
    record.portProbe = await probeLoopbackPort(4016);
    const portProbe = record.portProbe.closed;
    record.portClosed = portProbe;
    if (!exited || !portProbe) record.status = 'failed';
    await writeFile(folder + '-stdout.log', redact(stdout));
    await writeFile(folder + '-stderr.log', redact(stderr));
    record.logSha256 = {
      stdout: sha256(redact(stdout)),
      stderr: sha256(redact(stderr)),
    };
    await writeFile(
      folder + '-receipt.json',
      JSON.stringify(record, null, 2) + '\n'
    );
  }
  return record;
}
