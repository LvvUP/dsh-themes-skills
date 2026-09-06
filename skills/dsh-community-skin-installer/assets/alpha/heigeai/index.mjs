import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { DEFAULT_STATE, MAX_STATE_BYTES, normalizeState } from './state.mjs';

export const inject = ['webServer'];
const route = '/dsh-themes/heigeai/state';

export function apply(ctx) {
  const file = join(process.env.DSH_HOME || join(homedir(), '.dsh'), 'dsh-themes-heigeai.json');
  const reply = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(body)); };
  ctx.effect(() => ctx.webServer.register({ kind: 'exact', path: route, async handler(req, res) {
    try {
      if (req.method === 'GET') {
        let state = DEFAULT_STATE;
        try { state = normalizeState(JSON.parse(await readFile(file, 'utf8'))); } catch (error) { if (error.code !== 'ENOENT') throw error; }
        reply(res, 200, state); return;
      }
      if (req.method !== 'POST') { reply(res, 405, { error: 'Method not allowed.' }); return; }
      if (req.headers.origin !== `http://${req.headers.host}` || req.headers['sec-fetch-site'] !== 'same-origin') { reply(res, 403, { error: 'Same-origin browser request required.' }); return; }
      const chunks = []; let size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > MAX_STATE_BYTES) { reply(res, 413, { error: 'Image is too large.' }); return; } chunks.push(chunk); }
      const state = normalizeState(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      await mkdir(dirname(file), { recursive: true });
      const temporary = `${file}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify(state), { mode: 0o600 });
      await rename(temporary, file);
      reply(res, 200, state);
    } catch (error) { reply(res, 400, { error: error.message }); }
  } }), 'heigeai: durable local skin preferences');
}
