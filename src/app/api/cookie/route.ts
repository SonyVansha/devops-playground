import { wrap } from '../../../lib/handler.ts';
import { json, selfName } from '../../../lib/util.ts';

export const dynamic = 'force-dynamic';

const TOKEN = /^[A-Za-z0-9_-]{1,32}$/;

function cookieNames(request: Request): string[] {
  const raw = request.headers.get('cookie') ?? '';
  return raw
    .split(';')
    .map((part) => part.split('=')[0].trim())
    .filter(Boolean);
}

function isHttps(request: Request): boolean {
  return request.headers.get('x-forwarded-proto') === 'https' || new URL(request.url).protocol === 'https:';
}

// GET /api/cookie                      -> pod yang melayani + nama cookie yang diterima (tes sticky session)
// GET /api/cookie?name=sid&value=abc   -> men-set cookie (HttpOnly, SameSite=Lax, Secure bila https)
export const GET = wrap('cookie', (request) => {
  const params = new URL(request.url).searchParams;
  const name = params.get('name');
  const value = params.get('value');
  const extra = new Headers();
  if (name !== null && value !== null) {
    if (!TOKEN.test(name) || !TOKEN.test(value)) return json({ error: 'name/value must match [A-Za-z0-9_-]{1,32}' }, 400);
    const attrs = [`${name}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=3600'];
    if (isHttps(request)) attrs.push('Secure');
    extra.append('Set-Cookie', attrs.join('; '));
  }
  return json({ pod: selfName(), cookieNames: cookieNames(request) }, 200, extra);
});
