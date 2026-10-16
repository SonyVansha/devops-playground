export function chaosEnabled(): boolean {
  return process.env.ENABLE_CHAOS === 'true';
}

export function clampInt(raw: string | null, min: number, max: number, fallback: number): number {
  if (raw === null || !/^\d{1,9}$/.test(raw)) return fallback;
  return Math.min(Math.max(Number.parseInt(raw, 10), min), max);
}

export function json(body: unknown, status = 200, extra?: HeadersInit): Response {
  const headers = new Headers(extra);
  headers.set('Cache-Control', 'no-store');
  return Response.json(body, { status, headers });
}

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'proxy-authorization',
  'cookie',
  'set-cookie',
  'apikey',
  'x-api-key',
  'x-auth-token',
  'x-chaos-token',
]);

// Jangan pernah memantulkan kredensial (key-auth Kong, bearer token, cookie) ke response.
export function redactHeaders(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((value, name) => {
    out[name] = SENSITIVE_HEADERS.has(name.toLowerCase()) ? '[REDACTED]' : value;
  });
  return out;
}

export function selfName(): string | null {
  return process.env.POD_NAME ?? process.env.HOSTNAME ?? null;
}

// Hanya variabel non-sensitif yang boleh ditampilkan (allowlist).
export function podInfo() {
  const e = process.env;
  return {
    hostname: e.HOSTNAME ?? null,
    podName: e.POD_NAME ?? null,
    namespace: e.POD_NAMESPACE ?? null,
    nodeName: e.NODE_NAME ?? null,
    podIp: e.POD_IP ?? null,
    appVersion: e.APP_VERSION ?? 'dev',
    nodeVersion: process.version,
    chaosEnabled: chaosEnabled(),
  };
}
