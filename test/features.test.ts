import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { GET as cache } from '../src/app/api/cache/route.ts';
import { GET as chain } from '../src/app/api/chain/route.ts';
import { GET as metrics } from '../src/app/api/metrics/route.ts';
import { GET as info } from '../src/app/api/info/route.ts';
import { GET as readyz } from '../src/app/api/readyz/route.ts';
import { GET as basic } from '../src/app/api/secure/basic/route.ts';
import { GET as jwtRoute } from '../src/app/api/secure/jwt/route.ts';
import { GET as whoami } from '../src/app/api/secure/whoami/route.ts';
import { resetDependencyCache } from '../src/lib/dependency.ts';
import { nextTrace } from '../src/lib/chain.ts';
import { bearerToken, parseJwt, verifyHs256 } from '../src/lib/jwt.ts';
import { notModified, parseMode, parseVary, cacheControl } from '../src/lib/cache.ts';

// Koneksi keep-alive lama bisa menghasilkan RESET alih-alih REFUSED; keduanya berarti "server mati".
const DEAD = /^(ECONNREFUSED|ECONNRESET|UND_ERR_SOCKET)$/;
const r = (path: string, headers?: Record<string, string>) => new Request(`http://x${path}`, { headers });

interface TestServer {
  url: string;
  close: () => Promise<void>;
}

