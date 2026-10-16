import { wrap } from '../../../lib/handler.ts';
import { clampInt, json } from '../../../lib/util.ts';

export const dynamic = 'force-dynamic';

const CODES = new Set([301, 302, 303, 307, 308]);

function redirectTo(location: string, status: number): Response {
  return new Response(null, { status, headers: { Location: location, 'Cache-Control': 'no-store' } });
}

// /api/redirect?n=3&code=302 -> rantai redirect sepanjang n. loop=1 -> redirect tanpa akhir.
// Location sengaja relatif ("redirect?...") agar tetap benar di belakang prefix/strip-path gateway.
export const GET = wrap('redirect', (request) => {
  const params = new URL(request.url).searchParams;
  const requested = clampInt(params.get('code'), 300, 399, 302);
  const code = CODES.has(requested) ? requested : 302;
  if (params.get('loop') === '1') return redirectTo(`redirect?n=1&code=${code}&loop=1`, code);
  const n = clampInt(params.get('n'), 0, 10, 3);
  if (n > 0) return redirectTo(`redirect?n=${n - 1}&code=${code}`, code);
  return json({ redirected: true });
});
