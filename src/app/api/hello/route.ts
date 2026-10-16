import { randomInt } from 'node:crypto';
import { behavior } from '../../../lib/behavior.ts';
import { wrap } from '../../../lib/handler.ts';
import { json, podInfo, selfName } from '../../../lib/util.ts';

export const dynamic = 'force-dynamic';

// Endpoint "bisnis" workload dummy. Perilakunya diatur lewat env (ERROR_RATE, LATENCY_MS), jadi
// versi berbeda (APP_VERSION) bisa dibedakan oleh canary analysis (Argo Rollouts/Flagger), load test, dan alerting.
export const GET = wrap('hello', async () => {
  const b = behavior();
  const version = podInfo().appVersion;
  if (b.latencyMs > 0) await new Promise((resolve) => setTimeout(resolve, b.latencyMs));
  if (b.errorRate > 0 && randomInt(100) < b.errorRate) {
    return json({ error: 'simulated failure', version, pod: selfName() }, 500);
  }
  return json({ message: 'hello', version, pod: selfName(), time: new Date().toISOString() });
});
