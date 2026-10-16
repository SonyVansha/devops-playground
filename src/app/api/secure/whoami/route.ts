import { wrap } from '../../../../lib/handler.ts';
import { findIdentity, identityHeaders } from '../../../../lib/identity.ts';
import { json } from '../../../../lib/util.ts';

export const dynamic = 'force-dynamic';

// Identitas yang diteruskan API gateway ke app (Kong: X-Consumer-*; Envoy Gateway: header dari SecurityPolicy,
// mis. forwardClientIDHeader=x-client-id, forwardUsernameHeader=x-user). Nama header bisa diatur lewat IDENTITY_HEADERS.
// ?require=1 -> 401 bila tidak ada identitas. Header identitas DIPERCAYA apa adanya: jika app bisa diakses
// langsung (tanpa lewat gateway) klien bisa memalsukannya, jadi batasi akses dengan NetworkPolicy.
export const GET = wrap('secure_whoami', (request) => {
  const h = request.headers;
  const identity = findIdentity(h);
  const anonymous = h.get('x-anonymous-consumer') === 'true';
  const authenticated = identity !== null && !anonymous;
  const scheme = /^(\w+)\s/.exec(h.get('authorization') ?? '')?.[1] ?? null;

  if (!authenticated && new URL(request.url).searchParams.get('require') === '1') {
    return json({ authenticated: false, error: 'authentication required' }, 401);
  }
  return json({
    authenticated,
    via: authenticated ? 'gateway' : 'none',
    anonymous,
    identityHeader: authenticated ? identity.header : null,
    consumer: {
      username: identity?.value ?? null,
      id: h.get('x-consumer-id'),
      customId: h.get('x-consumer-custom-id'),
      credentialId: h.get('x-credential-identifier'),
    },
    authorizationScheme: scheme,
    watchedHeaders: identityHeaders(),
    note: 'Identity headers are trusted as-is; restrict direct access with a NetworkPolicy',
  });
});
