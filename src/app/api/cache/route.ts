import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { LAST_MODIFIED, cacheControl, notModified, parseMode, parseVary } from '../../../lib/cache.ts';
import { wrap } from '../../../lib/handler.ts';
import { clampInt, selfName } from '../../../lib/util.ts';

export const dynamic = 'force-dynamic';

const VERSION = /^[A-Za-z0-9._-]{1,32}$/;

// /api/cache?ttl=60&mode=public|private|nostore|swr&v=1&smax=120&vary=accept-encoding&kb=100
// Menguji cache gateway/CDN: Cache-Control, s-maxage, stale-while-revalidate, Vary,
// validator ETag (If-None-Match -> 304) dan Last-Modified (If-Modified-Since -> 304), serta compression (kb besar).
// ETag hanya bergantung pada `v`, `kb`, dan varian encoding (bukan pada pod atau waktu), jadi sama di semua replika.
// Default TIDAK dikompres (Next standalone tidak mengompres route handler), supaya kompresi gateway bisa diuji.
// gzip=1 -> app mengompres sendiri bila klien mengirim Accept-Encoding: gzip.
// Body memuat generatedAt: respons dari cache akan menunjukkan generatedAt lama.
export const GET = wrap('cache', (request) => {
  const p = new URL(request.url).searchParams;
  const ttl = clampInt(p.get('ttl'), 0, 86_400, 60);
  const mode = parseMode(p.get('mode'));
  const rawV = p.get('v') ?? '1';
  const v = VERSION.test(rawV) ? rawV : '1';
  const kb = clampInt(p.get('kb'), 0, 2048, 0);
  const sMaxAge = p.has('smax') ? clampInt(p.get('smax'), 0, 86_400, 0) : null;
  const gzip = p.get('gzip') === '1' && /\bgzip\b/i.test(request.headers.get('accept-encoding') ?? '');
  const etag = `"${createHash('sha256').update(`${v}:${kb}:${gzip ? 'gzip' : 'identity'}`).digest('hex').slice(0, 16)}"`;

  const headers = new Headers({ 'Cache-Control': cacheControl(mode, ttl, sMaxAge) });
  const vary = parseVary(p.has('gzip') ? `${p.get('vary') ?? ''},accept-encoding` : p.get('vary'));
  if (vary) headers.set('Vary', vary);
  if (mode !== 'nostore') {
    headers.set('ETag', etag);
    headers.set('Last-Modified', LAST_MODIFIED);
    if (notModified(request.headers, etag)) return new Response(null, { status: 304, headers });
  }

  headers.set('Content-Type', 'application/json');
  const body = {
    message: 'cache demo',
    v,
    mode,
    ttl,
    pod: selfName(),
    generatedAt: new Date().toISOString(),
    padding: kb > 0 ? 'x'.repeat(kb * 1024) : undefined,
  };
  const payload = JSON.stringify(body);
  if (!gzip) return new Response(payload, { headers });
  headers.set('Content-Encoding', 'gzip');
  return new Response(new Uint8Array(gzipSync(payload)), { headers });
});
