// Header yang dipakai gateway untuk meneruskan identitas ke upstream. Namanya berbeda per gateway dan bisa diatur:
//   Kong                 : X-Consumer-Username (key-auth, jwt, basic-auth, oidc)
//   Envoy Gateway        : forwardClientIDHeader (apiKeyAuth), forwardUsernameHeader (basicAuth),
//                          claimToHeaders (jwt) -> nama header ditentukan di SecurityPolicy
// IDENTITY_HEADERS (dipisah koma) menimpa daftar bawaan, urutan = prioritas.
export const DEFAULT_IDENTITY_HEADERS = ['x-consumer-username', 'x-client-id', 'x-user', 'x-forwarded-user'] as const;

const HEADER_NAME = /^[a-z0-9][a-z0-9-]{0,62}$/;

export function identityHeaders(raw: string | undefined = process.env.IDENTITY_HEADERS): string[] {
  const names = (raw ?? '')
    .split(',')
    .map((n) => n.trim().toLowerCase())
    .filter((n) => HEADER_NAME.test(n));
  return names.length > 0 ? names : [...DEFAULT_IDENTITY_HEADERS];
}

export interface Identity {
  header: string;
  value: string;
}

export function findIdentity(headers: Pick<Headers, 'get'>, names: string[] = identityHeaders()): Identity | null {
  for (const header of names) {
    const value = headers.get(header);
    if (value !== null && value.trim() !== '') return { header, value: value.trim().slice(0, 256) };
  }
  return null;
}
