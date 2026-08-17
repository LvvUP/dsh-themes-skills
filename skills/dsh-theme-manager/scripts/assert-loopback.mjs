#!/usr/bin/env node

const args = process.argv.slice(2);
if (args.length !== 2 || args[0] !== '--url') {
  throw new Error('Usage: assert-loopback.mjs --url <http://127.0.0.1:port or http://[::1]:port>');
}

const url = new URL(args[1]);
const allowedHost = url.hostname === '127.0.0.1' || url.hostname === '[::1]';
if (
  url.protocol !== 'http:' ||
  !allowedHost ||
  url.username ||
  url.password ||
  url.search ||
  url.hash
) {
  throw new Error('real UI acceptance is allowed only on credential-free loopback HTTP URLs');
}
process.stdout.write(`${JSON.stringify({ status: 'loopback-only', url: url.toString() })}\n`);