// Server HTTP sungguhan yang membungkus handler route (Request -> Response), untuk tes hop nyata.
async function serve(handler: (request: Request) => Response | Promise<Response>): Promise<TestServer> {
  const server: Server = createServer(async (req, res) => {
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
    const response = await handler(new Request(`http://${req.headers.host}${req.url}`, { method: req.method, headers }));
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(Buffer.from(await response.arrayBuffer()));
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

const b64url = (v: object | string) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');
function signJwt(payload: object, secret: string, alg = 'HS256'): string {
  const input = `${b64url({ alg, typ: 'JWT' })}.${b64url(payload)}`;
  return `${input}.${createHmac('sha256', secret).update(input).digest('base64url')}`;
}

// ---------- JWT ----------

test('bearerToken and parseJwt handle malformed input', () => {
  assert.equal(bearerToken(null), null);
  assert.equal(bearerToken('Basic abc'), null);
  assert.equal(bearerToken('bearer tok.en.x'), 'tok.en.x');
  assert.equal(parseJwt('a.b'), null);
  assert.equal(parseJwt('!!.!!.!!'), null);
  assert.equal(parseJwt('x'.repeat(9000)), null);
  assert.equal(parseJwt(`${b64url('[]')}.${b64url({})}.sig`), null); // header bukan object
});

test('verifyHs256 accepts valid and rejects tampered, wrong alg, wrong secret', () => {
  const good = parseJwt(signJwt({ sub: 'a' }, 's3cret'))!;
  assert.equal(verifyHs256(good, 's3cret'), true);
  assert.equal(verifyHs256(good, 'other'), false);
  const none = parseJwt(`${b64url({ alg: 'none' })}.${b64url({ sub: 'a' })}.`)!;
  assert.equal(verifyHs256(none, 's3cret'), false);
  const tampered = parseJwt(signJwt({ sub: 'a' }, 's3cret').replace(/\.[^.]+\./, `.${b64url({ sub: 'admin' })}.`))!;
  assert.equal(verifyHs256(tampered, 's3cret'), false);
});

test('secure/jwt: 401 without or with malformed token', async () => {
  delete process.env.JWT_SECRET;
  assert.equal((await jwtRoute(r('/api/secure/jwt'), undefined)).status, 401);
  const bad = await jwtRoute(r('/api/secure/jwt', { authorization: 'Bearer nope' }), undefined);
  assert.equal(bad.status, 401);
  assert.equal(bad.headers.get('www-authenticate'), 'Bearer');
});

test('secure/jwt: decodes claims without verifying when JWT_SECRET is unset', async () => {
  delete process.env.JWT_SECRET;
  const token = signJwt({ sub: 'alice', exp: Math.floor(Date.now() / 1000) + 600 }, 'whatever');
  const res = await jwtRoute(r('/api/secure/jwt', { authorization: `Bearer ${token}` }), undefined);
  const body = await res.json();
  assert.equal(res.status, 200);
  assert.equal(body.verified, null);
  assert.equal(body.claims.sub, 'alice');
  assert.equal(body.expired, false);
  assert.match(body.note, /NOT verified/);
  assert.equal(JSON.stringify(body).includes(token.split('.')[2]), false); // signature tidak dikembalikan
});

test('secure/jwt: verifies signature and expiry when JWT_SECRET is set', async () => {
  process.env.JWT_SECRET = 'topsecret';
  const call = (token: string) => jwtRoute(r('/api/secure/jwt', { authorization: `Bearer ${token}` }), undefined);
  const future = Math.floor(Date.now() / 1000) + 600;
  const ok = await call(signJwt({ sub: 'a', exp: future }, 'topsecret'));
  assert.equal(ok.status, 200);
  assert.equal((await ok.json()).verified, true);
  assert.equal((await call(signJwt({ sub: 'a', exp: future }, 'wrong'))).status, 401);
  const expired = await call(signJwt({ sub: 'a', exp: 1 }, 'topsecret'));
  assert.equal(expired.status, 401);
  assert.equal((await expired.json()).error, 'token expired');
  delete process.env.JWT_SECRET;
});

// ---------- whoami & basic ----------

test('secure/whoami reports gateway identity and enforces ?require=1', async () => {
  const anon = await (await whoami(r('/api/secure/whoami'), undefined)).json();
  assert.equal(anon.authenticated, false);
  assert.equal((await whoami(r('/api/secure/whoami?require=1'), undefined)).status, 401);

  const headers = { 'x-consumer-username': 'demo-user', 'x-consumer-id': 'abc', authorization: 'Bearer xyz' };
  const body = await (await whoami(r('/api/secure/whoami?require=1', headers), undefined)).json();
  assert.equal(body.authenticated, true);
  assert.equal(body.consumer.username, 'demo-user');
  assert.equal(body.authorizationScheme, 'Bearer');
  assert.equal(JSON.stringify(body).includes('xyz'), false);

  const anonymous = await (await whoami(r('/api/secure/whoami', { ...headers, 'x-anonymous-consumer': 'true' }), undefined)).json();
  assert.equal(anonymous.authenticated, false);
});

test('secure/basic: 503 unconfigured, 401 wrong, 200 correct', async () => {
  delete process.env.BASIC_USER;
  delete process.env.BASIC_PASSWORD;
  assert.equal((await basic(r('/api/secure/basic'), undefined)).status, 503);

  process.env.BASIC_USER = 'admin';
  process.env.BASIC_PASSWORD = 'p:ass';
  const auth = (u: string, p: string) => ({ authorization: `Basic ${Buffer.from(`${u}:${p}`).toString('base64')}` });
  const missing = await basic(r('/api/secure/basic'), undefined);
  assert.equal(missing.status, 401);
  assert.match(missing.headers.get('www-authenticate') ?? '', /^Basic realm=/);
  assert.equal((await basic(r('/api/secure/basic', auth('admin', 'nope')), undefined)).status, 401);
  assert.equal((await basic(r('/api/secure/basic', auth('root', 'p:ass')), undefined)).status, 401);
  assert.equal((await basic(r('/api/secure/basic', { authorization: 'Basic !!!' }), undefined)).status, 401);
  const ok = await basic(r('/api/secure/basic', auth('admin', 'p:ass')), undefined);
  assert.equal(ok.status, 200);
  assert.deepEqual(await ok.json(), { authenticated: true, user: 'admin' });
  delete process.env.BASIC_USER;
  delete process.env.BASIC_PASSWORD;
});

// ---------- cache ----------

test('cache helpers', () => {
  assert.equal(parseMode('swr'), 'swr');
  assert.equal(parseMode('evil'), 'public');
  assert.equal(cacheControl('nostore', 10, null), 'no-store');
  assert.equal(cacheControl('private', 10, 5), 'private, max-age=10');
  assert.equal(cacheControl('swr', 30, 60), 'public, max-age=30, stale-while-revalidate=30, s-maxage=60');
  assert.equal(parseVary('Accept-Encoding, x-evil, X-Tenant'), 'accept-encoding, x-tenant');
  assert.equal(parseVary('x-evil'), null);
  assert.equal(notModified(new Headers({ 'if-none-match': '*' }), '"a"'), true);
  assert.equal(notModified(new Headers({ 'if-none-match': 'W/"a", "b"' }), '"a"'), true);
  assert.equal(notModified(new Headers({ 'if-none-match': '"zzz"' }), '"a"'), false);
  assert.equal(notModified(new Headers({ 'if-modified-since': 'garbage' }), '"a"'), false);
  assert.equal(notModified(new Headers(), '"a"'), false);
});

test('cache route: headers, ETag revalidation (304), Last-Modified, Vary', async () => {
  const first = await cache(r('/api/cache?ttl=120&mode=swr&smax=300&vary=accept-encoding&v=7'), undefined);
  assert.equal(first.status, 200);
  assert.equal(first.headers.get('cache-control'), 'public, max-age=120, stale-while-revalidate=120, s-maxage=300');
  assert.equal(first.headers.get('vary'), 'accept-encoding');
  const etag = first.headers.get('etag')!;
  assert.match(etag, /^"[0-9a-f]{16}"$/);
  assert.equal((await first.json()).v, '7');

  const inm = await cache(r('/api/cache?ttl=120&mode=swr&smax=300&vary=accept-encoding&v=7', { 'if-none-match': etag }), undefined);
  assert.equal(inm.status, 304);
  assert.equal(inm.headers.get('etag'), etag);
  assert.equal(await inm.text(), '');

  const other = await cache(r('/api/cache?v=8', { 'if-none-match': etag }), undefined);
  assert.equal(other.status, 200); // versi beda -> ETag beda -> konten baru

  const ims = await cache(r('/api/cache', { 'if-modified-since': 'Thu, 01 Jan 2026 00:00:00 GMT' }), undefined);
  assert.equal(ims.status, 304);
});

test('cache route: nostore never validates; padding and bad version', async () => {
  const res = await cache(r('/api/cache?mode=nostore', { 'if-none-match': '*' }), undefined);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('etag'), null);
  const big = await (await cache(r('/api/cache?kb=2&v=../x'), undefined)).json();
  assert.equal(big.v, '1');
  assert.equal(big.padding.length, 2048);
});

// ---------- chain ----------

test('nextTrace keeps trace id, creates new span id', () => {
  const incoming = `00-${'a'.repeat(32)}-${'b'.repeat(16)}-01`;
  const t = nextTrace(incoming);
  assert.equal(t.traceId, 'a'.repeat(32));
  assert.equal(t.parentSpanId, 'b'.repeat(16));
  assert.notEqual(t.spanId, 'b'.repeat(16));
  const fresh = nextTrace('garbage');
  assert.match(fresh.traceId, /^[0-9a-f]{32}$/);
  assert.equal(fresh.parentSpanId, null);
});

test('chain: leaf when no upstream or depth 0', async () => {
  delete process.env.UPSTREAM_URL;
  const body = await (await chain(r('/api/chain?depth=3'), undefined)).json();
  assert.equal(body.leaf, true);
  assert.equal(body.upstream, 'not configured');
  process.env.UPSTREAM_URL = 'ftp://nope';
  assert.equal((await (await chain(r('/api/chain?depth=3'), undefined)).json()).upstream, 'not configured');
  delete process.env.UPSTREAM_URL;
});

test('chain: multi-hop over real HTTP keeps trace id and propagates headers', async () => {
  const seen: Array<Record<string, string | null>> = [];
  const srv = await serve((request) => {
    seen.push({
      traceparent: request.headers.get('traceparent'),
      requestId: request.headers.get('x-request-id'),
      correlation: request.headers.get('x-correlation-id'),
    });
    return chain(request, undefined);
  });
  process.env.UPSTREAM_URL = `${srv.url}/`; // trailing slash dinormalkan
  try {
    const traceId = 'c'.repeat(32);
    const res = await chain(
      r('/api/chain?depth=3', { traceparent: `00-${traceId}-${'d'.repeat(16)}-01`, 'x-correlation-id': 'corr-1', 'x-request-id': 'req-1' }),
      undefined,
    );
    const body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.depth, 3);
    assert.equal(body.downstream.depth, 2);
    assert.equal(body.downstream.downstream.depth, 1);
    assert.equal(body.downstream.downstream.downstream.depth, 0);
    assert.equal(body.downstream.downstream.downstream.leaf, true);

    const hops = [body, body.downstream, body.downstream.downstream, body.downstream.downstream.downstream];
    assert.ok(hops.every((h) => h.traceId === traceId));
    assert.equal(new Set(hops.map((h) => h.spanId)).size, 4);
    assert.ok(hops.every((h) => h.requestId === 'req-1'));
    assert.equal(hops[1].parentSpanId, hops[0].spanId);

    assert.equal(seen.length, 3);
    assert.ok(seen.every((s) => s.correlation === 'corr-1' && s.requestId === 'req-1'));
  } finally {
    delete process.env.UPSTREAM_URL;
    await srv.close();
  }
});

test('chain: downstream failure becomes 502 and cascades', async () => {
  const srv = await serve(() => new Response('boom', { status: 503 }));
  process.env.UPSTREAM_URL = srv.url;
  try {
    const res = await chain(r('/api/chain?depth=2'), undefined);
    const body = await res.json();
    assert.equal(res.status, 502);
    assert.equal(body.error, 'downstream failed');
    assert.equal(body.downstream.status, 503);
  } finally {
    await srv.close();
  }
  // upstream mati total (port tertutup)
  const down = await chain(r('/api/chain?depth=2'), undefined);
  assert.equal(down.status, 502);
  assert.match((await down.json()).downstream.error, DEAD);
  delete process.env.UPSTREAM_URL;
});

test('chain: slow downstream hits CHAIN_TIMEOUT_MS', async () => {
  const srv = await serve(async () => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    return new Response('{}');
  });
  process.env.UPSTREAM_URL = srv.url;
  process.env.CHAIN_TIMEOUT_MS = '150';
  try {
    const res = await chain(r('/api/chain?depth=1'), undefined);
    assert.equal(res.status, 502);
    assert.equal((await res.json()).downstream.error, 'TIMEOUT');
  } finally {
    delete process.env.UPSTREAM_URL;
    delete process.env.CHAIN_TIMEOUT_MS;
    await srv.close();
  }
});

