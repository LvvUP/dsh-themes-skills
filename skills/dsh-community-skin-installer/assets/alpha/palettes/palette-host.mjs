import z from '@deepseek-ai/schemastery';

import config from './adapter-config.json' with { type: 'json' };

const namespace = `dsh-community-${config.group}`;
const route = `/api/dsh-community-palettes/${config.group}`;
const selections = ['off', ...config.themes.map((theme) => theme.id)];
const schema = z.object({
  selection: z.union(selections).default('off'),
  base: z.union(['light', 'dark', 'system']).default('system'),
});

function json(res, status, body) {
  res.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

export const name = `dsh-community-${config.group}`;
export const inject = ['settings', 'webServer'];
export function apply(ctx) {
  ctx.settings.register(namespace, schema);
  ctx.effect(
    () =>
      ctx.webServer.register({
        kind: 'exact',
        path: route,
        async handler(req, res) {
          const current = () => ({
            ...ctx.settings.get(namespace),
            themes: config.themes,
          });
          if (req.method === 'GET') return json(res, 200, current());
          if (req.method !== 'POST')
            return json(res, 405, { error: 'method-not-allowed' });
          if (
            req.headers.origin &&
            new URL(req.headers.origin).host !== req.headers.host
          )
            return json(res, 403, { error: 'origin-mismatch' });
          if (
            !String(req.headers['content-type'] ?? '').startsWith(
              'application/json'
            )
          )
            return json(res, 415, { error: 'json-required' });
          try {
            let body = '';
            for await (const part of req) {
              body += part;
              if (body.length > 4096)
                return json(res, 413, { error: 'body-too-large' });
            }
            const input = JSON.parse(body);
            const selected =
              input.catalogId === undefined
                ? input.selection
                : config.themes.find(
                    (theme) => theme.catalogId === input.catalogId
                  )?.id;
            if (!selections.includes(selected))
              return json(res, 400, { error: 'unknown-selection' });
            const base = input.base ?? current().base;
            if (!['light', 'dark', 'system'].includes(base))
              return json(res, 400, { error: 'invalid-base' });
            await ctx.settings.update(namespace, { selection: selected, base });
            return json(res, 200, current());
          } catch {
            return json(res, 400, { error: 'invalid-selection' });
          }
        },
      }),
    `${name}: durable palette route`
  );
}
