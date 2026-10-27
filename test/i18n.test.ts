import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_LANG, LANGS, dictionary, format, localeOf, makeT, parseLang, translator } from '../src/i18n/index.ts';
import { DEPLOY_SCENARIOS, ENDPOINTS } from '../src/components/dashboard/catalog-data.ts';

const en = dictionary('en');
const id = dictionary('id');

test('English is the default language and only "id" selects Indonesian', () => {
  assert.equal(DEFAULT_LANG, 'en');
  assert.deepEqual([...LANGS], ['en', 'id']);
  assert.equal(parseLang(undefined), 'en');
  assert.equal(parseLang(null), 'en');
  assert.equal(parseLang(''), 'en');
  assert.equal(parseLang('fr'), 'en');
  assert.equal(parseLang('EN'), 'en');
  assert.equal(parseLang('id'), 'id');
  assert.equal(localeOf('en'), 'en-GB');
  assert.equal(localeOf('id'), 'id-ID');
});

test('format fills {placeholders} and leaves unknown ones alone', () => {
  assert.equal(format('Hello {name}'), 'Hello {name}');
  assert.equal(format('Hello {name}', { name: 'pod-1' }), 'Hello pod-1');
  assert.equal(format('{n} of {total}', { n: 3, total: 10 }), '3 of 10');
  assert.equal(format('{a} {missing}', { a: 'x' }), 'x {missing}');
  assert.equal(makeT({ k: 'v {x}' })('k' as never, { x: 1 }), 'v 1');
  assert.equal(makeT({})('absent' as never), 'absent');
});

test('both dictionaries have exactly the same keys, none empty', () => {
  const enKeys = Object.keys(en).sort();
  const idKeys = Object.keys(id).sort();
  assert.deepEqual(idKeys, enKeys);
  assert.ok(enKeys.length > 200, `terlalu sedikit kunci: ${enKeys.length}`);
  for (const k of enKeys) {
    assert.ok(en[k].trim(), `en kosong: ${k}`);
    assert.ok(id[k].trim(), `id kosong: ${k}`);
  }
});

test('every key uses the same {placeholders} and the same number of `code` spans in both languages', () => {
  const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');
  const spans = (s: string) => (s.match(/`[^`]+`/g) ?? []).length;
  for (const k of Object.keys(en)) {
    assert.equal(vars(id[k]), vars(en[k]), `placeholder berbeda: ${k}\n  en: ${en[k]}\n  id: ${id[k]}`);
    assert.equal(spans(id[k]), spans(en[k]), `jumlah \`kode\` berbeda: ${k}`);
  }
});

test('English strings contain no obvious Indonesian leftovers', () => {
  const indonesian = /\b(yang|dan|untuk|dengan|tidak|belum|sudah|dari|pada|atau|jika|lalu|harus|silakan|memuat|menghubungkan|tabel|kolom)\b/i;
  const leaked = Object.entries(en).filter(([, v]) => indonesian.test(v));
  assert.deepEqual(leaked, [], `teks Inggris masih berisi kata Indonesia:\n${leaked.map(([k, v]) => `${k}: ${v}`).join('\n')}`);
});

test('translator picks the right dictionary', () => {
  assert.equal(translator('en')('nav.docs'), 'Documentation');
  assert.equal(translator('id')('nav.docs'), 'Dokumentasi');
  assert.equal(translator('en')('nav.version', { v: 'v2' }), 'Version v2');
  assert.equal(translator('id')('nav.version', { v: 'v2' }), 'Versi v2');
});

test('the catalog has both languages for every title, description and expectation', () => {
  const l10n = (o: Record<string, string>, where: string) => {
    for (const lang of LANGS) assert.ok(o[lang]?.trim(), `${where}: ${lang} kosong`);
  };
  let n = 0;
  for (const g of ENDPOINTS) {
    l10n(g.name, `group ${g.id}`);
    for (const e of g.items) {
      l10n(e.title, `${e.path} title`);
      l10n(e.simulates, `${e.path} simulates`);
      l10n(e.verify, `${e.path} verify`);
      n += 1;
    }
  }
  for (const s of DEPLOY_SCENARIOS) {
    l10n(s.title, `scenario ${s.env}`);
    l10n(s.expect, `scenario ${s.env} expect`);
    n += 1;
  }
  assert.ok(n >= 35, `terlalu sedikit entri katalog: ${n}`);
  // Judul unik per bahasa dalam satu grup (dipakai sebagai key React)
  for (const g of ENDPOINTS) assert.equal(new Set(g.items.map((e) => `${e.method} ${e.path} ${e.title.en}`)).size, g.items.length, `entri ganda di grup ${g.id}`);
  const enText = [...ENDPOINTS.flatMap((g) => g.items.flatMap((e) => [e.title.en, e.simulates.en, e.verify.en])), ...DEPLOY_SCENARIOS.flatMap((s) => [s.title.en, s.expect.en])].join('\n');
  assert.doesNotMatch(enText, /\b(yang|dan|untuk|dengan|tidak|belum|sudah|dari|atau|jika|lalu|harus)\b/i, 'katalog Inggris masih berisi kata Indonesia');
});
