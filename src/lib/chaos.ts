import { createHash, timingSafeEqual } from 'node:crypto';
import { chaosEnabled, json, selfName } from './util.ts';

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

export function tokenMatches(given: string, expected: string): boolean {
  return timingSafeEqual(digest(given), digest(expected));
}

// Semua endpoint chaos wajib lewat guard ini:
// 1) ENABLE_CHAOS=true  2) CHAOS_TOKEN terpasang & cocok (header X-Chaos-Token)
// 3) opsional ?pod=<nama> untuk menarget satu pod saja (409 bila bukan pod ini -> ulangi request).
export function chaosGuard(request: Request): Response | null {
  if (!chaosEnabled()) return json({ error: 'chaos endpoints disabled, set ENABLE_CHAOS=true' }, 403);
  const expected = process.env.CHAOS_TOKEN;
  if (!expected) return json({ error: 'CHAOS_TOKEN is not configured' }, 403);
  if (!tokenMatches(request.headers.get('x-chaos-token') ?? '', expected)) {
    return json({ error: 'invalid chaos token' }, 401);
  }
  const target = new URL(request.url).searchParams.get('pod');
  const me = selfName();
  if (target && target !== me) return json({ error: 'pod mismatch', self: me }, 409);
  return null;
}
