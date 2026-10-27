import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_SAMPLES, eventsOf, pushSample, tickOf, type PulseEvent, type Sample } from '../src/components/dashboard/history.ts';
import { describe } from '../src/components/dashboard/status.ts';
import type { InfoData } from '../src/components/dashboard/api.ts';
import { translator } from '../src/i18n/index.ts';

const tid = translator('id');
const ten = translator('en');
const texts = (events: PulseEvent[], t = tid) => events.map((e) => t(e.key, e.vars));

const sample = (t: number, over: Partial<Sample> = {}): Sample => ({
  t,
  up: true,
  started: true,
  healthy: true,
  ready: true,
  draining: false,
  uptime: 100 + t,
  cpu: 0,
  held: 0,
  ...over,
});

const info = (over: Partial<InfoData> = {}): InfoData =>
  ({
    hostname: 'pod-1',
    podName: 'pod-1',
    namespace: 'playground',
    appVersion: 'v2',
    nodeVersion: 'v24.22.1',
    uptimeSeconds: 250,
    rssMb: 94,
    ready: true,
    healthy: true,
    draining: false,
    started: true,
    load: { cpuWorkers: 0, heldMb: 0 },
    ...over,
  }) as InfoData;

test('pushSample keeps the newest MAX_SAMPLES and ignores a repeated timestamp', () => {
  let list: Sample[] = [];
  for (let i = 0; i < MAX_SAMPLES + 10; i++) list = pushSample(list, sample(i));
  assert.equal(list.length, MAX_SAMPLES);
  assert.equal(list[0].t, 10);
  assert.equal(list[list.length - 1].t, MAX_SAMPLES + 9);
  const again = pushSample(list, sample(MAX_SAMPLES + 9, { ready: false }));
  assert.equal(again.length, MAX_SAMPLES);
  assert.equal(again[again.length - 1].ready, false);
});

test('tickOf maps each row to ok, bad, warn or none', () => {
  assert.equal(tickOf('liveness', sample(1)), 'ok');
  assert.equal(tickOf('liveness', sample(1, { healthy: false })), 'bad');
  assert.equal(tickOf('readiness', sample(1, { ready: false })), 'bad');
  assert.equal(tickOf('readiness', sample(1, { ready: false, started: false })), 'warn');
  assert.equal(tickOf('traffic', sample(1)), 'ok');
  assert.equal(tickOf('traffic', sample(1, { draining: true, ready: false })), 'warn');
  assert.equal(tickOf('traffic', sample(1, { ready: false })), 'bad');
  for (const row of ['liveness', 'readiness', 'traffic'] as const) assert.equal(tickOf(row, sample(1, { up: false })), 'none');
});

test('eventsOf reports state changes, newest first, and renders in both languages', () => {
  const list = [sample(1), sample(2, { ready: false }), sample(3, { ready: false }), sample(4), sample(5, { healthy: false }), sample(6, { up: false }), sample(7)];
  const events = eventsOf(list, 10);
  assert.deepEqual(
    events.map((e) => e.t),
    [7, 6, 5, 4, 2],
  );
  assert.deepEqual(texts(events), ['Instance terjangkau lagi', 'Instance tidak terjangkau', 'Liveness gagal', 'Readiness pulih', 'Readiness mati']);
  assert.deepEqual(texts(events, ten), ['Instance reachable again', 'Instance unreachable', 'Liveness failed', 'Readiness recovered', 'Readiness turned off']);
  assert.equal(eventsOf(list, 2).length, 2);
  assert.deepEqual(eventsOf([sample(1)]), []);
  assert.deepEqual(eventsOf([sample(1), sample(2), sample(3)]), []);
});

test('eventsOf recognises draining and a container restart', () => {
  const drain = eventsOf([sample(1), sample(2, { draining: true, ready: false })]);
  assert.deepEqual(texts(drain), ['Pod mulai draining']);
  const restart = eventsOf([sample(1, { uptime: 500 }), sample(2, { uptime: 3 })]);
  assert.deepEqual(texts(restart), ['Container di-restart']);
  assert.equal(restart[0].tone, 'warn');
});

test('cpu and memory rows show load as warn and idle otherwise', () => {
  assert.equal(tickOf('cpu', sample(1)), 'idle');
  assert.equal(tickOf('cpu', sample(1, { cpu: 2 })), 'warn');
  assert.equal(tickOf('memory', sample(1)), 'idle');
  assert.equal(tickOf('memory', sample(1, { held: 100 })), 'warn');
  assert.equal(tickOf('cpu', sample(1, { up: false, cpu: 2 })), 'none');
});

test('eventsOf records chaos load starting, changing and ending', () => {
  const list = [sample(1), sample(2, { cpu: 2 }), sample(3, { cpu: 2, held: 100 }), sample(4, { held: 100 }), sample(5, { held: 200 }), sample(6)];
  const events = eventsOf(list, 10);
  assert.deepEqual(texts(events), ['Memori dilepas', 'Memori ditahan 200 MB', 'CPU kembali normal', 'Memori ditahan 100 MB', 'CPU dibakar, 2 worker']);
  assert.deepEqual(texts(events, ten), ['Memory released', 'Memory held: 200 MB', 'CPU back to normal', 'Memory held: 100 MB', 'CPU burning, 2 workers']);
  assert.deepEqual(texts(eventsOf([sample(1), sample(2, { cpu: 1 })]), ten), ['CPU burning, 1 worker']);
});

test('describe gives one plain sentence per state, in each language', () => {
  assert.equal(describe(null, false, null, tid).tone, 'pending');
  assert.equal(describe(info(), true, 1, tid).headline, 'Sehat, menerima traffic.');
  assert.equal(describe(info(), true, 1, ten).headline, 'Healthy, receiving traffic.');
  assert.equal(describe(info(), false, null, tid).detail, 'Belum ada data yang berhasil dimuat.');
  assert.equal(describe(info(), false, null, ten).detail, 'No data has been loaded yet.');
  assert.match(describe(info(), false, Date.now(), tid).detail, /^Data terakhir diambil pukul /);
  assert.match(describe(info(), false, Date.now(), ten).detail, /^Last data fetched at /);
  assert.equal(describe(info({ draining: true }), true, 1, tid).tone, 'warn');
  assert.equal(describe(info({ started: false }), true, 1, tid).headline, 'Belum selesai start.');
  assert.equal(describe(info({ started: false }), true, 1, ten).headline, 'Still starting.');
  assert.equal(describe(info({ healthy: false }), true, 1, tid).tone, 'err');
  assert.equal(describe(info({ ready: false }), true, 1, ten).headline, 'Not ready.');
});
