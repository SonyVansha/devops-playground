'use client';

import type { ReactNode } from 'react';
import { useI18n } from '../../i18n/client';
import Rich from '../Rich';
import { fmtUptime, type InfoData } from './api';
import type { Sample } from './history';
import { usePoll } from './hooks';
import Pulse from './Pulse';
import { clock, describe } from './status';
import { CopyButton } from './ui';

// Nilai yang belum ada: bar abu-abu rata selebar nilainya, tanpa shimmer, supaya layout tidak bergeser saat data tiba.
function Skel({ w = 8 }: Readonly<{ w?: number }>) {
  return <span className="skel" style={{ width: `${w}ch` }} aria-hidden="true" />;
}

function Row({ label, children, mono }: Readonly<{ label: string; children: ReactNode; mono?: boolean }>) {
  return (
    <div className="dl-row">
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>{children}</dd>
    </div>
  );
}

// Nilai yang sering disalin (nama pod, IP) diberi tombol salin di sampingnya.
function Copyable({ text, children }: Readonly<{ text: string | null | undefined; children: ReactNode }>) {
  const { t } = useI18n();
  return (
    <span className="row between">
      <span className="grow-text">{children}</span>
      {text && <CopyButton text={text} label={t('common.copy')} />}
    </span>
  );
}

function Fact({ label, children, unit }: Readonly<{ label: string; children: ReactNode; unit?: string }>) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>
        {children}
        {unit && <span className="unit">{unit}</span>}
      </dd>
    </div>
  );
}

function ProbeRow({ name, path, active, seed }: Readonly<{ name: string; path: string; active: boolean; seed?: { status: number; at: number } }>) {
  const { t } = useI18n();
  // seed = status dari snapshot server saat halaman dirender, supaya tidak tampil "Memeriksa" sesaat.
  const { status, updatedAt } = usePoll<unknown>(path, 5000, active, seed ? { data: null, status: seed.status, at: seed.at } : undefined);
  let cls = 'pill';
  let text = t('ov.probe.checking');
  if (updatedAt !== null) {
    cls = status === 200 ? 'pill ok' : 'pill err';
    text = status === 200 ? t('ov.probe.pass') : t('ov.probe.fail', { code: status || 'ERR' });
  }
  return (
    <Row label={name}>
      <span className="row between">
        <code>{path}</code>
        <span className={cls}>{text}</span>
      </span>
    </Row>
  );
}

// Satuan: kunci kamus untuk yang bergantung bahasa, teks langsung untuk yang tidak.
const BEHAVIOR_LABELS: ReadonlyArray<[keyof InfoData['behavior'], string, 'unit.sec' | 'unit.perMin' | string]> = [
  ['bootFail', 'BOOT_FAIL', ''],
  ['startupDelaySeconds', 'STARTUP_DELAY_SECONDS', 'unit.sec'],
  ['crashAfterSeconds', 'CRASH_AFTER_SECONDS', 'unit.sec'],
  ['errorRate', 'ERROR_RATE', '%'],
  ['latencyMs', 'LATENCY_MS', 'ms'],
  ['leakMbPerMinute', 'LEAK_MB_PER_MINUTE', 'unit.perMin'],
];

interface OverviewProps {
  info: InfoData | null;
  reachable: boolean;
  updatedAt: number | null;
  lastOkAt: number | null;
  samples: readonly Sample[];
  onRetry: () => void;
  active: boolean;
}

