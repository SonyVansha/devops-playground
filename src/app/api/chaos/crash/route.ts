import { chaosGuard } from '../../../../lib/chaos.ts';
import { wrap } from '../../../../lib/handler.ts';
import { json } from '../../../../lib/util.ts';

export const dynamic = 'force-dynamic';

// POST: proses keluar (exit 1) setelah respons terkirim -> tes restart / CrashLoopBackOff.
export const POST = wrap('chaos_crash', (request) => {
  const denied = chaosGuard(request);
  if (denied) return denied;
  setTimeout(() => process.exit(1), 200);
  return json({ crashing: true });
});
