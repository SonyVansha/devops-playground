import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GET as healthz } from '../src/app/api/healthz/route.ts';
import { GET as readyz } from '../src/app/api/readyz/route.ts';
import { GET as livez } from '../src/app/api/livez/route.ts';
import { GET as startupz } from '../src/app/api/startupz/route.ts';
import { GET as info } from '../src/app/api/info/route.ts';
import { GET as headers } from '../src/app/api/headers/route.ts';
import { GET as echoGet, POST as echoPost } from '../src/app/api/echo/route.ts';
import { GET as status } from '../src/app/api/status/[code]/route.ts';
import { GET as delay } from '../src/app/api/delay/route.ts';
import { GET as metrics } from '../src/app/api/metrics/route.ts';
import { GET as gateway } from '../src/app/api/gateway/route.ts';
import { GET as flaky } from '../src/app/api/flaky/route.ts';
import { GET as sse } from '../src/app/api/sse/route.ts';
import { GET as payloadGet, POST as payloadPost } from '../src/app/api/payload/route.ts';
import { GET as redirect } from '../src/app/api/redirect/route.ts';
import { GET as corsGet, OPTIONS as corsOptions } from '../src/app/api/cors/route.ts';
import { GET as cookie } from '../src/app/api/cookie/route.ts';
import { GET as connect } from '../src/app/api/connect/route.ts';
import { GET as config } from '../src/app/api/config/route.ts';
import { GET as chaosStatus } from '../src/app/api/chaos/route.ts';
import { POST as notready } from '../src/app/api/chaos/notready/route.ts';
import { POST as unhealthy } from '../src/app/api/chaos/unhealthy/route.ts';
import { POST as cpu } from '../src/app/api/chaos/cpu/route.ts';
import { POST as memPost, DELETE as memDelete } from '../src/app/api/chaos/mem/route.ts';
import { state } from '../src/lib/state.ts';

const r = (path: string, init?: RequestInit) => new Request(`http://x${path}`, init);
const CHAOS = { method: 'POST', headers: { 'x-chaos-token': 'tok' } };

test('probe routes return 200', async () => {
  for (const handler of [healthz, livez, readyz, startupz]) {
    assert.equal((await handler(r('/p'), undefined)).status, 200);
  }
});

test('info route exposes instance data', async () => {
  const body = await (await info(r('/api/info'), undefined)).json();
  assert.equal(body.ready, true);
  assert.equal(typeof body.rssMb, 'number');
});

test('headers route redacts credentials', async () => {
  const res = await headers(r('/api/headers?a=1', { headers: { apikey: 'topsecret', 'x-foo': 'bar' } }), undefined);
  const body = await res.json();
  assert.equal(body.headers.apikey, '[REDACTED]');
  assert.equal(body.headers['x-foo'], 'bar');
  assert.equal(body.path, '/api/headers?a=1');
});

test('echo reflects body and rejects huge body', async () => {
  const ok = await echoPost(r('/api/echo?x=1', { method: 'POST', body: 'hi' }), undefined);
  assert.deepEqual((await ok.json()).query, { x: '1' });
  assert.equal((await echoGet(r('/api/echo'), undefined)).status, 200);
  const big = await echoPost(r('/api/echo', { method: 'POST', body: 'x'.repeat(70_000) }), undefined);
  assert.equal(big.status, 413);
});

test('status route validates code', async () => {
  const call = (code: string) => status(r('/s'), { params: Promise.resolve({ code }) });
  assert.equal((await call('503')).status, 503);
  assert.equal((await call('204')).status, 204);
  assert.equal((await call('abc')).status, 400);
  assert.equal((await call('999')).status, 400);
  assert.equal((await call('100')).status, 400);
});

test('delay clamps and waits', async () => {
  const res = await delay(r('/api/delay?ms=10'), undefined);
  assert.equal((await res.json()).delayedMs, 10);
});

test('metrics exposes route counters', async () => {
  const text = await (await metrics(r('/api/metrics'), undefined)).text();
  assert.match(text, /app_uptime_seconds \d+/);
  assert.match(text, /app_http_requests_total\{route="healthz",status="200"\}/);
});

