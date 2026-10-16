import type { Doc } from '../types.ts';

export const doc: Doc = {
  slug: 'caching',
  title: 'Caching & compression',
  summary: 'Uji cache gateway/CDN: Cache-Control, ETag dan 304, s-maxage, stale-while-revalidate, Vary, dan kompresi.',
  blocks: [
    {
      t: 'p',
      text: '`/api/cache` mengembalikan JSON yang berisi `generatedAt`. Jika respons datang dari cache, `generatedAt` **tidak berubah** walau kamu mengulang request; itulah cara paling mudah melihat cache bekerja.',
    },
    {
      t: 'table',
      head: ['Parameter', 'Nilai', 'Efek'],
      rows: [
        ['`ttl`', '0–86400 (default 60)', '`max-age`'],
        ['`mode`', '`public` (default), `private`, `nostore`, `swr`', '`public`/`private`; `nostore` = `no-store` tanpa validator; `swr` menambah `stale-while-revalidate`'],
        ['`smax`', '0–86400', 'menambah `s-maxage` (cache bersama), diabaikan untuk `private`'],
        ['`vary`', '`accept`, `accept-encoding`, `accept-language`, `origin`, `x-tenant`', 'header `Vary` (hanya nilai dalam allowlist)'],
        ['`v`', 'teks pendek, mis. `1`', 'versi konten: mengubahnya mengubah ETag'],
        ['`kb`', '0–2048', 'padding kompresibel agar body besar'],
        ['`gzip=1`', '-', 'app mengompres sendiri bila klien kirim `Accept-Encoding: gzip`'],
      ],
    },
    {
      t: 'note',
      kind: 'info',
      text: 'ETag hanya bergantung pada `v`, `kb`, dan varian encoding, **bukan** pada pod atau waktu, jadi identik di semua replika. Next juga menambahkan header `Vary` miliknya sendiri (`rsc, next-router-state-tree, ...`); itu normal.',
    },
    { t: 'h', text: 'Validator dan 304' },
    {
      t: 'check',
      title: 'Header cache dan revalidasi',
      command: 'curl -si "{{BASE}}/api/cache?ttl=120&v=1" | grep -iE "^(HTTP|cache-control|etag|last-modified)"\nETAG=$(curl -si "{{BASE}}/api/cache?v=1" | tr -d \'\\r\' | sed -n \'s/^[Ee][Tt]ag: //p\')\ncurl -s -o /dev/null -w "INM sama: %{http_code}\\n" -H "If-None-Match: $ETAG" "{{BASE}}/api/cache?v=1"\ncurl -s -o /dev/null -w "versi beda: %{http_code}\\n" -H "If-None-Match: $ETAG" "{{BASE}}/api/cache?v=2"',
      expect: '`cache-control: public, max-age=120`, ETag 16 heks dalam tanda kutip, `last-modified` tetap. `INM sama: 304` (tanpa body) dan `versi beda: 200` (konten baru karena ETag berbeda). `If-Modified-Since` dengan tanggal lebih baru dari Last-Modified juga menghasilkan 304.',
    },
    { t: 'h', text: 'Mode lain' },
    {
      t: 'check',
      title: 'no-store, private, dan swr',
      command: 'curl -si "{{BASE}}/api/cache?mode=nostore" | grep -iE "cache-control|etag"\ncurl -si "{{BASE}}/api/cache?mode=private&ttl=30&smax=99" | grep -i cache-control\ncurl -si "{{BASE}}/api/cache?mode=swr&ttl=30&smax=120&vary=accept-encoding,x-tenant" | grep -iE "cache-control|^vary: accept"',
      expect: '`no-store` tanpa baris ETag; `private, max-age=30` (tanpa `s-maxage`); `public, max-age=30, stale-while-revalidate=30, s-maxage=120` dan `vary: accept-encoding, x-tenant`.',
    },
    { t: 'h', text: 'Kompresi' },
    {
      t: 'p',
      text: 'Secara default app **tidak** mengompres (Next standalone tidak mengompres route handler), jadi kompresi di gateway/ingress bisa diuji. `gzip=1` memaksa app mengompres sebagai pembanding.',
    },
    {
      t: 'check',
      title: 'Ukuran di jaringan',
      command: 'curl -s --compressed -o /dev/null -w "tanpa gzip: %{size_download} byte\\n" "{{BASE}}/api/cache?kb=512"\ncurl -s --compressed -o /dev/null -w "gzip=1: %{size_download} byte\\n" "{{BASE}}/api/cache?kb=512&gzip=1"',
      expect: '`tanpa gzip` ≈ 524 ribu byte, `gzip=1` ≈ 650 byte, dengan `Content-Encoding: gzip`. ETag varian gzip berbeda dari varian biasa. Di Windows, ganti `/dev/null` dengan `NUL` jika ukuran terbaca 0.',
    },
    { t: 'h', text: 'Menguji cache gateway/CDN' },
    {
      t: 'ol',
      items: [
        'Pasang cache di gateway (mis. plugin `proxy-cache` Kong, lihat halaman API gateway).',
        'Panggil `/api/cache?ttl=30&v=1` dua kali; `generatedAt` harus sama dan header `X-Cache-Status` berubah `Miss` → `Hit`.',
        'Ganti `v=2`: kunci cache berbeda, `generatedAt` baru.',
        'Tunggu TTL habis: `generatedAt` baru lagi (atau tetap lama sementara untuk `mode=swr` sambil revalidasi di latar belakang).',
        '`mode=nostore` atau `private` tidak boleh pernah di-cache oleh cache bersama.',
      ],
    },
  ],
};
