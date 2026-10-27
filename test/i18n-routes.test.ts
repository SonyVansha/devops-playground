import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DOCS_DOMAINS, HOME_DOMAINS, dictionary, messagesFor } from '../src/i18n/index.ts';

// Halaman hanya menerima bagian kamus yang dipakainya (lebih ringan). Test ini menjaga agar tidak ada komponen
// memakai kunci dari bagian yang TIDAK dikirim ke rutenya, yang akan tampil sebagai kunci mentah ("chaos.token").
const root = join(import.meta.dirname, '..', 'src');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
const tsx = (dir: string) => readdirSync(join(root, dir)).filter((f) => /\.tsx?$/.test(f)).map((f) => `${dir}/${f}`);

// Kunci literal yang dipanggil lewat t('...') / t("...") di sebuah berkas.
const keysIn = (rel: string): string[] => [...read(rel).matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)].map((m) => m[1]);

for (const lang of ['en', 'id'] as const) {
  const shell = new Set(Object.keys(messagesFor(lang, [])));
  const docs = new Set(Object.keys(messagesFor(lang, DOCS_DOMAINS)));
  const home = new Set(Object.keys(messagesFor(lang, HOME_DOMAINS)));
  const withShell = (extra: Set<string>) => new Set([...shell, ...extra]);

  test(`[${lang}] kerangka (shell, tema, bahasa) hanya memakai kunci dari bagian "shell"`, () => {
    for (const file of ['components/shell/Shell.tsx', 'components/ThemeToggle.tsx', 'components/LangToggle.tsx']) {
      for (const key of keysIn(file)) assert.ok(shell.has(key), `${file} memakai kunci di luar shell: ${key}`);
    }
  });

  test(`[${lang}] komponen docs hanya memakai kunci yang dikirim ke /docs`, () => {
    const allowed = withShell(docs);
    for (const file of tsx('components/docs')) {
      // DocBlocks dirender di server dengan penerjemah penuh; sisanya komponen klien.
      if (file.endsWith('DocBlocks.tsx')) continue;
      for (const key of keysIn(file)) assert.ok(allowed.has(key), `${file} memakai kunci yang tidak dikirim ke /docs: ${key}`);
    }
  });

  test(`[${lang}] komponen dashboard hanya memakai kunci yang dikirim ke /`, () => {
    const allowed = withShell(home);
    for (const file of tsx('components/dashboard')) {
      for (const key of keysIn(file)) assert.ok(allowed.has(key), `${file} memakai kunci yang tidak dikirim ke /: ${key}`);
    }
  });
}

test('docs hanya mengirim sebagian kecil kamus, dan seluruh bagian bersama-sama = kamus penuh', () => {
  for (const lang of ['en', 'id'] as const) {
    const full = Object.keys(dictionary(lang)).length;
    const all = Object.keys(messagesFor(lang, ['shell', 'dashboard', 'result', 'chaos', 'catalog', 'database', 'docs'])).length;
    assert.equal(all, full, `bagian-bagian harus mencakup seluruh kamus (${lang})`);
    const docsSize = JSON.stringify(messagesFor(lang, DOCS_DOMAINS)).length + JSON.stringify(messagesFor(lang, [])).length;
    const fullSize = JSON.stringify(dictionary(lang)).length;
    assert.ok(docsSize < fullSize / 4, `halaman docs seharusnya membawa < 25% kamus (${docsSize} dari ${fullSize} B, ${lang})`);
  }
});
