import { behavior } from '../../../lib/behavior.ts';
import { upstreamBase } from '../../../lib/chain.ts';
import { checkDependency } from '../../../lib/dependency.ts';
import { wrap } from '../../../lib/handler.ts';
import { state, uptimeSeconds } from '../../../lib/state.ts';
import { json, podInfo } from '../../../lib/util.ts';

export const dynamic = 'force-dynamic';

export const GET = wrap('info', async () =>
  json({
    ...podInfo(),
    uptimeSeconds: uptimeSeconds(),
    ready: state.ready,
    healthy: state.healthy,
    draining: state.draining,
    started: state.started,
    behavior: behavior(),
    dependency: await checkDependency(),
    upstreamConfigured: upstreamBase() !== null,
    rssMb: Math.round(process.memoryUsage.rss() / 1_048_576),
    time: new Date().toISOString(),
  }),
);