test('gateway route lists allowlisted headers', async () => {
  const body = await (await gateway(r('/api/gateway', { headers: { 'x-consumer-username': 'demo' } }), undefined)).json();
  assert.equal(body.gateway['x-consumer-username'], 'demo');
});

test('flaky honours rate 0 and 100', async () => {
  assert.equal((await flaky(r('/api/flaky?rate=0'), undefined)).status, 200);
  assert.equal((await flaky(r('/api/flaky?rate=100&status=502'), undefined)).status, 502);
});

test('sse streams events then done', async () => {
  const res = await sse(r('/api/sse?events=2&interval=100'), undefined);
  assert.equal(res.headers.get('content-type')?.startsWith('text/event-stream'), true);
  const text = await res.text();
  assert.match(text, /id: 1/);
  assert.match(text, /id: 2/);
  assert.match(text, /event: done/);
});

test('payload download and upload', async () => {
  const down = await payloadGet(r('/api/payload?kb=2'), undefined);
  assert.equal((await down.arrayBuffer()).byteLength, 2048);
  const up = await payloadPost(r('/api/payload', { method: 'POST', body: 'x'.repeat(1000) }), undefined);
  assert.equal((await up.json()).receivedBytes, 1000);
  const empty = await payloadPost(r('/api/payload', { method: 'POST' }), undefined);
  assert.equal((await empty.json()).receivedBytes, 0);
});

test('redirect chain, final, and loop', async () => {
  const first = await redirect(r('/api/redirect?n=2&code=301'), undefined);
  assert.equal(first.status, 301);
  assert.equal(first.headers.get('location'), 'redirect?n=1&code=301');
  assert.equal((await redirect(r('/api/redirect?n=0'), undefined)).status, 200);
  const loop = await redirect(r('/api/redirect?loop=1&code=307'), undefined);
  assert.equal(loop.status, 307);
  assert.equal((await redirect(r('/api/redirect?n=1&code=399'), undefined)).status, 302);
});

test('cors defaults to no headers; app mode adds them', async () => {
  const plain = await corsOptions(r('/api/cors', { method: 'OPTIONS' }), undefined);
  assert.equal(plain.status, 204);
  assert.equal(plain.headers.get('access-control-allow-origin'), null);
  const app = await corsGet(r('/api/cors?mode=app', { headers: { origin: 'https://a.test' } }), undefined);
  assert.equal(app.headers.get('access-control-allow-origin'), '*');
  assert.equal((await app.json()).origin, 'https://a.test');
});

test('cookie sets validated cookie and lists names', async () => {
  const set = await cookie(r('/api/cookie?name=sid&value=abc', { headers: { 'x-forwarded-proto': 'https' } }), undefined);
  const setCookie = set.headers.get('set-cookie') ?? '';
  assert.match(setCookie, /sid=abc/);
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.equal((await cookie(r('/api/cookie?name=a b&value=1'), undefined)).status, 400);
  const body = await (await cookie(r('/api/cookie', { headers: { cookie: 'sid=abc; theme=dark' } }), undefined)).json();
  assert.deepEqual(body.cookieNames, ['sid', 'theme']);
});

test('connect enforces allowlist and validates input', async () => {
  delete process.env.CONNECT_ALLOWLIST;
  assert.equal((await connect(r('/api/connect?type=dns&target=localhost'), undefined)).status, 403);

  process.env.CONNECT_ALLOWLIST = 'localhost,127.0.0.1';
  assert.equal((await connect(r('/api/connect?type=dns&target=evil.example'), undefined)).status, 403);
  assert.equal((await connect(r('/api/connect?type=tcp&target=localhost'), undefined)).status, 400);
  assert.equal((await connect(r('/api/connect?type=http&target=ftp://localhost'), undefined)).status, 400);
  assert.equal((await connect(r('/api/connect?type=http&target=http://evil.example'), undefined)).status, 403);
  assert.equal((await connect(r('/api/connect?type=tcp&target=evil.example:80'), undefined)).status, 403);
  assert.equal((await connect(r('/api/connect?type=nope&target=x'), undefined)).status, 400);

  const dns = await (await connect(r('/api/connect?type=dns&target=localhost'), undefined)).json();
  assert.equal(dns.reachable, true);
  const tcp = await (await connect(r('/api/connect?type=tcp&target=127.0.0.1:1'), undefined)).json();
  assert.equal(tcp.reachable, false);
  const http = await (await connect(r('/api/connect?type=http&target=http://127.0.0.1:1/'), undefined)).json();
  assert.equal(http.reachable, false);
  delete process.env.CONNECT_ALLOWLIST;
});

