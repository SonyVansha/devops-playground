import { wrap } from '../../../lib/handler.ts';
import { clampInt, json } from '../../../lib/util.ts';

export const dynamic = 'force-dynamic';

const MAX_DOWNLOAD_KB = 10_240;
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

async function countBytes(request: Request, limit: number): Promise<number | null> {
  if (!request.body) return 0;
  const reader = request.body.getReader();
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) return total;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
  }
}

// GET /api/payload?kb=1024 -> respons besar (tes buffering, compression, proxy response limit).
export const GET = wrap('payload_get', (request) => {
  const kb = clampInt(new URL(request.url).searchParams.get('kb'), 1, MAX_DOWNLOAD_KB, 100);
  const body = new Uint8Array(kb * 1024).fill(120);
  return new Response(body, { headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
});

// POST /api/payload -> kirim body besar; app melaporkan jumlah byte (tes client_max_body_size / 413 di gateway).
export const POST = wrap('payload_post', async (request) => {
  const received = await countBytes(request, MAX_UPLOAD_BYTES);
  if (received === null) return json({ error: 'body exceeds app limit', limitBytes: MAX_UPLOAD_BYTES }, 413);
  return json({ receivedBytes: received });
});
