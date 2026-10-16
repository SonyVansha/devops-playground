import { wrap } from '../../../../lib/handler.ts';
import { json } from '../../../../lib/util.ts';

export const dynamic = 'force-dynamic';

// Identitas yang diteruskan API gateway (Kong key-auth/jwt/basic-auth/oidc menambahkan X-Consumer-*).
// ?require=1 -> 401 bila tidak ada identitas. Header X-Consumer-* DIPERCAYA apa adanya: jika app bisa diakses
// langsung (tanpa lewat gateway) klien bisa memalsukannya, jadi batasi akses dengan NetworkPolicy.
export const GET = wrap('secure_whoami', (request) => {
  const h = request.headers;
  const username = h.get('x-consumer-username');
  const anonymous = h.get('x-anonymous-consumer') === 'true';
  const authenticated = username !== null && !anonymous;
  const scheme = /^(\w+)\s/.exec(h.get('authorization') ?? '')?.[1] ?? null;

  if (!authenticated && new URL(request.url).searchParams.get('require') === '1') {
    return json({ authenticated: false, error: 'authentication required' }, 401);
  }
  return json({
    authenticated,
    via: authenticated ? 'gateway' : 'none',
    anonymous,
    consumer: {
      username,
      id: h.get('x-consumer-id'),
      customId: h.get('x-consumer-custom-id'),
      credentialId: h.get('x-credential-identifier'),
    },
    authorizationScheme: scheme,
    note: 'X-Consumer-* headers are trusted as-is; restrict direct access with a NetworkPolicy',
  });
});
