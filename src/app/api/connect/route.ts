import { lookup } from 'node:dns/promises';
import { connect } from 'node:net';
import { wrap } from '../../../lib/handler.ts';
import { json } from '../../../lib/util.ts';

export const dynamic = 'force-dynamic';

const TIMEOUT_MS = 3000;

function allowlist(): string[] {
  return (process.env.CONNECT_ALLOWLIST ?? '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

function errorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : 'ERROR';
}

async function checkDns(host: string): Promise<Record<string, unknown>> {
  const start = performance.now();
  try {
    const found = await lookup(host, { all: true });
    return { reachable: true, addresses: found.map((a) => a.address), ms: Math.round(performance.now() - start) };
  } catch (error) {
    return { reachable: false, error: errorCode(error) };
  }
}

function checkTcp(host: string, port: number): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const start = performance.now();
    const socket = connect({ host, port, timeout: TIMEOUT_MS });
    const finish = (result: Record<string, unknown>): void => {
      socket.destroy();
      resolve(result);
    };
    socket.once('connect', () => finish({ reachable: true, ms: Math.round(performance.now() - start) }));
    socket.once('timeout', () => finish({ reachable: false, error: 'TIMEOUT' }));
    socket.once('error', (error) => finish({ reachable: false, error: errorCode(error) }));
  });
}

async function checkHttp(url: URL): Promise<Record<string, unknown>> {
  const start = performance.now();
  try {
    const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(TIMEOUT_MS) });
    return { reachable: true, status: res.status, ms: Math.round(performance.now() - start) };
  } catch (error) {
    return { reachable: false, error: errorCode(error) };
  }
}

function parseHostPort(target: string): { host: string; port: number } | null {
  const [host, portRaw, ...rest] = target.split(':');
  const port = Number.parseInt(portRaw ?? '', 10);
  if (rest.length > 0 || !host || !Number.isInteger(port) || port < 1 || port > 65535) return null;
  return { host: host.toLowerCase(), port };
}

function parseHttpTarget(target: string): URL | null {
  try {
    const url = new URL(target);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

// /api/connect?type=dns|tcp|http&target=...  (tes DNS, egress, NetworkPolicy, service-to-service)
// Hanya host di CONNECT_ALLOWLIST yang boleh dituju (cegah SSRF).
export const GET = wrap('connect', async (request) => {
  const params = new URL(request.url).searchParams;
  const type = params.get('type');
  const target = params.get('target') ?? '';
  const allowed = allowlist();
  if (allowed.length === 0) return json({ error: 'CONNECT_ALLOWLIST is not configured' }, 403);

  const deny = (host: string) => json({ error: 'host not in allowlist', host }, 403);
  const bad = () => json({ error: 'invalid target for type' }, 400);

  if (type === 'dns') {
    const host = target.toLowerCase();
    return allowed.includes(host) ? json(await checkDns(host)) : deny(host);
  }
  if (type === 'tcp') {
    const hp = parseHostPort(target);
    if (!hp) return bad();
    return allowed.includes(hp.host) ? json(await checkTcp(hp.host, hp.port)) : deny(hp.host);
  }
  if (type === 'http') {
    const url = parseHttpTarget(target);
    if (!url) return bad();
    return allowed.includes(url.hostname.toLowerCase()) ? json(await checkHttp(url)) : deny(url.hostname);
  }
  return json({ error: 'type must be dns, tcp, or http' }, 400);
});
