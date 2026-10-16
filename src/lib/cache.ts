// Tanggal tetap agar identik di semua pod (cache gateway/CDN tidak bergantung pada pod).
export const LAST_MODIFIED = 'Wed, 01 Jan 2025 00:00:00 GMT';

const MODES = new Set(['public', 'private', 'nostore', 'swr']);
const VARY_ALLOWLIST = new Set(['accept', 'accept-encoding', 'accept-language', 'origin', 'x-tenant']);

export function parseMode(raw: string | null): string {
  return raw !== null && MODES.has(raw) ? raw : 'public';
}

export function cacheControl(mode: string, ttl: number, sMaxAge: number | null): string {
  if (mode === 'nostore') return 'no-store';
  const parts = [mode === 'private' ? 'private' : 'public', `max-age=${ttl}`];
  if (mode === 'swr') parts.push(`stale-while-revalidate=${ttl}`);
  if (sMaxAge !== null && mode !== 'private') parts.push(`s-maxage=${sMaxAge}`);
  return parts.join(', ');
}

export function parseVary(raw: string | null): string | null {
  const wanted = (raw ?? '')
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .filter((v) => VARY_ALLOWLIST.has(v));
  return wanted.length > 0 ? wanted.join(', ') : null;
}

function etagTokens(header: string): string[] {
  return header.split(',').map((t) => t.trim().replace(/^W\//, ''));
}

// Validator HTTP: If-None-Match didahulukan, If-Modified-Since hanya bila INM tidak ada.
export function notModified(headers: Headers, etag: string): boolean {
  const inm = headers.get('if-none-match');
  if (inm !== null) {
    const tokens = etagTokens(inm);
    return tokens.includes('*') || tokens.includes(etag);
  }
  const ims = headers.get('if-modified-since');
  if (ims === null) return false;
  const since = Date.parse(ims);
  return !Number.isNaN(since) && since >= Date.parse(LAST_MODIFIED);
}