test('config reports unmounted dir and lists mounted files without content', async () => {
  process.env.CONFIG_DIR = '/definitely/not/here';
  assert.equal((await (await config(r('/api/config'), undefined)).json()).mounted, false);
  process.env.CONFIG_DIR = new URL('.', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
  const body = await (await config(r('/api/config'), undefined)).json();
  assert.equal(body.mounted, true);
  const file = body.files.find((f: { name: string }) => f.name === 'lib.test.ts');
  assert.equal(file.sha256.length, 12);
  assert.equal('content' in file, false);
  delete process.env.CONFIG_DIR;
});

test('chaos routes are guarded and functional when enabled', async () => {
  delete process.env.ENABLE_CHAOS;
  assert.equal((await notready(r('/c', CHAOS), undefined)).status, 403);

  process.env.ENABLE_CHAOS = 'true';
  process.env.CHAOS_TOKEN = 'tok';
  assert.equal((await chaosStatus(r('/api/chaos'), undefined)).status, 200);

  assert.equal((await (await notready(r('/c', CHAOS), undefined)).json()).ready, false);
  assert.equal((await (await notready(r('/c', CHAOS), undefined)).json()).ready, true);
  assert.equal((await (await unhealthy(r('/c', CHAOS), undefined)).json()).healthy, false);
  assert.equal((await (await unhealthy(r('/c', CHAOS), undefined)).json()).healthy, true);

  const mem = await memPost(r('/c?mb=1', CHAOS), undefined);
  assert.equal((await mem.json()).heldMb, 1);
  assert.equal(state.heldMb, 1);
  assert.equal((await (await memDelete(r('/c', { ...CHAOS, method: 'DELETE' }), undefined)).json()).heldMb, 0);

  const burn = await cpu(r('/c?seconds=1&workers=1', CHAOS), undefined);
  assert.equal(burn.status, 202);
  const tooMany = await cpu(r('/c?seconds=1&workers=4', CHAOS), undefined);
  assert.equal(tooMany.status, 429);
  await new Promise((resolve) => setTimeout(resolve, 1500));

  delete process.env.ENABLE_CHAOS;
  delete process.env.CHAOS_TOKEN;
});

test('hello: healthy by default, fails at ERROR_RATE=100, honours latency', async () => {
  const { GET: hello } = await import('../src/app/api/hello/route.ts');
  process.env.APP_VERSION = 'v2';
  const ok = await (await hello(r('/api/hello'), undefined)).json();
  assert.equal(ok.message, 'hello');
  assert.equal(ok.version, 'v2');

  process.env.ERROR_RATE = '100';
  const bad = await hello(r('/api/hello'), undefined);
  assert.equal(bad.status, 500);
  assert.equal((await bad.json()).version, 'v2');

  process.env.ERROR_RATE = '0';
  process.env.LATENCY_MS = '50';
  const start = Date.now();
  await hello(r('/api/hello'), undefined);
  assert.ok(Date.now() - start >= 45);

  delete process.env.ERROR_RATE;
  delete process.env.LATENCY_MS;
  delete process.env.APP_VERSION;
});

test('startupz is 503 until started', async () => {
  state.started = false;
  assert.equal((await startupz(r('/api/startupz'), undefined)).status, 503);
  state.started = true;
  assert.equal((await startupz(r('/api/startupz'), undefined)).status, 200);
});
