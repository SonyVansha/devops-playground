import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Block, Doc } from '../src/docs/types.ts';

// Setiap halaman docs berbahasa Indonesia (src/docs/pages/X.ts) harus punya padanan Inggris (src/docs/en/X.ts)
// dengan STRUKTUR yang sama: slug, urutan dan jenis blok, jumlah baris/kolom tabel, jumlah item daftar,
// kode perintah, dan format inline. Hanya teks bahasa manusia yang boleh berbeda.
// Jalankan sebagian saja: ONLY=kong,auth node --test test/docs-i18n.test.ts
const root = join(import.meta.dirname, '..', 'src', 'docs');
const only = process.env.ONLY?.split(',').filter(Boolean);
const names = readdirSync(join(root, 'pages'))
  .filter((f) => f.endsWith('.ts'))
  .map((f) => f.replace(/\.ts$/, ''))
  .filter((n) => !only || only.includes(n));

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length;
const spans = (s: string) => `${count(s, /`[^`]+`/g)}c${count(s, /\*\*[^*]+\*\*/g)}b`;

function textsOf(b: Block): string[] {
  switch (b.t) {
    case 'h':
    case 'p':
    case 'note':
      return [b.text];
    case 'ul':
    case 'ol':
      return b.items;
    case 'table':
      return b.rows.flat();
    case 'check':
      return [b.expect];
    case 'code':
      return [];
  }
}

const codeOf = (b: Block): string | null => (b.t === 'code' ? b.code : b.t === 'check' ? b.command : null);
const apiPaths = (s: string) => [...new Set(s.match(/\/api\/[A-Za-z0-9_\-/{}]*/g) ?? [])].sort().join(' ');

async function load(path: string): Promise<Doc> {
  return ((await import(pathToFileURL(path).href)) as { doc: Doc }).doc;
}

for (const name of names) {
  test(`docs-i18n: ${name} has an English twin with the same structure`, async () => {
    const enPath = join(root, 'en', `${name}.ts`);
    assert.ok(existsSync(enPath), `src/docs/en/${name}.ts belum ada`);
    const id = await load(join(root, 'pages', `${name}.ts`));
    const en = await load(enPath);

    assert.equal(en.slug, id.slug, 'slug harus sama');
    assert.ok(en.title.trim() && en.summary.trim(), 'judul dan ringkasan tidak boleh kosong');
    assert.equal(en.blocks.length, id.blocks.length, 'jumlah blok harus sama');

    en.blocks.forEach((eb, i) => {
      const ib = id.blocks[i];
      const where = `blok #${i + 1} (${ib.t})`;
      assert.equal(eb.t, ib.t, `${where}: jenis blok berbeda`);

      const eTexts = textsOf(eb);
      const iTexts = textsOf(ib);
      assert.equal(eTexts.length, iTexts.length, `${where}: jumlah teks/item berbeda`);
      eTexts.forEach((t, j) => assert.equal(spans(t), spans(iTexts[j]), `${where} teks ${j + 1}: jumlah \`kode\`/**tebal** berbeda\n  EN: ${t}\n  ID: ${iTexts[j]}`));

      if (eb.t === 'note' && ib.t === 'note') assert.equal(eb.kind, ib.kind, `${where}: jenis note berbeda`);
      if (eb.t === 'table' && ib.t === 'table') {
        assert.equal(eb.head.length, ib.head.length, `${where}: jumlah kolom berbeda`);
        assert.equal(eb.rows.length, ib.rows.length, `${where}: jumlah baris berbeda`);
        eb.rows.forEach((r, k) => assert.equal(r.length, ib.rows[k].length, `${where} baris ${k + 1}: jumlah sel berbeda`));
      }

      const ec = codeOf(eb);
      const ic = codeOf(ib);
      if (ec !== null && ic !== null) {
        assert.equal(ec.split('\n').length, ic.split('\n').length, `${where}: jumlah baris kode berbeda`);
        assert.equal(count(ec, /\{\{BASE\}\}/g), count(ic, /\{\{BASE\}\}/g), `${where}: jumlah {{BASE}} berbeda`);
        assert.equal(apiPaths(ec), apiPaths(ic), `${where}: daftar /api/... di kode berbeda`);
      }
    });
  });
}
