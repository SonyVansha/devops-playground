import { state } from './state.ts';

export interface DependencyStatus {
  configured: boolean;
  ok: boolean | null;
  status?: number;
  ms?: number;
  error?: string;
  checkedAt?: string;
}

const CACHE_MS = 2000;
const TIMEOUT_MS = 1500;
let cache: { at: number; url: string; value: DependencyStatus } | null = null;

export function resetDependencyCache(): void {
  cache = null;
}

function dependencyUrl(): URL | null {
  const raw = process.env.DEPENDENCY_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function errorCode(error: unknown): string {
  const e = error as { name?: string; cause?: { code?: string } } | null;
  if (e?.name === 'TimeoutError' || e?.name === 'AbortError') return 'TIMEOUT';
  return e?.cause?.code ?? 'ERROR';
}

// Cek dependency dari env DEPENDENCY_URL (konfigurasi tepercaya, bukan input request). Hasil di-cache 2 dtk
// supaya probe tidak membanjiri dependency. Dipakai readiness, BUKAN liveness (dependency mati tidak boleh me-restart pod).
export async function checkDependency(): Promise<DependencyStatus> {
  const url = dependencyUrl();
  if (!url) {
    state.dependencyOk = null;
    return { configured: false, ok: null };
  }
  if (cache && cache.url === url.href && Date.now() - cache.at < CACHE_MS) return cache.value;

  const start = performance.now();
  let value: DependencyStatus;
  try {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) });
    await res.body?.cancel();
    value = {
      configured: true,
      ok: res.status >= 200 && res.status < 300,
      status: res.status,
      ms: Math.round(performance.now() - start),
      checkedAt: new Date().toISOString(),
    };
  } catch (error) {
    value = { configured: true, ok: false, error: errorCode(error), checkedAt: new Date().toISOString() };
  }
  cache = { at: Date.now(), url: url.href, value };
  state.dependencyOk = value.ok;
  return value;
}
