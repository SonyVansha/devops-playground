import { randomInt } from 'node:crypto';
import { wrap } from '../../../lib/handler.ts';
import { clampInt, json } from '../../../lib/util.ts';

export const dynamic = 'force-dynamic';

// /api/flaky?rate=30&status=503 -> gagal acak 30% (tes retry, circuit breaker, outlier detection).
export const GET = wrap('flaky', (request) => {
  const params = new URL(request.url).searchParams;
  const rate = clampInt(params.get('rate'), 0, 100, 50);
  const status = clampInt(params.get('status'), 400, 599, 503);
  if (randomInt(100) < rate) return json({ ok: false, injected: status }, status);
  return json({ ok: true, rate });
});
