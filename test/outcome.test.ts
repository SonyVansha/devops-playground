import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clip, fmtBytes, hasPlaceholder, prettyBody, statusLine, summarize, transcript } from '../src/components/dashboard/outcome.ts';
import { translator } from '../src/i18n/index.ts';

const tid = translator('id');
const ten = translator('en');

const res = (status: number, body: unknown = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  ms: 5,
  headers: [] as Array<[string, string]>,
  body: typeof body === 'string' ? body : JSON.stringify(body),
  redirected: false,
  url: '',
});

test('summarize maps HTTP statuses to plain-language messages (Indonesian)', () => {
  assert.match(summarize('x', res(0), tid).text, /Tidak bisa menghubungi/);
  assert.equal(summarize('x', res(401), tid, { token: 'DB token' }).text, 'DB token salah.');
  assert.match(summarize('x', res(403), tid, { token: 'Chaos token' }).text, /Chaos token belum di-set/);
  assert.match(summarize('x', res(409, { error: 'pod mismatch' }), tid).text, /bukan target/);
  assert.equal(summarize('x', res(412, { missing: ['host', 'user'] }), tid).text, 'Koneksi belum lengkap: isi host, user.');
  assert.equal(summarize('x', res(412), tid).text, 'Koneksi belum lengkap.');
  assert.equal(summarize('x', res(400, { error: 'invalid table name' }), tid).text, 'invalid table name');
  assert.equal(summarize('x', res(502, { error: 'ECONNREFUSED' }), tid).text, 'Server menolak koneksi. Periksa host dan port.');
  assert.equal(summarize('x', res(502, { error: 'WEIRD' }), tid).text, 'Gagal (WEIRD).');
  assert.equal(summarize('x', res(502, 'not json'), tid).text, 'Gagal (502).');
  assert.equal(summarize('x', res(502), tid).tone, 'err');
});

test('summarize speaks English by default', () => {
  assert.equal(summarize('x', res(0), ten).text, 'Cannot reach the app server.');
  assert.equal(summarize('x', res(401), ten, { token: 'DB token' }).text, 'DB token is wrong.');
  assert.equal(summarize('x', res(403), ten, { token: 'Chaos token' }).text, 'The feature is disabled or Chaos token is not set on the server.');
  assert.equal(summarize('x', res(412, { missing: ['host'] }), ten).text, 'Connection incomplete: fill in host.');
  assert.equal(summarize('x', res(502, { error: '28P01' }), ten).text, 'Wrong user or password.');
  assert.equal(summarize('x', res(502, { error: 'WEIRD' }), ten).text, 'Failed (WEIRD).');
});

test('summarize describes successful results', () => {
  assert.equal(summarize('x', res(200, { connected: true, dialect: 'mysql', version: '8.4', ms: 12 }), tid).text, 'Terhubung ke MySQL 8.4 dalam 12 ms.');
  assert.equal(summarize('x', res(200, { connected: true, dialect: 'postgres', version: '17', ms: 3 }), ten).text, 'Connected to PostgreSQL 17 in 3 ms.');
  assert.equal(summarize('x', res(201, { created: 'playground_notes' }), tid).text, 'Tabel playground_notes siap dipakai.');
  assert.equal(summarize('x', res(201, { created: 'playground_notes' }), ten).text, 'Table playground_notes is ready.');
  assert.equal(summarize('x', res(201, { inserted: 1, table: 'playground_notes' }), tid).text, '1 baris ditambahkan ke playground_notes.');
  assert.equal(summarize('x', res(200, { tables: ['a', 'b'] }), ten).text, '2 playground tables found.');
  assert.equal(summarize('x', res(200, { rows: [1, 2, 3] }), tid).text, '3 baris ditampilkan.');
  assert.equal(summarize('x', res(200, { rows: [1] }), ten).text, '1 row shown.');
  assert.equal(summarize('x', res(200, { tables: ['a'] }), ten).text, '1 playground table found.');
  assert.equal(summarize('x', res(200, {}), tid, { ok: 'Readiness dimatikan.' }).text, 'Readiness dimatikan.');
  assert.equal(summarize('x', res(200, {}), tid).text, 'Berhasil.');
  assert.equal(summarize('x', res(200, {}), ten).text, 'Done.');
  assert.equal(summarize('x', res(200, {}), tid).tone, 'ok');
});

test('fmtBytes, clip and hasPlaceholder', () => {
  assert.equal(fmtBytes(812), '812 B');
  assert.equal(fmtBytes(3482), '3.4 KB');
  assert.equal(fmtBytes(1_258_291), '1.2 MB');
  assert.deepEqual(clip('abc', 10), { text: 'abc', clipped: false });
  assert.deepEqual(clip('abcdef', 3), { text: 'abc', clipped: true });
  assert.equal(hasPlaceholder('Bearer <jwt>'), true);
  assert.equal(hasPlaceholder('<api-key>'), true);
  assert.equal(hasPlaceholder('gzip'), false);
  assert.equal(hasPlaceholder('a < b'), false);
});

test('statusLine and transcript read like curl -i output', () => {
  assert.equal(statusLine(200, ten), '200 OK');
  assert.equal(statusLine(503, ten), '503 Service Unavailable');
  assert.equal(statusLine(418, ten), '418');
  assert.equal(statusLine(0, tid), 'gagal, tidak ada respons');
  assert.equal(statusLine(0, ten), 'failed, no response');
  const r = { ...res(200, { ok: true }), headers: [['content-type', 'application/json']] as Array<[string, string]> };
  assert.equal(transcript(r, ten, 'GET', '/api/info'), '$ GET /api/info\n200 OK\ncontent-type: application/json\n\n{"ok":true}');
  assert.equal(transcript(res(404, ''), ten), '404 Not Found');
});

test('prettyBody indents JSON objects and arrays and leaves everything else alone', () => {
  assert.equal(prettyBody('{"a":1,"b":[2]}'), '{\n  "a": 1,\n  "b": [\n    2\n  ]\n}');
  assert.equal(prettyBody('[1,2]'), '[\n  1,\n  2\n]');
  assert.equal(prettyBody('plain text'), 'plain text');
  assert.equal(prettyBody('{broken'), '{broken');
  assert.equal(prettyBody('123'), '123');
  assert.equal(prettyBody(''), '');
});
