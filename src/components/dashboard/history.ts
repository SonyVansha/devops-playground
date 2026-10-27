import type { MsgKey } from '../../i18n/en.ts';
import type { Vars } from '../../i18n/core.ts';

// Riwayat pembacaan /api/info untuk pita detak: satu sampel per polling (5 detik), disimpan di memori halaman.
// Tidak ada data yang dikarang: yang ditampilkan hanya apa yang benar-benar dibaca browser.

export interface Sample {
  t: number;
  /** false bila /api/info tidak bisa dijangkau pada pembacaan ini. */
  up: boolean;
  started: boolean;
  healthy: boolean;
  ready: boolean;
  draining: boolean;
  uptime: number;
  /** worker CPU yang sedang membakar (chaos). */
  cpu: number;
  /** memori yang sedang ditahan, dalam MB (chaos). */
  held: number;
}

export type RowKey = 'liveness' | 'readiness' | 'traffic' | 'cpu' | 'memory';
// idle = tidak ada beban (bukan data hilang); none = tidak ada pembacaan.
export type Tick = 'ok' | 'bad' | 'warn' | 'idle' | 'none';

export interface PulseEvent {
  t: number;
  tone: 'ok' | 'err' | 'warn';
  /** Kunci terjemahan; teksnya dibentuk saat dirender sesuai bahasa. */
  key: MsgKey;
  vars?: Vars;
}

// 60 pembacaan x 5 detik = 5 menit.
export const MAX_SAMPLES = 60;

export function pushSample(list: readonly Sample[], next: Sample, max = MAX_SAMPLES): Sample[] {
  const last = list[list.length - 1];
  const base = last && last.t === next.t ? list.slice(0, -1) : list; // pembacaan yang sama tidak dicatat dua kali
  return [...base, next].slice(-max);
}

export function tickOf(row: RowKey, s: Sample): Tick {
  if (!s.up) return 'none';
  if (row === 'cpu') return s.cpu > 0 ? 'warn' : 'idle';
  if (row === 'memory') return s.held > 0 ? 'warn' : 'idle';
  if (row === 'liveness') return s.healthy ? 'ok' : 'bad';
  if (row === 'readiness') {
    if (s.ready) return 'ok';
    return s.started ? 'bad' : 'warn';
  }
  if (s.draining) return 'warn';
  return s.ready ? 'ok' : 'bad';
}

// Perubahan antar pembacaan berurutan, terbaru lebih dulu.
export function eventsOf(list: readonly Sample[], limit = 4): PulseEvent[] {
  const out: PulseEvent[] = [];
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1];
    const b = list[i];
    const add = (tone: PulseEvent['tone'], key: MsgKey, vars?: Vars) => out.push({ t: b.t, tone, key, vars });

    if (a.up && !b.up) {
      add('err', 'ev.unreachable');
      continue;
    }
    if (!a.up && b.up) add('ok', 'ev.reachable');
    if (!a.up || !b.up) continue;

    if (b.uptime + 2 < a.uptime) add('warn', 'ev.restart');
    if (a.healthy && !b.healthy) add('err', 'ev.liveFail');
    if (!a.healthy && b.healthy) add('ok', 'ev.liveOk');
    if (!a.draining && b.draining) add('warn', 'ev.draining');
    else if (a.ready && !b.ready) add('err', 'ev.readyOff');
    if (!a.ready && b.ready) add('ok', 'ev.readyOn');
    if (a.cpu === 0 && b.cpu > 0) add('warn', b.cpu === 1 ? 'ev.cpuOn.1' : 'ev.cpuOn', { n: b.cpu });
    else if (a.cpu > 0 && b.cpu === 0) add('ok', 'ev.cpuOff');
    if (b.held > 0 && b.held !== a.held) add('warn', 'ev.memHeld', { mb: b.held });
    else if (a.held > 0 && b.held === 0) add('ok', 'ev.memFree');
  }
  return out.reverse().slice(0, limit);
}
