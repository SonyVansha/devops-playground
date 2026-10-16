export interface RouteStat {
  count: number;
  durationMs: number;
  byStatus: Record<string, number>;
}

export interface AppState {
  startedAt: number;
  started: boolean;
  ready: boolean;
  healthy: boolean;
  draining: boolean;
  dependencyOk: boolean | null;
  heldMb: number;
  cpuWorkers: number;
  routes: Record<string, RouteStat>;
}

const globalRef = globalThis as typeof globalThis & { __appState?: AppState };

export const state: AppState = (globalRef.__appState ??= {
  startedAt: Date.now(),
  started: true,
  ready: true,
  healthy: true,
  draining: false,
  dependencyOk: null,
  heldMb: 0,
  cpuWorkers: 0,
  routes: {},
});

export function uptimeSeconds(): number {
  return Math.floor((Date.now() - state.startedAt) / 1000);
}

// Nama route selalu string tetap dari kode (bukan input user), jadi kardinalitas terbatas.
export function record(route: string, status: number, ms: number): void {
  const stat = (state.routes[route] ??= { count: 0, durationMs: 0, byStatus: {} });
  stat.count += 1;
  stat.durationMs += ms;
  const key = String(status);
  stat.byStatus[key] = (stat.byStatus[key] ?? 0) + 1;
}