// ---------- dependency-aware readiness ----------

test('readiness follows DEPENDENCY_URL; liveness-independent; metrics and info expose it', async () => {
  let status = 200;
  const srv = await serve(() => new Response('{}', { status }));
  try {
    delete process.env.DEPENDENCY_URL;
    resetDependencyCache();
    assert.equal((await readyz(r('/api/readyz'), undefined)).status, 200);
    assert.equal((await (await info(r('/api/info'), undefined)).json()).dependency.configured, false);

    process.env.DEPENDENCY_URL = `${srv.url}/api/readyz`;
    resetDependencyCache();
    const ok = await readyz(r('/api/readyz'), undefined);
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).dependency.ok, true);
    const text = await (await metrics(r('/api/metrics'), undefined)).text();
    assert.match(text, /app_dependency_up 1/);

    status = 503;
    resetDependencyCache();
    const bad = await readyz(r('/api/readyz'), undefined);
    assert.equal(bad.status, 503);
    assert.equal((await bad.json()).dependency.status, 503);
    assert.match(await (await metrics(r('/api/metrics'), undefined)).text(), /app_dependency_up 0/);

    status = 200; // hasil di-cache 2 dtk: tanpa reset masih gagal
    assert.equal((await readyz(r('/api/readyz'), undefined)).status, 503);
    resetDependencyCache();
    assert.equal((await readyz(r('/api/readyz'), undefined)).status, 200);
  } finally {
    await srv.close();
  }
  // dependency mati total
  resetDependencyCache();
  const down = await readyz(r('/api/readyz'), undefined);
  assert.equal(down.status, 503);
  assert.match((await down.json()).dependency.error, DEAD);

  process.env.DEPENDENCY_URL = 'ftp://invalid';
  resetDependencyCache();
  assert.equal((await readyz(r('/api/readyz'), undefined)).status, 200); // URL tidak valid = tidak dikonfigurasi
  delete process.env.DEPENDENCY_URL;
  resetDependencyCache();
});

