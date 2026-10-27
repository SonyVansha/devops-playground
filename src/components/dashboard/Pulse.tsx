'use client';

import { useI18n } from '../../i18n/client';
import type { MsgKey } from '../../i18n/en';
import { MAX_SAMPLES, eventsOf, tickOf, type RowKey, type Sample, type Tick } from './history';
import { clock, type Status } from './status';

const LABEL_KEYS: Record<RowKey, MsgKey> = {
  liveness: 'pulse.liveness',
  readiness: 'pulse.readiness',
  traffic: 'pulse.traffic',
  cpu: 'pulse.cpu',
  memory: 'pulse.memory',
};

const TICK_KEYS: Record<Tick, MsgKey> = {
  ok: 'tick.ok',
  bad: 'tick.bad',
  warn: 'tick.warn',
  idle: 'tick.idle',
  none: 'tick.none',
};

export const PROBE_ROWS: readonly RowKey[] = ['liveness', 'readiness', 'traffic'];
export const CHAOS_ROWS: readonly RowKey[] = ['liveness', 'readiness', 'traffic', 'cpu', 'memory'];

interface PulseProps {
  samples: readonly Sample[];
  status: Status;
  /** Baris yang ditampilkan; Fault injection menambah CPU dan memori. */
  rows?: readonly RowKey[];
  /** "side" = lajur sempit yang menempel di samping aksi. */
  variant?: 'hero' | 'side';
  /** Judul ringkas di atas pita (hanya varian side). */
  title?: string;
}

// Pita detak: tiap pembacaan /api/info (5 detik) menjadi satu tick; kanan = sekarang. Perubahan dicatat di bawahnya.
export default function Pulse({ samples, status, rows = PROBE_ROWS, variant = 'hero', title }: Readonly<PulseProps>) {
  const { t, locale } = useI18n();
  const events = eventsOf(samples, variant === 'side' ? 6 : 4);
  const empty = MAX_SAMPLES - samples.length;
  const minutes = Math.round((MAX_SAMPLES * 5) / 60);

  return (
    <section className={`pulse ${variant}`} aria-labelledby={`pulse-state-${variant}`}>
      <div className="pulse-head">
        {title && <p className="pulse-title">{title}</p>}
        <h2 id={`pulse-state-${variant}`} className={`pulse-state ${status.tone}`}>
          {status.headline}
        </h2>
        {status.detail && <p className="pulse-detail">{status.detail}</p>}
      </div>

      <div className="tape">
        {rows.map((key) => {
          const last = samples[samples.length - 1];
          const label = t(LABEL_KEYS[key]);
          const now = last ? t(TICK_KEYS[tickOf(key, last)]) : t('tick.nodata');
          return (
            <div className="tape-row" key={key}>
              <span className="tape-label">{label}</span>
              <span className="ticks" role="img" aria-label={t('pulse.rowAria', { label, state: now, n: samples.length })}>
                {Array.from({ length: MAX_SAMPLES }, (_, i) => {
                  const s = samples[i - empty];
                  return <i key={i} className={`tick ${s ? tickOf(key, s) : 'blank'}`} />;
                })}
              </span>
            </div>
          );
        })}
        <div className="tape-axis" aria-hidden="true">
          <span className="tape-label" />
          <span className="axis-line">
            <span>{t('pulse.axisAgo', { min: minutes })}</span>
            <span>{t('pulse.axisNow')}</span>
          </span>
        </div>
      </div>

      {events.length > 0 ? (
        <ol className="pulse-events" aria-label={t('pulse.eventsAria')}>
          {events.map((e, i) => (
            <li key={`${e.t}-${i}`} className={e.tone}>
              <time dateTime={new Date(e.t).toISOString()}>{clock(e.t, locale)}</time>
              <span>{t(e.key, e.vars)}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="pulse-empty">{samples.length < 2 ? t('pulse.collecting') : t('pulse.noChange', { n: samples.length })}</p>
      )}
    </section>
  );
}
