import type { Doc } from '../types.ts';

export const doc: Doc = {
  slug: 'caching',
  title: 'Caching & compression',
  summary: 'Test gateway/CDN caching: Cache-Control, ETag and 304, s-maxage, stale-while-revalidate, Vary, and compression.',
  blocks: [
    {
      t: 'p',
      text: '`/api/cache` returns JSON that contains `generatedAt`. If the response comes from a cache, `generatedAt` **does not change** even when you repeat the request. This is the easiest way to see the cache working.',
    },
    {
      t: 'table',
      head: ['Parameter', 'Value', 'Effect'],
      rows: [
        ['`ttl`', '0–86400 (default 60)', '`max-age`'],
        ['`mode`', '`public` (default), `private`, `nostore`, `swr`', '`public`/`private`; `nostore` = `no-store` without validators; `swr` adds `stale-while-revalidate`'],
        ['`smax`', '0–86400', 'adds `s-maxage` (shared cache), ignored for `private`'],
        ['`vary`', '`accept`, `accept-encoding`, `accept-language`, `origin`, `x-tenant`', '`Vary` header (only values in the allowlist)'],
        ['`v`', 'short text, e.g. `1`', 'content version: changing it changes the ETag'],
        ['`kb`', '0–2048', 'compressible padding to make the body large'],
        ['`gzip=1`', '-', 'the app compresses by itself when the client sends `Accept-Encoding: gzip`'],
      ],
    },
    {
      t: 'note',
      kind: 'info',
      text: 'The ETag depends only on `v`, `kb`, and the encoding variant, **not** on the pod or the time, so it is identical across all replicas. Next also adds its own `Vary` header (`rsc, next-router-state-tree, ...`). That is normal.',
    },
    { t: 'h', text: 'Validators and 304' },
    {
      t: 'check',
      title: 'Cache headers and revalidation',
      command: 'curl -si "{{BASE}}/api/cache?ttl=120&v=1" | grep -iE "^(HTTP|cache-control|etag|last-modified)"\nETAG=$(curl -si "{{BASE}}/api/cache?v=1" | tr -d \'\\r\' | sed -n \'s/^[Ee][Tt]ag: //p\')\ncurl -s -o /dev/null -w "INM same: %{http_code}\\n" -H "If-None-Match: $ETAG" "{{BASE}}/api/cache?v=1"\ncurl -s -o /dev/null -w "different version: %{http_code}\\n" -H "If-None-Match: $ETAG" "{{BASE}}/api/cache?v=2"',
      expect: '`cache-control: public, max-age=120`, a 16-hex ETag in quotes, a stable `last-modified`. `INM same: 304` (no body) and `different version: 200` (new content because the ETag is different). `If-Modified-Since` with a date later than Last-Modified also returns 304.',
    },
    { t: 'h', text: 'Other modes' },
    {
      t: 'check',
      title: 'no-store, private, and swr',
      command: 'curl -si "{{BASE}}/api/cache?mode=nostore" | grep -iE "cache-control|etag"\ncurl -si "{{BASE}}/api/cache?mode=private&ttl=30&smax=99" | grep -i cache-control\ncurl -si "{{BASE}}/api/cache?mode=swr&ttl=30&smax=120&vary=accept-encoding,x-tenant" | grep -iE "cache-control|^vary: accept"',
      expect: '`no-store` with no ETag line; `private, max-age=30` (no `s-maxage`); `public, max-age=30, stale-while-revalidate=30, s-maxage=120` and `vary: accept-encoding, x-tenant`.',
    },
    { t: 'h', text: 'Compression' },
    {
      t: 'p',
      text: 'By default the app does **not** compress (Next standalone does not compress route handlers), so you can test compression at the gateway/ingress. `gzip=1` forces the app to compress, as a comparison.',
    },
    {
      t: 'check',
      title: 'Size on the wire',
      command: 'curl -s --compressed -o /dev/null -w "without gzip: %{size_download} bytes\\n" "{{BASE}}/api/cache?kb=512"\ncurl -s --compressed -o /dev/null -w "gzip=1: %{size_download} bytes\\n" "{{BASE}}/api/cache?kb=512&gzip=1"',
      expect: '`without gzip` ≈ 524 thousand bytes, `gzip=1` ≈ 650 bytes, with `Content-Encoding: gzip`. The ETag of the gzip variant differs from the plain variant. On Windows, replace `/dev/null` with `NUL` if the size reads as 0.',
    },
    { t: 'h', text: 'Test the gateway/CDN cache' },
    {
      t: 'ol',
      items: [
        'Enable caching on the gateway or CDN (e.g. the Kong `proxy-cache` plugin; Envoy Gateway in the version we reference has no response cache policy, so use a CDN in front of it).',
        'Call `/api/cache?ttl=30&v=1` twice. `generatedAt` must be the same and the `X-Cache-Status` header changes from `Miss` → `Hit`.',
        'Switch to `v=2`: a different cache key, a new `generatedAt`.',
        'Wait for the TTL to expire: a new `generatedAt` again (or the old one stays briefly for `mode=swr` while it revalidates in the background).',
        '`mode=nostore` or `private` must never be cached by a shared cache.',
      ],
    },
  ],
};