test('cache route: gzip=1 compresses only when client accepts gzip; ETag differs per encoding', async () => {
  const { gunzipSync } = await import('node:zlib');
  const plain = await cache(r('/api/cache?kb=64&gzip=1&v=z'), undefined);
  assert.equal(plain.headers.get('content-encoding'), null); // klien tidak minta gzip -> identity
  assert.match(plain.headers.get('vary') ?? '', /accept-encoding/);
  const plainBody = await plain.text();

  const zipped = await cache(r('/api/cache?kb=64&gzip=1&v=z', { 'accept-encoding': 'br, gzip;q=0.8' }), undefined);
  assert.equal(zipped.headers.get('content-encoding'), 'gzip');
  assert.notEqual(zipped.headers.get('etag'), plain.headers.get('etag'));
  const bytes = new Uint8Array(await zipped.arrayBuffer());
  assert.ok(bytes.length < plainBody.length / 20);
  assert.equal(JSON.parse(gunzipSync(bytes).toString('utf8')).v, 'z');

  const untouched = await cache(r('/api/cache?kb=64&v=z', { 'accept-encoding': 'gzip' }), undefined);
  assert.equal(untouched.headers.get('content-encoding'), null); // tanpa gzip=1 tidak pernah dikompres
});

// ---------- identitas gateway yang dapat dikonfigurasi (Envoy Gateway / Kong) ----------

