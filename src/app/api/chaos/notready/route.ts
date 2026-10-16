import { chaosGuard } from '../../../../lib/chaos.ts';
import { wrap } from '../../../../lib/handler.ts';
import { state } from '../../../../lib/state.ts';
import { json } from '../../../../lib/util.ts';

export const dynamic = 'force-dynamic';

// POST: toggle readiness -> tes pod keluar dari Service endpoints.
export const POST = wrap('chaos_notready', (request) => {
  const denied = chaosGuard(request);
  if (denied) return denied;
  state.ready = !state.ready;
  return json({ ready: state.ready });
});
