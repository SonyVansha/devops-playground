import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DOCS } from '../src/docs/index.ts';
import type { Block } from '../src/docs/types.ts';

const API_ROOT = join(import.meta.dirname, '..', 'src', 'app');

// Seluruh teks bebas dari sebuah blok (di luar blok kode), untuk pemeriksaan tautan/endpoint.
function textsOf(block: Block): string[] {
  switch (block.t) {
    case 'h':
    case 'p':
      return [block.text];
    case 'note':
      return [block.text];
    case 'ul':
    case 'ol':
      return block.items;
    case 'table':
      return [...block.head, ...block.rows.flat()];
    case 'check':
      return [block.title, block.expect];
    case 'code':
      return [];
  }
}

function codesOf(block: Block): string[] {
  if (block.t === 'code') return [block.code];
  if (block.t === 'check') return [block.command];
  return [];
}

// Route /api/... ada di src/app (mendukung segmen dinamis [param]); prefix direktori yang valid diterima.
function routeExists(path: string): boolean {
  const segments = ['app', ...path.split('/').filter(Boolean)];
  let dir = join(API_ROOT, '..');
  for (const segment of segments) {
    const clean = segment.replace(/^\{.+\}$/, '*');
    const exact = join(dir, clean);
    if (clean !== '*' && existsSync(exact) && statSync(exact).isDirectory()) {
      dir = exact;
      continue;
    }
    const dynamic = readdirSync(dir, { withFileTypes: true }).find((e) => e.isDirectory() && /^\[.+\]$/.test(e.name));
    if (!dynamic) return false;
    dir = join(dir, dynamic.name);
  }
  return true;
}

function allFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? allFiles(p) : [p];
  });
}

test('docs: slugs unik, kebab-case, dan setiap halaman punya isi', () => {
  const slugs = DOCS.map((d) => d.slug);
  assert.equal(new Set(slugs).size, slugs.length, 'slug harus unik');
  for (const d of DOCS) {
    assert.match(d.slug, /^[a-z0-9]+(-[a-z0-9]+)*$/, `slug tidak valid: ${d.slug}`);
    assert.ok(d.title.length > 3 && d.summary.length > 10, `${d.slug}: judul/ringkasan kosong`);
    assert.ok(d.blocks.length >= 3, `${d.slug}: terlalu sedikit isi`);
  }
});

test('docs: tabel rapi dan blok "cek" lengkap', () => {
  for (const d of DOCS) {
    for (const b of d.blocks) {
      if (b.t === 'table') {
        for (const row of b.rows) assert.equal(row.length, b.head.length, `${d.slug}: jumlah kolom tabel tidak sama`);
        assert.equal(new Set(b.rows.map((r) => r.join('|'))).size, b.rows.length, `${d.slug}: baris tabel duplikat (key React)`);
      }
      if (b.t === 'check') {
        assert.ok(b.command.trim() && b.expect.trim(), `${d.slug}: blok cek "${b.title}" kosong`);
      }
      if (b.t === 'ul' || b.t === 'ol') assert.equal(new Set(b.items).size, b.items.length, `${d.slug}: item duplikat`);
    }
  }
});

test('docs: {{BASE}} hanya dipakai di dalam kode (blok kode atau `inline`)', () => {
  for (const d of DOCS) {
    for (const b of d.blocks) {
      for (const text of textsOf(b)) {
        const withoutCode = text.replace(/`[^`]*`/g, '');
        assert.equal(withoutCode.includes('{{BASE}}'), false, `${d.slug}: {{BASE}} di luar kode: ${text.slice(0, 60)}`);
      }
    }
  }
});

test('docs: tautan internal /docs/<slug> mengarah ke halaman yang ada', () => {
  const slugs = new Set(DOCS.map((d) => d.slug));
  for (const d of DOCS) {
    for (const b of d.blocks) {
      for (const text of [...textsOf(b), ...codesOf(b)]) {
        for (const m of text.matchAll(/\/docs\/([a-z0-9-]+)/g)) assert.ok(slugs.has(m[1]), `${d.slug}: tautan rusak /docs/${m[1]}`);
      }
    }
  }
});

test('docs: setiap endpoint /api/... yang disebut benar-benar ada di kode', () => {
  const missing: string[] = [];
  let checked = 0;
  for (const d of DOCS) {
    for (const b of d.blocks) {
      for (const text of [...textsOf(b), ...codesOf(b)]) {
        for (const m of text.matchAll(/\/api\/[A-Za-z0-9_\-/{}]*/g)) {
          const path = m[0].replace(/\/+$/, '');
          checked += 1;
          if (!routeExists(path)) missing.push(`${d.slug}: ${path}`);
        }
      }
    }
  }
  assert.ok(checked > 50, `terlalu sedikit endpoint terperiksa (${checked})`);
  assert.deepEqual(missing, [], `endpoint di docs tidak ada di kode:\n${missing.join('\n')}`);
});

test('docs: variabel env di halaman referensi dipakai di kode/manifest', () => {
  const referensi = DOCS.find((d) => d.slug === 'referensi');
  assert.ok(referensi);
  const root = join(import.meta.dirname, '..');
  const corpus = [...allFiles(join(root, 'src')), join(root, 'k8s', 'app.yaml'), join(root, 'Dockerfile'), join(root, 'next.config.mjs')]
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
  const table = referensi.blocks.filter((b): b is Extract<Block, { t: 'table' }> => b.t === 'table').find((b) => b.head[0] === 'Env');
  assert.ok(table, 'tabel Env tidak ditemukan');
  const names = table.rows.flatMap((r) => [...r[0].matchAll(/`([A-Z][A-Z0-9_]+)/g)].map((m) => m[1]));
  assert.ok(names.length >= 18, `env terdeteksi: ${names.length}`);
  const unused = names.filter((n) => !corpus.includes(n) && n !== 'BASE_PATH');
  assert.deepEqual(unused, [], `env di docs tidak dipakai di kode: ${unused.join(', ')}`);
  assert.ok(corpus.includes('BASE_PATH'));
});

test('docs: setiap halaman berada di tepat satu grup dan heading punya id unik', async () => {
  const { GROUPS, groupOf } = await import('../src/docs/index.ts');
  const { headingsOf, slugify } = await import('../src/docs/headings.ts');
  assert.ok(GROUPS.length >= 3 && GROUPS.every((g) => g.name.trim() && g.docs.length > 0));
  assert.equal(GROUPS.flatMap((g) => g.docs).length, DOCS.length);
  for (const d of DOCS) {
    assert.ok(groupOf(d.slug), `${d.slug}: tidak ada di grup mana pun`);
    const ids = headingsOf(d.blocks).map((h) => h.id);
    assert.equal(new Set(ids).size, ids.length, `${d.slug}: id heading duplikat`);
    assert.ok(ids.every((id) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)), `${d.slug}: id heading tidak valid`);
  }
  assert.equal(slugify('Skenario 1: rollout gagal lalu rollback'), 'skenario-1-rollout-gagal-lalu-rollback');
  assert.equal(slugify('Café & Cache!'), 'cafe-cache');
  assert.equal(slugify('???'), 'bagian');
  const dup = headingsOf([
    { t: 'h', text: 'Sama' },
    { t: 'h', text: 'Sama' },
  ]);
  assert.deepEqual(dup.map((h) => h.id), ['sama', 'sama-2']);
});
