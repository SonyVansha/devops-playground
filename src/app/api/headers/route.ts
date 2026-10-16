import { wrap } from '../../../lib/handler.ts';
import { json, redactHeaders } from '../../../lib/util.ts';

export const dynamic = 'force-dynamic';

// Menampilkan header request (cek X-Forwarded-*, ingress, proxy). Kredensial di-redact.
export const GET = wrap('headers', (request) => {
  const { pathname, search } = new URL(request.url);
  return json({ method: request.method, path: pathname + search, headers: redactHeaders(request.headers) });
});