export default function Overview({ info, reachable, updatedAt, lastOkAt, samples, onRetry, active }: Readonly<OverviewProps>) {
  const { t, locale } = useI18n();
  const unitOf = (u: string) => (u === 'unit.sec' || u === 'unit.perMin' ? t(u) : u);
  const loading = !info;
  const dash = <span className="muted">—</span>;
  const val = (x: string | null | undefined, w = 12) => (loading ? <Skel w={w} /> : x ? x : dash);
  const missing = (x: string | null | undefined, w = 12) => (loading ? <Skel w={w} /> : x ? x : <span className="muted">{t('ov.unavailable')}</span>);
  const lacksIdentity = info ? !info.namespace || !info.nodeName || !info.podIp : false;
  const dep = info?.dependency;
  const failed = updatedAt !== null && !reachable;
  const snapshot = (ok: boolean) => (info && reachable ? { status: ok ? 200 : 503, at: Date.parse(info.time) } : undefined);
  const anyBehavior = info ? BEHAVIOR_LABELS.some(([k]) => info.behavior[k] !== 0 && info.behavior[k] !== false) : false;

  return (
    <div className="stack" style={{ gap: 32 }}>
      {failed && (
        <div className="block-error" role="alert">
          <span>
            {t('ov.err.prefix')} <code>/api/info</code>.{' '}
            {lastOkAt ? t('ov.err.last', { time: clock(lastOkAt, locale) }) : t('st.unreachable.none')}
          </span>
          <button type="button" className="btn sm" onClick={onRetry}>
            {t('ov.retry')}
          </button>
        </div>
      )}

      <Pulse samples={samples} status={describe(info, reachable, lastOkAt, t, locale)} />

      <dl className="facts" aria-label={t('fact.aria')}>
        <Fact label={t('fact.version')}>{loading ? <Skel w={7} /> : info.appVersion}</Fact>
        <Fact label={t('fact.uptime')}>{loading ? <Skel w={7} /> : fmtUptime(info.uptimeSeconds)}</Fact>
        <Fact label={t('fact.memory')} unit={loading ? undefined : t('fact.mb')}>
          {loading ? <Skel w={5} /> : info.rssMb}
        </Fact>
        <Fact label={t('fact.node')}>{loading ? <Skel w={8} /> : info.nodeVersion}</Fact>
      </dl>

      <div className="cols">
        <div className="stack" style={{ gap: 32 }}>
          <section className="group" aria-labelledby="h-identitas">
            <h2 id="h-identitas">{t('ov.identity')}</h2>
            <dl className="dl">
              <Row label={t('ov.pod')} mono>
                <Copyable text={info?.podName ?? info?.hostname}>{val(info?.podName ?? info?.hostname, 18)}</Copyable>
              </Row>
              <Row label={t('ov.namespace')}>{missing(info?.namespace)}</Row>
              <Row label={t('ov.node')} mono={Boolean(info?.nodeName)}>
                {missing(info?.nodeName)}
              </Row>
              <Row label={t('ov.podIp')} mono={Boolean(info?.podIp)}>
                <Copyable text={info?.podIp}>{missing(info?.podIp, 14)}</Copyable>
              </Row>
            </dl>
            {lacksIdentity && (
              <p className="group-note">
                <Rich text={t('ov.note')} />
              </p>
            )}
          </section>

          <section className="group" aria-labelledby="h-dep">
            <h2 id="h-dep">{t('ov.dep')}</h2>
            <dl className="dl">
              <Row label="DEPENDENCY_URL">
                {loading ? (
                  <Skel w={8} />
                ) : dep?.configured ? (
                  <span className={`pill ${dep.ok ? 'ok' : 'err'}`}>{dep.ok ? t('ov.depOk') : t('ov.depFail', { code: dep.status ?? dep.error ?? 'ERR' })}</span>
                ) : (
                  <span className="muted">{t('ov.notSet')}</span>
                )}
              </Row>
              <Row label="UPSTREAM_URL">{loading ? <Skel w={10} /> : info.upstreamConfigured ? t('ov.configured') : <span className="muted">{t('ov.notSet')}</span>}</Row>
            </dl>
          </section>
        </div>

        <div className="stack" style={{ gap: 32 }}>
          <section className="group" aria-labelledby="h-probe">
            <h2 id="h-probe">{t('ov.probes')}</h2>
            <dl className="dl">
              <ProbeRow name={t('pulse.liveness')} path="/api/healthz" active={active} seed={snapshot(Boolean(info?.healthy))} />
              <ProbeRow name={t('pulse.readiness')} path="/api/readyz" active={active} seed={snapshot(Boolean(info?.ready && !info.draining && info.dependency.ok !== false))} />
              <ProbeRow name={t('ov.startup')} path="/api/startupz" active={active} seed={snapshot(Boolean(info?.started))} />
            </dl>
          </section>

          <section className="group" aria-labelledby="h-perilaku">
            <h2 id="h-perilaku">{t('ov.behavior')}</h2>
            <dl className="dl">
              {BEHAVIOR_LABELS.map(([key, name, unit]) => {
                const value = info?.behavior[key];
                const on = value !== undefined && value !== 0 && value !== false;
                let shown: ReactNode = <Skel w={6} />;
                if (value !== undefined) shown = typeof value === 'number' ? `${value} ${unitOf(unit)}`.trim() : String(value);
                return (
                  <Row key={key} label={name}>
                    {on ? <span className="pill warn">{shown}</span> : <span className="muted">{shown}</span>}
                  </Row>
                );
              })}
            </dl>
            <p className="group-note">
              {info && !anyBehavior
                ? t('ov.behaviorOk')
                : t('ov.behaviorOn')}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
