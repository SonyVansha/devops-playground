import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clip, fmtBytes, hasPlaceholder, summarize } from '../src/components/dashboard/outcome.ts';

const res = (status: number, body: unknown = {}) => ({
  status,
  ok: status >= 200 && status < 300,
  ms: 5,
  headers: [] as Array<[string, string]>,
  body: typeof body === 'string' ? body : JSON.stringify(body),
  redirected: false,
  url: '',
});

test('summarize maps HTTP statuses to plain-language messages', () => {
  assert.match(summarize('x', res(0)).text, /Tidak bisa menghubungi/);
  assert.equal(summarize('x', res(401), { token: 'DB token' }).text, 'DB token salah.');
  assert.match(summarize('x', res(403), { token: 'Chaos token' }).text, /Chaos token belum di-set/);
  assert.match(summarize('x', res(409, { error: 'pod mismatch' })).text, /bukan target/);
  assert.equal(summarize('x', res(412, { missing: ['host', 'user'] })).text, 'Koneksi belum lengkap: isi host, user.');
  assert.equal(summarize('x', res(400, { error: 'invalid table name' })).text, 'invalid table name');
  assert.equal(summarize('x', res(502, { error: 'ECONNREFUSED' })).text, 'Server menolak koneksi. Periksa host dan port.');
  assert.equal(summarize('x', res(502, { error: 'WEIRD' })).text, 'Gagal (WEIRD).');
  assert.equal(summarize('x', res(502, 'not json')).text, 'Gagal (502).');
  assert.equal(summarize('x', res(502)).tone, 'err');
});

test('summarize describes successful results', () => {
  assert.equal(summarize('x', res(200, { connected: true, dialect: 'mysql', version: '8.4', ms: 12 })).text, 'Terhubung ke MySQL 8.4 dalam 12 ms.');
  assert.equal(summarize('x', res(201, { created: 'playground_notes' })).text, 'Tabel playground_notes siap dipakai.');
  assert.equal(summarize('x', res(201, { inserted: 1, table: 'playground_notes' })).text, '1 baris ditambahkan ke playground_notes.');
  assert.equal(summarize('x', res(200, { tables: ['a', 'b'] })).text, '2 tabel playground ditemukan.');
  assert.equal(summarize('x', res(200, { rows: [1, 2, 3] })).text, '3 baris ditampilkan.');
  assert.equal(summarize('x', res(200, {}), { ok: 'Readiness dimatikan.' }).text, 'Readiness dimatikan.');
  assert.equal(summarize('x', res(200, {})).text, 'Berhasil.');
  assert.equal(summarize('x', res(200, {})).tone, 'ok');
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
