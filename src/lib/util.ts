import { readFileSync } from 'node:fs';
import { hostname, networkInterfaces } from 'node:os';

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

const SA_NAMESPACE_FILE = '/var/run/secrets/kubernetes.io/serviceaccount/namespace';

function osHostname(): string | null {
  try {
    return hostname() || null;
  } catch {
    return null;
  }
}

function serviceAccountNamespace(): string | null {
  try {
    const ns = readFileSync(SA_NAMESPACE_FILE, 'utf8').trim();
    return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(ns) ? ns : null;
  } catch {
    return null;
  }
}

function firstIpv4(): string | null {
  for (const addresses of Object.values(networkInterfaces())) {
    for (const a of addresses ?? []) {
      if (a.family === 'IPv4' && !a.internal) return a.address;
    }
  }
  return null;
}

// Env HOSTNAME BUKAN identitas yang andal: image memakainya sebagai alamat bind (0.0.0.0) dan tidak semua platform
// menimpanya. Hostname OS di dalam container Kubernetes = nama pod, jadi dipakai sebagai cadangan POD_NAME.
export function selfName(): string | null {
  return process.env.POD_NAME ?? osHostname();
}

// Hanya variabel non-sensitif yang boleh ditampilkan (allowlist).
// Identitas pod: env (downward API) diutamakan; bila tidak ada, dicari dari hostname OS, service account, dan antarmuka jaringan.
// Nama node tidak bisa diketahui tanpa downward API (NODE_NAME).
export function podInfo() {
  const e = process.env;
  const namespace = e.POD_NAMESPACE ?? serviceAccountNamespace();
  const podIp = e.POD_IP ?? firstIpv4();
  return {
    hostname: osHostname(),
    podName: selfName(),
    namespace,
    nodeName: e.NODE_NAME ?? null,
    podIp,
    identitySource: {
      pod: e.POD_NAME ? 'env' : osHostname() ? 'hostname' : null,
      namespace: e.POD_NAMESPACE ? 'env' : namespace ? 'serviceaccount' : null,
      nodeName: e.NODE_NAME ? 'env' : null,
      podIp: e.POD_IP ? 'env' : podIp ? 'interface' : null,
    },
    appVersion: e.APP_VERSION ?? 'dev',
    nodeVersion: process.version,
    chaosEnabled: chaosEnabled(),
  };
}
