export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

export interface CallResult {
  status: number;
  ok: boolean;
  ms: number;
  headers: Array<[string, string]>;
  body: string;
  redirected: boolean;
  url: string;
  error?: string;
}

export interface InfoData {
  hostname: string | null;
  podName: string | null;
  namespace: string | null;
  nodeName: string | null;
  podIp: string | null;
  appVersion: string;
  nodeVersion: string;
  chaosEnabled: boolean;
  identitySource: { pod: string | null; namespace: string | null; nodeName: string | null; podIp: string | null };
  uptimeSeconds: number;
  ready: boolean;
  healthy: boolean;
  draining: boolean;
  started: boolean;
  rssMb: number;
  dependency: { configured: boolean; ok: boolean | null; status?: number; error?: string };
  upstreamConfigured: boolean;
  behavior: {
    startupDelaySeconds: number;
    crashAfterSeconds: number;
    bootFail: boolean;
    errorRate: number;
    latencyMs: number;
    leakMbPerMinute: number;
  };
}

// Selalu relatif ke origin yang sama: hilangkan slash di depan agar "//host" tidak jadi protocol-relative URL.
export function normalizePath(path: string): string {
  return '/' + path.trim().replace(/^\/+/, '');
}

export function urlFor(path: string): string {
  return BASE + normalizePath(path);
}

export function statusClass(status: number): string {
  return `s${Math.floor(status / 100)}`;
}

export function fmtUptime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export async function call(
  method: string,
  path: string,
  init: { headers?: Record<string, string>; body?: string; signal?: AbortSignal } = {},
): Promise<CallResult> {
  const start = performance.now();
  const elapsed = () => Math.round(performance.now() - start);
  try {
    const res = await fetch(urlFor(path), {
      method,
      headers: init.headers,
      body: method === 'GET' || method === 'HEAD' ? undefined : init.body,
      signal: init.signal,
      cache: 'no-store',
    });
    const body = await res.text();
    return {
      status: res.status,
      ok: res.ok,
      ms: elapsed(),
      headers: Array.from(res.headers.entries()),
      body,
      redirected: res.redirected,
      url: res.url,
    };
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === 'AbortError';
    return {
      status: 0,
      ok: false,
      ms: elapsed(),
      headers: [],
      body: '',
      redirected: false,
      url: '',
      error: aborted ? 'aborted' : 'network error',
    };
  }
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function toCurl(method: string, path: string, headers: Record<string, string>, body: string): string {
  const parts = ['curl -i', `-X ${method}`, shellQuote(window.location.origin + urlFor(path))];
  for (const [k, v] of Object.entries(headers)) parts.push(`-H ${shellQuote(`${k}: ${v}`)}`);
  if (body && method !== 'GET' && method !== 'HEAD') parts.push(`--data ${shellQuote(body)}`);
  return parts.join(' ');
}
