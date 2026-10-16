import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chaosGuard, tokenMatches } from '../src/lib/chaos.ts';
import { gatewayHeaders } from '../src/lib/gateway.ts';
import { wrap } from '../src/lib/handler.ts';
import { liveness, readiness } from '../src/lib/probe.ts';
import { record, state } from '../src/lib/state.ts';
import { chaosEnabled, clampInt, json, podInfo, redactHeaders, selfName } from '../src/lib/util.ts';

const req = (url = 'http://x/api', init?: RequestInit) => new Request(url, init);

test('clampInt returns fallback for invalid input', () => {
  assert.equal(clampInt(null, 0, 10, 5), 5);
  assert.equal(clampInt('abc', 0, 10, 5), 5);
  assert.equal(clampInt('-3', 0, 10, 5), 5);
});

test('clampInt clamps to range', () => {
  assert.equal(clampInt('999', 0, 10, 5), 10);
  assert.equal(clampInt('0', 1, 10, 5), 1);
  assert.equal(clampInt('7', 0, 10, 5), 7);
});

test('chaos disabled by default', () => {
  delete process.env.ENABLE_CHAOS;
  assert.equal(chaosEnabled(), false);
  process.env.ENABLE_CHAOS = 'true';
  assert.equal(chaosEnabled(), true);
  delete process.env.ENABLE_CHAOS;
});

test('redactHeaders hides credentials only', () => {
  const out = redactHeaders(new Headers({ authorization: 'Bearer abc', apikey: 'k', cookie: 'a=b', accept: 'x' }));
  assert.equal(out.authorization, '[REDACTED]');
  assert.equal(out.apikey, '[REDACTED]');
  assert.equal(out.cookie, '[REDACTED]');
  assert.equal(out.accept, 'x');
});

test('json sets no-store and extra headers', async () => {
  const res = json({ a: 1 }, 201, { 'X-Test': '1' });
  assert.equal(res.status, 201);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('x-test'), '1');
  assert.deepEqual(await res.json(), { a: 1 });
});

test('podInfo and selfName read env', () => {
  process.env.POD_NAME = 'pod-1';
  assert.equal(selfName(), 'pod-1');
  assert.equal(podInfo().podName, 'pod-1');
  delete process.env.POD_NAME;
});

test("probes follow state", async () => {
  state.healthy = true;
  state.ready = true;
  assert.equal(liveness().status, 200);
  assert.equal((await readiness()).status, 200);
  state.ready = false;
  assert.equal((await readiness()).status, 503);
  assert.equal(liveness().status, 200);
  state.ready = true;
  state.healthy = false;
  assert.equal(liveness().status, 503);
  state.healthy = true;
});

test('tokenMatches compares safely', () => {
  assert.equal(tokenMatches('secret', 'secret'), true);
  assert.equal(tokenMatches('secret', 'other'), false);
  assert.equal(tokenMatches('', 'secret'), false);
});

test('chaosGuard enforces enable flag, token and pod target', async () => {
  delete process.env.ENABLE_CHAOS;
  delete process.env.CHAOS_TOKEN;
  assert.equal(chaosGuard(req())?.status, 403);

  process.env.ENABLE_CHAOS = 'true';
  assert.equal(chaosGuard(req())?.status, 403); // token belum di-set

  process.env.CHAOS_TOKEN = 'tok';
  assert.equal(chaosGuard(req())?.status, 401);
  assert.equal(chaosGuard(req('http://x/', { headers: { 'x-chaos-token': 'bad' } }))?.status, 401);

  const ok = { headers: { 'x-chaos-token': 'tok' } };
  assert.equal(chaosGuard(req('http://x/', ok)), null);

  process.env.POD_NAME = 'me';
  assert.equal(chaosGuard(req('http://x/?pod=me', ok)), null);
  assert.equal(chaosGuard(req('http://x/?pod=other', ok))?.status, 409);

  delete process.env.ENABLE_CHAOS;
  delete process.env.CHAOS_TOKEN;
  delete process.env.POD_NAME;
});

test('gatewayHeaders only returns allowlisted headers', () => {
  const out = gatewayHeaders(new Headers({ 'x-consumer-username': 'demo', authorization: 'secret' }));
  assert.equal(out['x-consumer-username'], 'demo');
  assert.equal('authorization' in out, false);
  assert.equal(out['x-forwarded-for'], null);
});

test('wrap records metrics and converts throws to 500', async () => {
  const ok = wrap('t_ok', () => json({ ok: true }));
  const boom = wrap('t_boom', () => {
    throw new Error('x');
  });
  assert.equal((await ok(req(), undefined)).status, 200);
  assert.equal((await boom(req(), undefined)).status, 500);
  assert.equal(state.routes.t_ok.byStatus['200'], 1);
  assert.equal(state.routes.t_boom.byStatus['500'], 1);
  record('t_ok', 200, 5);
  assert.equal(state.routes.t_ok.count, 2);
});

