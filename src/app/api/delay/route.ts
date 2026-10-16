import { wrap } from '../../../lib/handler.ts';
import { clampInt, json } from '../../../lib/util.ts';

export const dynamic = 'force-dynamic';

const MAX_DELAY_MS = 30_000;

// /api/delay?ms=5000 -> tes timeout ingress/proxy/client.
export const GET = wrap('delay', async (request) => {
  const ms = clampInt(new URL(request.url).searchParams.get('ms'), 0, MAX_DELAY_MS, 1000);
  await new Promise((resolve) => setTimeout(resolve, ms));
  return json({ delayedMs: ms });
});
