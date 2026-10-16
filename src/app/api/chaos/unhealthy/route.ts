import { chaosGuard } from '../../../../lib/chaos.ts';
import { wrap } from '../../../../lib/handler.ts';
import { state } from '../../../../lib/state.ts';
import { json } from '../../../../lib/util.ts';

export const dynamic = 'force-dynamic';

// POST: toggle liveness -> tes restart oleh kubelet.
export const POST = wrap('chaos_unhealthy', (request) => {
  const denied = chaosGuard(request);
  if (denied) return denied;
  state.healthy = !state.healthy;
  return json({ healthy: state.healthy });
});
