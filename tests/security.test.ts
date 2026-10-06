import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allowedOrigins, apiCors, securityHeaders } from '../server/security';

const run = (mw: any, req: any) => {
  const headers: Record<string, string> = {};
  const res: any = { statusCode: 200, body: undefined, ended: false };
  res.setHeader = (k: string, v: string) => (headers[k] = v);
  res.status = (c: number) => ((res.statusCode = c), res);
  res.json = (b: unknown) => ((res.body = b), res);
  res.end = () => ((res.ended = true), res);
  let nextCalled = false;
  mw({ headers: {}, method: 'POST', ...req }, res, () => (nextCalled = true));
  return { headers, res, nextCalled };
};

test('the phone app and listed sites may call the API; other sites may not', () => {
  const cors = apiCors(allowedOrigins('https://app.example.com'));
  assert.equal(run(cors, { headers: { origin: 'capacitor://localhost', host: 'api.example.com' } }).headers['Access-Control-Allow-Origin'], 'capacitor://localhost');
  assert.equal(run(cors, { headers: { origin: 'https://app.example.com', host: 'api.example.com' } }).nextCalled, true);
  const blocked = run(cors, { headers: { origin: 'https://evil.example', host: 'api.example.com' } });
  assert.equal(blocked.res.statusCode, 403);
  assert.equal(blocked.nextCalled, false);
  // Same-origin (the web app on its own server) and non-browser requests pass without CORS headers
  const same = run(cors, { headers: { origin: 'https://api.example.com', host: 'api.example.com' } });
  assert.equal(same.nextCalled, true);
  assert.equal(same.headers['Access-Control-Allow-Origin'], undefined);
  assert.equal(run(cors, { headers: {} }).nextCalled, true);
  // Preflight answered without reaching the reader
  const pre = run(cors, { method: 'OPTIONS', headers: { origin: 'capacitor://localhost', host: 'api.example.com' } });
  assert.equal(pre.res.statusCode, 204);
  assert.equal(pre.nextCalled, false);
});

test('production pages carry standard browser protections', () => {
  const { headers, nextCalled } = run(securityHeaders, {});
  assert.ok(nextCalled);
  assert.match(headers['Content-Security-Policy'], /frame-ancestors 'none'/);
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['Referrer-Policy'], 'no-referrer');
});
