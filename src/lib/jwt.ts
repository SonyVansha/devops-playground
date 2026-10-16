import { createHmac, timingSafeEqual } from 'node:crypto';

export interface JwtParts {
  header: Record<string, unknown>;
  payload: Record<string, unknown>;
  signingInput: string;
  signature: string;
}

const MAX_TOKEN_LENGTH = 8192;

function decodePart(part: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function bearerToken(authorization: string | null): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(authorization ?? '');
  return match ? match[1] : null;
}

export function parseJwt(token: string): JwtParts | null {
  if (token.length > MAX_TOKEN_LENGTH) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const header = decodePart(parts[0]);
  const payload = decodePart(parts[1]);
  if (!header || !payload) return null;
  return { header, payload, signingInput: `${parts[0]}.${parts[1]}`, signature: parts[2] };
}

// Hanya HS256 (secret bersama). alg lain, termasuk "none", ditolak.
export function verifyHs256(jwt: JwtParts, secret: string): boolean {
  if (jwt.header.alg !== 'HS256') return false;
  const expected = createHmac('sha256', secret).update(jwt.signingInput).digest();
  const given = Buffer.from(jwt.signature, 'base64url');
  return given.length === expected.length && timingSafeEqual(given, expected);
}
