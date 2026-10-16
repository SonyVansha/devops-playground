import { randomBytes, randomUUID } from 'node:crypto';
import { clampInt } from './util.ts';

export const MAX_DEPTH = 5;

const TRACEPARENT = /^00-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;
const PROPAGATE = ['tracestate', 'b3', 'x-b3-traceid', 'x-b3-spanid', 'x-b3-sampled', 'x-correlation-id'];

export interface Trace {
  traceId: string;
  spanId: string;
  parentSpanId: string | null;
  traceparent: string;
}

// W3C Trace Context: pertahankan traceId dari request masuk, buat spanId baru untuk hop ini.
export function nextTrace(incoming: string | null): Trace {
  const match = TRACEPARENT.exec(incoming ?? '');
  const traceId = match ? match[1] : randomBytes(16).toString('hex');
  const parentSpanId = match ? match[2] : null;
  const spanId = randomBytes(8).toString('hex');
  return { traceId, spanId, parentSpanId, traceparent: `00-${traceId}-${spanId}-${match ? match[3] : '01'}` };
}

// Target hop berikutnya hanya dari env UPSTREAM_URL (bukan dari request) -> tidak ada SSRF.
export function upstreamBase(): string | null {
  const raw = process.env.UPSTREAM_URL;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
  } catch {
    return null;
  }
}

export function chainTimeoutMs(): number {
  return clampInt(process.env.CHAIN_TIMEOUT_MS ?? null, 100, 30_000, 3000);
}

export function outgoingHeaders(incoming: Headers, trace: Trace, requestId: string): Headers {
  const out = new Headers({ traceparent: trace.traceparent, 'x-request-id': requestId });
  for (const name of PROPAGATE) {
    const value = incoming.get(name);
    if (value !== null) out.set(name, value);
  }
  return out;
}

export function requestIdOf(incoming: Headers): string {
  return incoming.get('x-request-id') ?? randomUUID();
}

export type Downstream = { ok: true; body: unknown } | { ok: false; detail: Record<string, unknown> };

export async function callDownstream(base: string, depth: number, headers: Headers): Promise<Downstream> {
  try {
    const res = await fetch(`${base}/api/chain?depth=${depth - 1}`, {
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(chainTimeoutMs()),
    });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // bukan JSON (mis. error dari proxy): simpan teks apa adanya (dipotong)
      body = text.slice(0, 200);
    }
    return res.ok ? { ok: true, body } : { ok: false, detail: { status: res.status, body } };
  } catch (error) {
    const e = error as { name?: string; cause?: { code?: string } } | null;
    const code = e?.name === 'TimeoutError' || e?.name === 'AbortError' ? 'TIMEOUT' : (e?.cause?.code ?? 'ERROR');
    return { ok: false, detail: { error: code } };
  }
}