test('identity: nama header bawaan mencakup Kong dan Envoy Gateway, urutan = prioritas', async () => {
  const { identityHeaders, findIdentity, DEFAULT_IDENTITY_HEADERS } = await import('../src/lib/identity.ts');
  assert.deepEqual(identityHeaders(undefined), [...DEFAULT_IDENTITY_HEADERS]);
  assert.deepEqual(identityHeaders(''), [...DEFAULT_IDENTITY_HEADERS]);
  assert.deepEqual(identityHeaders(' X-Foo , x-bar '), ['x-foo', 'x-bar']);
  assert.deepEqual(identityHeaders('bad header!, ../x,'), [...DEFAULT_IDENTITY_HEADERS]); // semua tidak valid -> bawaan
  assert.deepEqual(identityHeaders('ok-1,bad name'), ['ok-1']);

  const h = new Headers({ 'x-client-id': 'client-a', 'x-user': 'alice' });
  assert.deepEqual(findIdentity(h), { header: 'x-client-id', value: 'client-a' }); // x-client-id lebih dulu dari x-user
  assert.deepEqual(findIdentity(h, ['x-user']), { header: 'x-user', value: 'alice' });
  assert.equal(findIdentity(new Headers({ 'x-user': '   ' })), null); // kosong dianggap tidak ada
  assert.equal(findIdentity(new Headers()), null);
  assert.equal(findIdentity(new Headers({ 'x-user': 'a'.repeat(400) }))?.value.length, 256); // dibatasi
});

test('whoami: membaca identitas dari header Envoy Gateway dan dari IDENTITY_HEADERS', async () => {
  delete process.env.IDENTITY_HEADERS;
  const viaClient = await (await whoami(r('/api/secure/whoami', { 'x-client-id': 'demo-user' }), undefined)).json();
  assert.equal(viaClient.authenticated, true);
  assert.equal(viaClient.identityHeader, 'x-client-id');
  assert.equal(viaClient.consumer.username, 'demo-user');

  const viaUser = await (await whoami(r('/api/secure/whoami?require=1', { 'x-user': 'alice' }), undefined)).json();
  assert.equal(viaUser.identityHeader, 'x-user');

  const kong = await (await whoami(r('/api/secure/whoami', { 'x-consumer-username': 'k', 'x-client-id': 'e' }), undefined)).json();
  assert.equal(kong.identityHeader, 'x-consumer-username'); // Kong diprioritaskan sesuai urutan bawaan

  process.env.IDENTITY_HEADERS = 'x-jwt-sub';
  try {
    const custom = await (await whoami(r('/api/secure/whoami', { 'x-jwt-sub': 'sub-123', 'x-client-id': 'diabaikan' }), undefined)).json();
    assert.equal(custom.identityHeader, 'x-jwt-sub');
    assert.equal(custom.consumer.username, 'sub-123');
    assert.deepEqual(custom.watchedHeaders, ['x-jwt-sub']);
    const ignored = await (await whoami(r('/api/secure/whoami', { 'x-client-id': 'abaikan-saja' }), undefined)).json();
    assert.equal(ignored.authenticated, false); // header bawaan tidak dipantau lagi bila dikonfigurasi
  } finally {
    delete process.env.IDENTITY_HEADERS;
  }
});

test('gatewayHeaders menampilkan header khas Envoy dan identitas, tanpa membocorkan kredensial', async () => {
  const { gatewayHeaders } = await import('../src/lib/gateway.ts');
  const out = gatewayHeaders(
    new Headers({ 'x-envoy-external-address': '1.2.3.4', 'x-forwarded-port': '8080', 'x-client-id': 'c', 'x-request-id': 'rid', authorization: 'Bearer rahasia' }),
  );
  assert.equal(out['x-envoy-external-address'], '1.2.3.4');
  assert.equal(out['x-forwarded-port'], '8080');
  assert.equal(out['x-client-id'], 'c');
  assert.equal(out['x-request-id'], 'rid');
  assert.equal('authorization' in out, false);
});
