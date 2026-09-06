/** Delegate exact-route authorization to the official browser connection. */
export function authorizePaletteRequest(connection, req, res) {
  // Readiness should be guaranteed by Cordis injection; fail closed if a
  // hand-built context or a disposing service violates that contract.
  if (typeof connection?.requestRejection !== 'function') {
    res.writeHead(503);
    res.end();
    return false;
  }
  const rejection = connection.requestRejection(req);
  if (rejection === undefined) return true;
  res.writeHead(rejection === 401 ? 401 : 403);
  res.end(rejection === 401 ? 'unauthorized' : 'forbidden');
  return false;
}

export const PREMIUM_BODY_LIMIT_BYTES = 64 * 1024;

/** Read one bounded JSON object without destroying the request on overflow. */
export function readPaletteJson(req, res) {
  const respond = (status, error) => {
    if (!res.destroyed && !res.headersSent) {
      res.writeHead(status, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error }));
    }
  };
  const mediaType = String(req.headers['content-type'] ?? '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  if (mediaType !== 'application/json') {
    respond(415, 'application/json required');
    req.resume();
    return Promise.resolve(undefined);
  }
  return new Promise((resolve) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    const fail = (status, message) => {
      if (settled) return;
      settled = true;
      chunks.length = 0;
      respond(status, message);
      resolve(undefined);
    };
    const cleanup = () => {
      req.off('data', onData);
      req.off('end', onEnd);
      req.off('error', onError);
      req.off('aborted', onAborted);
      req.off('close', onClose);
    };
    const onData = (part) => {
      // After overflow, drain rather than buffer or terminate the socket.
      if (settled) return;
      const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
      size += chunk.length;
      if (size > PREMIUM_BODY_LIMIT_BYTES) {
        fail(413, 'request body exceeds 64 KiB');
        return;
      }
      chunks.push(chunk);
    };
    const onEnd = () => {
      cleanup();
      if (settled) return;
      try {
        const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        if (
          value === null ||
          typeof value !== 'object' ||
          Array.isArray(value)
        ) {
          fail(400, 'request body must be a JSON object');
          return;
        }
        settled = true;
        chunks.length = 0;
        resolve(value);
      } catch {
        fail(400, 'request body must be a JSON object');
      }
    };
    const onError = () => {
      fail(400, 'request body interrupted');
      cleanup();
    };
    const onAborted = () => fail(400, 'request body interrupted');
    const onClose = () => {
      if (!settled) fail(400, 'request body interrupted');
      cleanup();
    };
    req.on('data', onData);
    req.once('end', onEnd);
    req.once('error', onError);
    req.once('aborted', onAborted);
    req.once('close', onClose);
  });
}

function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) {
    throw new Error('Premium security adaptation source no longer matches');
  }
  return source.replace(before, after);
}

/** Apply only the host security delta to the fixed, archived Premium source. */
export function securePremiumHostSource(source, helperSpecifier) {
  let result = replaceOnce(
    source,
    "ctx.inject(['webServer'], (httpCtx) => {",
    "ctx.inject(['webServer', 'connection'], (httpCtx) => {"
  );
  for (const handler of ['paletteRouteHandler', 'customRouteHandler']) {
    result = replaceOnce(
      result,
      `handler: (req, res) => ${handler}(settings(), req, res),`,
      `handler: (req, res) => {\n          if (!authorizePaletteRequest(httpCtx.connection, req, res)) return\n          return ${handler}(settings(), req, res)\n        },`
    );
  }
  const bodyStart = result.indexOf('function readBody(req: IncomingMessage)');
  const bodyEnd = result.indexOf('\nfunction json(', bodyStart);
  const jsonStart = result.indexOf('async function readJson(\n');
  const jsonEnd = result.indexOf('\n/**\n * Normalize ', jsonStart);
  if (
    bodyStart < 0 ||
    bodyEnd <= bodyStart ||
    jsonStart <= bodyEnd ||
    jsonEnd <= jsonStart
  ) {
    throw new Error('Premium body reader source no longer matches');
  }
  result = result.slice(0, jsonStart) + result.slice(jsonEnd);
  result = result.slice(0, bodyStart) + result.slice(bodyEnd);
  return `import { authorizePaletteRequest, readPaletteJson as readJson } from ${JSON.stringify(helperSpecifier)}\n${result}`;
}
