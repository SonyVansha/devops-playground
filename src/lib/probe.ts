import { json } from './util.ts';
import { checkDependency } from './dependency.ts';
import { state } from './state.ts';

export function probe(ok: boolean, name: string): Response {
  return json({ status: ok ? 'ok' : 'fail', probe: name, draining: state.draining }, ok ? 200 : 503);
}

export function liveness(): Response {
  return probe(state.healthy, 'liveness');
}

// Readiness ikut mempertimbangkan dependency (DEPENDENCY_URL) bila dikonfigurasi. Liveness sengaja TIDAK.
export async function readiness(): Promise<Response> {
  const dependency = await checkDependency();
  const ok = state.ready && state.healthy && dependency.ok !== false;
  return json(
    {
      status: ok ? 'ok' : 'fail',
      probe: 'readiness',
      draining: state.draining,
      dependency: dependency.configured ? { ok: dependency.ok, status: dependency.status, error: dependency.error } : undefined,
    },
    ok ? 200 : 503,
  );
}
