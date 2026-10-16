import { tokenMatches } from '../../../../lib/chaos.ts';
import { wrap } from '../../../../lib/handler.ts';
import { json } from '../../../../lib/util.ts';

export const dynamic = 'force-dynamic';

const CHALLENGE = { 'WWW-Authenticate': 'Basic realm="playground", charset="UTF-8"' };

function credentials(authorization: string | null): { user: string; password: string } | null {
  const match = /^Basic\s+(\S+)$/i.exec(authorization ?? '');
  if (!match) return null;
  const decoded = Buffer.from(match[1], 'base64').toString('utf8');
  const index = decoded.indexOf(':');
  return index < 0 ? null : { user: decoded.slice(0, index), password: decoded.slice(index + 1) };
}

// Basic auth di level app (BASIC_USER / BASIC_PASSWORD dari Secret); 503 bila belum dikonfigurasi.
// Berguna sebagai pembanding plugin basic-auth gateway. Perbandingan memakai hash + timingSafeEqual.
export const GET = wrap('secure_basic', (request) => {
  const user = process.env.BASIC_USER;
  const password = process.env.BASIC_PASSWORD;
  if (!user || !password) return json({ error: 'BASIC_USER/BASIC_PASSWORD not configured' }, 503);

  const given = credentials(request.headers.get('authorization'));
  const ok = given !== null && tokenMatches(given.user, user) && tokenMatches(given.password, password);
  if (!ok) return json({ error: 'invalid credentials' }, 401, CHALLENGE);
  return json({ authenticated: true, user });
});
