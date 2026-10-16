import { wrap } from '../../../lib/handler.ts';
import { json } from '../../../lib/util.ts';

export const dynamic = 'force-dynamic';

const MAX_BODY = 64 * 1024;

const echo = wrap('echo', async (request) => {
  const text = await request.text();
  if (text.length > MAX_BODY) return json({ error: 'body too large' }, 413);
  const { searchParams } = new URL(request.url);
  return json({
    method: request.method,
    query: Object.fromEntries(searchParams.entries()),
    contentType: request.headers.get('content-type'),
    body: text,
  });
});

export const GET = echo;
export const POST = echo;
export const PUT = echo;
export const PATCH = echo;
export const DELETE = echo;
