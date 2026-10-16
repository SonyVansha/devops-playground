import { wrap } from '../../../../lib/handler.ts';
import { json } from '../../../../lib/util.ts';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ code: string }> };

// /api/status/503 -> balas dengan status code tersebut (tes retry, error page, alerting).
export const GET = wrap<Ctx>('status', async (_request, ctx) => {
  const { code } = await ctx.params;
  const status = /^\d{3}$/.test(code) ? Number.parseInt(code, 10) : 400;
  if (status < 200 || status > 599) return json({ error: 'code must be 200-599' }, 400);
  if ([204, 205, 304].includes(status)) return new Response(null, { status });
  return json({ status }, status);
});
