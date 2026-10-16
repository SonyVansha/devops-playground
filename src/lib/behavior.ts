import { state } from './state.ts';
import { clampInt } from './util.ts';

// Perilaku workload yang diatur saat deploy lewat env, supaya satu image bisa memerankan
// versi yang sehat, lambat start, rusak, bocor memori, dll.
export interface Behavior {
  startupDelaySeconds: number; // STARTUP_DELAY_SECONDS: startup/readiness gagal selama N detik
  crashAfterSeconds: number; // CRASH_AFTER_SECONDS: exit 1 setelah N detik (CrashLoopBackOff)
  bootFail: boolean; // BOOT_FAIL=true: exit 1 saat start (rollout gagal -> rollback)
  errorRate: number; // ERROR_RATE: % /api/hello membalas 500 (canary analysis)
  latencyMs: number; // LATENCY_MS: latency tetap /api/hello
  leakMbPerMinute: number; // LEAK_MB_PER_MINUTE: memori bertambah terus (OOMKilled)
}

export function behavior(env: Record<string, string | undefined> = process.env): Behavior {
  const n = (key: string, max: number): number => clampInt(env[key] ?? null, 0, max, 0);
  return {
    startupDelaySeconds: n('STARTUP_DELAY_SECONDS', 600),
    crashAfterSeconds: n('CRASH_AFTER_SECONDS', 86_400),
    bootFail: env.BOOT_FAIL === 'true',
    errorRate: n('ERROR_RATE', 100),
    latencyMs: n('LATENCY_MS', 30_000),
    leakMbPerMinute: n('LEAK_MB_PER_MINUTE', 256),
  };
}

const leaked: Buffer[] = [];

export function leakOnce(mb: number): void {
  leaked.push(Buffer.alloc(mb * 1024 * 1024, 1));
  state.heldMb += mb;
}

function log(msg: string): void {
  console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'warn', msg }));
}

// Dipanggil sekali saat server start (instrumentation). Timer di-unref agar tidak menahan proses.
export function applyBehavior(b: Behavior, exit: (code: number) => void = process.exit): void {
  if (b.bootFail) {
    log('BOOT_FAIL=true, exiting with code 1');
    exit(1);
    return;
  }
  if (b.startupDelaySeconds > 0) {
    state.started = false;
    state.ready = false;
    setTimeout(() => {
      state.started = true;
      state.ready = true;
    }, b.startupDelaySeconds * 1000).unref();
  }
  if (b.crashAfterSeconds > 0) {
    setTimeout(() => {
      log('CRASH_AFTER_SECONDS elapsed, exiting with code 1');
      exit(1);
    }, b.crashAfterSeconds * 1000).unref();
  }
  if (b.leakMbPerMinute > 0) {
    setInterval(() => leakOnce(b.leakMbPerMinute), 60_000).unref();
  }
}
