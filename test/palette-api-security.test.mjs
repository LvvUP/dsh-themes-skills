import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  authorizePaletteRequest,
  PREMIUM_BODY_LIMIT_BYTES,
  readPaletteJson,
  securePremiumHostSource,
} from '../skills/dsh-community-skin-installer/assets/alpha/palettes/palette-api-security.mjs';

function response() {
  return {
    destroyed: false,
    headersSent: false,
    writes: 0,
    writeHead(status, headers) {
      this.status = status;
      this.headers = headers;
      this.headersSent = true;
      this.writes++;
    },
    end(body) { this.body = body; },
  };
}

function request(contentType = 'application/json') {
  const req = new EventEmitter();
  req.headers = contentType === undefined ? {} : { 'content-type': contentType };
  req.resume = () => { req.resumed = true; };
  return req;
}

test('palette authorization delegates the actual request and fails closed without the official service', () => {
  const req = request();
  for (const rejection of [undefined, 401, 403]) {
    const res = response();
    let calls = 0;
    const connection = { requestRejection(value) {
      assert.equal(value, req);
      assert.equal(this, connection);
      calls++;
      return rejection;
    } };
    assert.equal(authorizePaletteRequest(connection, req, res), rejection === undefined);
    assert.equal(calls, 1);
    assert.equal(res.writes, rejection === undefined ? 0 : 1);
    if (rejection !== undefined) assert.equal(res.status, rejection);
  }
  for (const missing of [undefined, {}, { requestRejection: null }]) {
    const res = response();
    assert.equal(authorizePaletteRequest(missing, req, res), false);
    assert.equal(res.status, 503);
  }
});

test('the JSON body limit counts UTF-8 bytes and accepts the exact 64 KiB boundary', async () => {
  for (const excess of [0, 1]) {
    const req = request('Application/JSON; charset=utf-8');
    const res = response();
    const result = readPaletteJson(req, res);
    const body = Buffer.from(JSON.stringify({ value: 'é'.repeat(32000) + 'x'.repeat(1524 + excess) }));
    assert.equal(body.length, PREMIUM_BODY_LIMIT_BYTES + excess);
    req.emit('data', body.subarray(0, 32001));
    req.emit('data', body.subarray(32001));
    req.emit('end');
    if (excess) {
      assert.equal(await result, undefined);
      assert.equal(res.status, 413);
    } else {
      assert.deepEqual(await result, JSON.parse(body.toString('utf8')));
      assert.equal(res.writes, 0);
    }
    assert.deepEqual(req.eventNames(), []);
  }
});

test('overflow drains subsequent chunks without responding twice or retaining request listeners', async () => {
  const req = request();
  const res = response();
  const result = readPaletteJson(req, res);
  req.emit('data', Buffer.alloc(PREMIUM_BODY_LIMIT_BYTES + 1));
  assert.equal(await result, undefined);
  req.emit('data', Buffer.alloc(100));
  req.emit('end');
  assert.equal(res.status, 413);
  assert.equal(res.writes, 1);
  assert.deepEqual(req.eventNames(), []);
});

test('non-JSON media types, malformed JSON and non-object bodies are rejected', async () => {
  for (const type of ['', 'text/plain', 'application/jsonp']) {
    const req = request(type);
    const res = response();
    assert.equal(await readPaletteJson(req, res), undefined);
    assert.equal(res.status, 415);
    assert.equal(req.resumed, true);
  }
  for (const body of ['{', 'null', '[]', '1', '"value"']) {
    const req = request();
    const res = response();
    const result = readPaletteJson(req, res);
    req.emit('data', body);
    req.emit('end');
    assert.equal(await result, undefined);
    assert.equal(res.status, 400);
    assert.deepEqual(req.eventNames(), []);
  }
});

test('interrupted request streams settle once and release their listeners on close', async () => {
  for (const event of ['error', 'aborted', 'close']) {
    const req = request();
    const res = response();
    const result = readPaletteJson(req, res);
    req.emit('data', '{');
    req.emit(event, new Error('synthetic local request failure'));
    req.emit('close');
    assert.equal(await result, undefined);
    assert.equal(res.status, 400);
    assert.equal(res.writes, 1);
    assert.deepEqual(req.eventNames(), []);
  }
});

test('Premium adaptation guards both fixed routes and refuses missing or duplicate source anchors', () => {
  const source = readFileSync(new URL('../skills/dsh-community-skin-installer/assets/alpha/palettes/upstream/premium/src/index.ts', import.meta.url), 'utf8');
  const adapted = securePremiumHostSource(source, './palette-api-security.mjs');
  assert.match(adapted, /ctx\.inject\(\['webServer', 'connection'\]/);
  assert.equal(adapted.split('if (!authorizePaletteRequest(httpCtx.connection, req, res)) return').length - 1, 2);
  assert.match(adapted, /readPaletteJson as readJson/);
  assert.doesNotMatch(adapted, /function readBody\(req: IncomingMessage\)/);
  const anchor = "ctx.inject(['webServer'], (httpCtx) => {";
  for (const invalid of [source.replace(anchor, ''), source + anchor, adapted]) {
    assert.throws(() => securePremiumHostSource(invalid, './palette-api-security.mjs'), /source no longer matches/);
  }
});
