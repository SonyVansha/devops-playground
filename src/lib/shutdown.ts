import { state } from './state.ts';
import { clampInt } from './util.ts';

// Graceful shutdown: saat SIGTERM -> readiness gagal, tetap melayani selama DRAIN_SECONDS, lalu exit 0.
// Perlu NEXT_MANUAL_SIG_HANDLE=true agar Next tidak langsung exit sendiri.
export function installShutdownHandler(): void {
  const drainSeconds = clampInt(process.env.DRAIN_SECONDS ?? null, 0, 120, 10);
  const onSignal = (): void => {
    if (state.draining) return;
    state.ready = false;
    state.draining = true;
    console.log(
      JSON.stringify({ ts: new Date().toISOString(), level: 'info', msg: 'signal received, draining', drainSeconds }),
    );
    setTimeout(() => process.exit(0), drainSeconds * 1000);
  };
  process.on('SIGTERM', onSignal);
  process.on('SIGINT', onSignal);
}
