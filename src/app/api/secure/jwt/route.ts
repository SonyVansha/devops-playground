import { wrap } from '../../../../lib/handler.ts';
import { bearerToken, parseJwt, verifyHs256 } from '../../../../lib/jwt.ts';
import { json } from '../../../../lib/util.ts';

export const dynamic = 'force-dynamic';

const CHALLENGE = { 'WWW-Authenticate': 'Bearer' };

// Menampilkan klaim JWT dari "Authorization: Bearer". Token mentah/signature tidak pernah dikembalikan.
// - JWT_SECRET tidak di-set: signature TIDAK diverifikasi app (verified:null), gateway yang harus memverifikasi.
// - JWT_SECRET di-set: verifikasi HS256 (alg lain/none ditolak); signature salah atau token kedaluwarsa -> 401.
export const GET = wrap('secure_jwt', (request) => {
  const token = bearerToken(request.headers.get('authorization'));
  if (token === null) return json({ error: 'missing bearer token' }, 401, CHALLENGE);
  const jwt = parseJwt(token);
  if (jwt === null) return json({ error: 'malformed token' }, 401, CHALLENGE);

  const secret = process.env.JWT_SECRET;
  const verified = secret ? verifyHs256(jwt, secret) : null;
  const exp = typeof jwt.payload.exp === 'number' ? jwt.payload.exp : null;
  const now = Math.floor(Date.now() / 1000);
  const expired = exp === null ? null : exp <= now;
  const body = {
    verified,
    expired,
    expiresInSeconds: exp === null ? null : exp - now,
    header: { alg: jwt.header.alg ?? null, typ: jwt.header.typ ?? null, kid: jwt.header.kid ?? null },
    claims: jwt.payload,
    note: verified === null ? 'signature NOT verified by the app (JWT_SECRET unset); the gateway must verify it' : undefined,
  };

  if (verified === false) return json({ ...body, error: 'invalid signature' }, 401, CHALLENGE);
  if (verified === true && expired) return json({ ...body, error: 'token expired' }, 401, CHALLENGE);
  return json(body);
});
