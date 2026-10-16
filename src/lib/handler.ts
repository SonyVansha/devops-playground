import { record } from './state.ts';
import { json } from './util.ts';

type Handler<C> = (request: Request, ctx: C) => Response | Promise<Response>;

// Probe dan metrics tidak di-log supaya log tidak banjir.
const QUIET = new Set(['healthz', 'livez', 'readyz', 'startupz', 'metrics']);

// Membungkus handler: hitung metrics per route, log JSON terstruktur, dan tangkap error.
// Log hanya berisi nama route tetap, method, status, durasi (tanpa input user -> aman dari log injection).
export function wrap<C = unknown>(name: string, fn: Handler<C>) {
  return async (request: Request, ctx: C): Promise<Response> => {
    const start = performance.now();
    let response: Response;
    try {
      response = await fn(request, ctx);
    } catch {
      response = json({ error: 'internal error' }, 500);
    }
    const ms = performance.now() - start;
    record(name, response.status, ms);
    if (!QUIET.has(name)) {
      console.log(
        JSON.stringify({
          ts: new Date().toISOString(),
          level: 'info',
          route: name,
          method: request.method,
          status: response.status,
          ms: Math.round(ms),
        }),
      );
    }
    return response;
  };
}
