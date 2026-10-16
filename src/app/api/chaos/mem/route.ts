import { chaosGuard } from '../../../../lib/chaos.ts';
import { wrap } from '../../../../lib/handler.ts';
import { state } from '../../../../lib/state.ts';
import { clampInt, json } from '../../../../lib/util.ts';

export const dynamic = 'force-dynamic';

const MAX_CHUNK_MB = 512;
const MAX_TOTAL_MB = 1024;
const held: Buffer[] = [];

// POST /api/chaos/mem?mb=100 -> alokasi memori yang ditahan (tes memory limit / OOMKilled).
export const POST = wrap('chaos_mem', (request) => {
  const denied = chaosGuard(request);
  if (denied) return denied;
  const mb = clampInt(new URL(request.url).searchParams.get('mb'), 1, MAX_CHUNK_MB, 50);
  if (state.heldMb + mb > MAX_TOTAL_MB) return json({ error: 'total cap reached', heldMb: state.heldMb }, 429);
  held.push(Buffer.alloc(mb * 1024 * 1024, 1));
  state.heldMb += mb;
  return json({ allocatedMb: mb, heldMb: state.heldMb });
});

// DELETE: lepaskan semua memori yang ditahan.
export const DELETE = wrap('chaos_mem_release', (request) => {
  const denied = chaosGuard(request);
  if (denied) return denied;
  held.length = 0;
  state.heldMb = 0;
  return json({ released: true, heldMb: 0 });
});
