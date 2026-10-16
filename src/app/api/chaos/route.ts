import { wrap } from '../../../lib/handler.ts';
import { state } from '../../../lib/state.ts';
import { chaosEnabled, json, selfName } from '../../../lib/util.ts';

export const dynamic = 'force-dynamic';

// Status chaos (tanpa rahasia): dipakai UI untuk tahu apakah chaos aktif dan state saat ini.
export const GET = wrap('chaos_status', () =>
  json({
    enabled: chaosEnabled(),
    tokenRequired: true,
    tokenConfigured: Boolean(process.env.CHAOS_TOKEN),
    pod: selfName(),
    ready: state.ready,
    healthy: state.healthy,
    cpuWorkers: state.cpuWorkers,
    heldMb: state.heldMb,
  }),
);