test('behavior parses and clamps env', async () => {
  const { behavior } = await import('../src/lib/behavior.ts');
  const empty = behavior({});
  assert.deepEqual(empty, {
    startupDelaySeconds: 0,
    crashAfterSeconds: 0,
    bootFail: false,
    errorRate: 0,
    latencyMs: 0,
    leakMbPerMinute: 0,
  });
  const set = behavior({ BOOT_FAIL: 'true', ERROR_RATE: '999', LATENCY_MS: 'abc', STARTUP_DELAY_SECONDS: '5' });
  assert.equal(set.bootFail, true);
  assert.equal(set.errorRate, 100);
  assert.equal(set.latencyMs, 0);
  assert.equal(set.startupDelaySeconds, 5);
});

test('applyBehavior: boot fail exits immediately', async () => {
  const { applyBehavior, behavior } = await import('../src/lib/behavior.ts');
  const codes: number[] = [];
  applyBehavior(behavior({ BOOT_FAIL: 'true', STARTUP_DELAY_SECONDS: '5' }), (c) => codes.push(c));
  assert.deepEqual(codes, [1]);
  assert.equal(state.started, true); // tidak lanjut ke delay
});

test('applyBehavior: startup delay then ready; crash after N seconds', async () => {
  const { applyBehavior, behavior } = await import('../src/lib/behavior.ts');
  const codes: number[] = [];
  applyBehavior(behavior({ STARTUP_DELAY_SECONDS: '1', CRASH_AFTER_SECONDS: '1' }), (c) => codes.push(c));
  assert.equal(state.started, false);
  assert.equal(state.ready, false);
  await new Promise((resolve) => setTimeout(resolve, 1300));
  assert.equal(state.started, true);
  assert.equal(state.ready, true);
  assert.deepEqual(codes, [1]);
});

test('leakOnce grows held memory', async () => {
  const { leakOnce } = await import('../src/lib/behavior.ts');
  const before = state.heldMb;
  leakOnce(1);
  assert.equal(state.heldMb, before + 1);
  state.heldMb = before;
});

test('identitas pod: env HOSTNAME (alamat bind) tidak dipakai, cadangan = hostname OS', async () => {
  const { hostname } = await import('node:os');
  const saved = { POD_NAME: process.env.POD_NAME, HOSTNAME: process.env.HOSTNAME };
  delete process.env.POD_NAME;
  process.env.HOSTNAME = '0.0.0.0'; // kondisi di platform: image menyetel HOSTNAME sebagai alamat bind
  try {
    assert.equal(selfName(), hostname());
    assert.notEqual(selfName(), '0.0.0.0');
    const info = podInfo();
    assert.equal(info.podName, hostname());
    assert.equal(info.hostname, hostname());
    assert.equal(info.identitySource.pod, 'hostname');
  } finally {
    if (saved.POD_NAME === undefined) delete process.env.POD_NAME;
    else process.env.POD_NAME = saved.POD_NAME;
    if (saved.HOSTNAME === undefined) delete process.env.HOSTNAME;
    else process.env.HOSTNAME = saved.HOSTNAME;
  }
});

test('identitas pod: env downward API diutamakan dan sumbernya dicatat', () => {
  const keys = ['POD_NAME', 'POD_NAMESPACE', 'NODE_NAME', 'POD_IP'] as const;
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  Object.assign(process.env, { POD_NAME: 'web-1', POD_NAMESPACE: 'prod', NODE_NAME: 'node-a', POD_IP: '10.0.0.7' });
  try {
    const info = podInfo();
    assert.deepEqual(
      [info.podName, info.namespace, info.nodeName, info.podIp],
      ['web-1', 'prod', 'node-a', '10.0.0.7'],
    );
    assert.deepEqual(info.identitySource, { pod: 'env', namespace: 'env', nodeName: 'env', podIp: 'env' });
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
});

test('identitas pod: tanpa env, IP diambil dari antarmuka dan node tetap null', () => {
  const keys = ['POD_NAME', 'POD_NAMESPACE', 'NODE_NAME', 'POD_IP'] as const;
  const saved = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
  for (const k of keys) delete process.env[k];
  try {
    const info = podInfo();
    assert.equal(info.nodeName, null);
    assert.equal(info.identitySource.nodeName, null);
    assert.ok(info.podIp === null || /^\d{1,3}(\.\d{1,3}){3}$/.test(info.podIp), `IP tidak valid: ${info.podIp}`);
    assert.equal(info.identitySource.podIp, info.podIp === null ? null : 'interface');
    assert.ok(info.namespace === null || /^[a-z0-9-]+$/.test(info.namespace));
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
});
