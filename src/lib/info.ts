import { behavior } from './behavior.ts';
import { upstreamBase } from './chain.ts';
import { checkDependency } from './dependency.ts';
import { state, uptimeSeconds } from './state.ts';
import { podInfo } from './util.ts';

// Satu sumber untuk /api/info dan untuk data awal halaman dashboard (dirender server), supaya cetakan pertama sudah final.
export async function infoPayload() {
  return {
    ...podInfo(),
    uptimeSeconds: uptimeSeconds(),
    ready: state.ready,
    healthy: state.healthy,
    draining: state.draining,
    started: state.started,
    load: { cpuWorkers: state.cpuWorkers, heldMb: state.heldMb },
    behavior: behavior(),
    dependency: await checkDependency(),
    upstreamConfigured: upstreamBase() !== null,
    rssMb: Math.round(process.memoryUsage.rss() / 1_048_576),
    time: new Date().toISOString(),
  };
}
