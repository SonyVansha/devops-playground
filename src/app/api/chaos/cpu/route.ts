import { Worker } from 'node:worker_threads';
import { chaosGuard } from '../../../../lib/chaos.ts';
import { wrap } from '../../../../lib/handler.ts';
import { state } from '../../../../lib/state.ts';
import { clampInt, json } from '../../../../lib/util.ts';

export const dynamic = 'force-dynamic';

const MAX_SECONDS = 120;
const MAX_WORKERS = 4;
const BURN_SCRIPT =
  'const { workerData } = require("node:worker_threads");' +
  'const end = Date.now() + workerData.seconds * 1000;' +
  'while (Date.now() < end) { /* busy loop */ }';

function startBurner(seconds: number): void {
  const worker = new Worker(BURN_SCRIPT, { eval: true, workerData: { seconds } });
  state.cpuWorkers += 1;
  worker.once('error', () => undefined);
  worker.once('exit', () => {
    state.cpuWorkers = Math.max(0, state.cpuWorkers - 1);
  });
}

// POST /api/chaos/cpu?seconds=30&workers=2 -> bakar CPU di worker thread (event loop & probe tetap hidup),
// jadi HPA bisa naik dan CPU throttling bisa diamati. Mengembalikan 202 segera.
export const POST = wrap('chaos_cpu', (request) => {
  const denied = chaosGuard(request);
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  const seconds = clampInt(params.get('seconds'), 1, MAX_SECONDS, 30);
  const workers = clampInt(params.get('workers'), 1, MAX_WORKERS, 1);
  if (state.cpuWorkers + workers > MAX_WORKERS) {
    return json({ error: 'too many active burners', active: state.cpuWorkers, max: MAX_WORKERS }, 429);
  }
  for (let i = 0; i < workers; i += 1) startBurner(seconds);
  return json({ started: true, seconds, workers, active: state.cpuWorkers }, 202);
});
