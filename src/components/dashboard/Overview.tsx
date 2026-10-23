'use client';

import type { ReactNode } from 'react';
import { fmtUptime, type InfoData } from './api';
import { usePoll } from './hooks';
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
  return (
    <span className="row between">
      <span className="grow-text">{children}</span>
      {text && <CopyButton text={text} label="Salin" />}
    </span>
  );
}

function Kpi({ label, children, unit }: Readonly<{ label: string; children: ReactNode; unit?: string }>) {
  return (
    <div className="kpi">
      <dt>{label}</dt>
      <dd>
        {children}
        {unit && <span className="unit">{unit}</span>}
      </dd>
    </div>
  );
}

function ProbeRow({ name, path, active }: Readonly<{ name: string; path: string; active: boolean }>) {
  const { status, updatedAt } = usePoll<unknown>(path, 5000, active);
  let cls = 'pill';
  let text = 'Memeriksa';
  if (updatedAt !== null) {
    cls = status === 200 ? 'pill ok' : 'pill err';
    text = status === 200 ? 'Lolos' : `Gagal (${status || 'ERR'})`;
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

type StageState = 'ok' | 'bad' | 'warn' | 'pending';

interface Stage {
  name: string;
  state: StageState;
  note: string;
}

// Siklus hidup pod, tahap demi tahap: elemen khas produk ini (workload yang memerankan rollout dan probe).
function stagesOf(info: InfoData): Stage[] {
  const serving = info.ready && !info.draining;
  let traffic: Stage = { name: 'Traffic', state: 'pending', note: 'belum menerima' };
  if (serving) traffic = { name: 'Traffic', state: 'ok', note: 'menerima request' };
  else if (info.draining) traffic = { name: 'Traffic', state: 'warn', note: 'draining, tidak menerima baru' };
  else if (info.started) traffic = { name: 'Traffic', state: 'bad', note: 'keluar dari Endpoints' };
  return [
    { name: 'Start', state: info.started ? 'ok' : 'pending', note: info.started ? 'startup selesai' : 'menunggu startup probe' },
    { name: 'Liveness', state: info.healthy ? 'ok' : 'bad', note: info.healthy ? 'sehat' : 'gagal, akan di-restart' },
    { name: 'Readiness', state: info.ready ? 'ok' : info.started ? 'bad' : 'pending', note: info.ready ? 'siap' : info.started ? 'belum siap' : 'menunggu' },
    traffic,
  ];
}

function Lifecycle({ info }: Readonly<{ info: InfoData | null }>) {
  const stages: Stage[] = info
    ? stagesOf(info)
    : ['Start', 'Liveness', 'Readiness', 'Traffic'].map((name) => ({ name, state: 'pending', note: '' }));
  return (
    <ol className="lifecycle" aria-label="Siklus pod">
      {stages.map((st) => (
        <li key={st.name} className={`stage ${st.state}`}>
          <span className="stage-name">
            <span className="stage-dot" aria-hidden="true" />
            {st.name}
          </span>
          <span className="stage-note">{info ? st.note : <Skel w={12} />}</span>
        </li>
      ))}
    </ol>
  );
}

const BEHAVIOR_LABELS: ReadonlyArray<[keyof InfoData['behavior'], string, string]> = [
  ['bootFail', 'BOOT_FAIL', ''],
  ['startupDelaySeconds', 'STARTUP_DELAY_SECONDS', 'dtk'],
  ['crashAfterSeconds', 'CRASH_AFTER_SECONDS', 'dtk'],
  ['errorRate', 'ERROR_RATE', '%'],
  ['latencyMs', 'LATENCY_MS', 'ms'],
  ['leakMbPerMinute', 'LEAK_MB_PER_MINUTE', 'MB/menit'],
];

interface OverviewProps {
  info: InfoData | null;
  reachable: boolean;
  updatedAt: number | null;
  lastOkAt: number | null;
  onRetry: () => void;
  active: boolean;
}

export default function Overview({ info, reachable, updatedAt, lastOkAt, onRetry, active }: Readonly<OverviewProps>) {
  const loading = !info;
  const dash = <span className="muted">—</span>;
  const val = (x: string | null | undefined, w = 12) => (loading ? <Skel w={w} /> : x ? x : dash);
  const missing = (x: string | null | undefined, w = 12) =>
    loading ? <Skel w={w} /> : x ? x : <span className="muted">tidak tersedia</span>;
  const lacksIdentity = info ? !info.namespace || !info.nodeName || !info.podIp : false;
  const dep = info?.dependency;
  const failed = updatedAt !== null && !reachable;

  return (
    <div className="stack" style={{ gap: 24 }}>
      {failed && (
        <div className="block-error" role="alert">
          <span>
            Tidak bisa menghubungi <code>/api/info</code>.{' '}
            {lastOkAt ? `Nilai di bawah adalah data terakhir yang berhasil (pukul ${new Date(lastOkAt).toLocaleTimeString('id-ID', { hour12: false })}).` : 'Belum ada data yang berhasil dimuat.'}
          </span>
          <button type="button" className="btn sm" onClick={onRetry}>
            Coba lagi
          </button>
        </div>
      )}

      <Lifecycle info={info} />

      <dl className="kpis" aria-label="Ringkasan instance">
        <Kpi label="Versi">{loading ? <Skel w={7} /> : info.appVersion}</Kpi>
        <Kpi label="Uptime">{loading ? <Skel w={7} /> : fmtUptime(info.uptimeSeconds)}</Kpi>
        <Kpi label="Memori (RSS)" unit={loading ? undefined : 'MB'}>
          {loading ? <Skel w={5} /> : info.rssMb}
        </Kpi>
        <Kpi label="Node.js">{loading ? <Skel w={8} /> : info.nodeVersion}</Kpi>
      </dl>

      <div className="cols">
        <div className="stack">
          <section className="panel" aria-labelledby="h-identitas">
            <h2 id="h-identitas">Identitas workload</h2>
            <dl className="dl">
              <Row label="Pod" mono>
                <Copyable text={info?.podName ?? info?.hostname}>{val(info?.podName ?? info?.hostname, 18)}</Copyable>
              </Row>
              <Row label="Namespace">{missing(info?.namespace)}</Row>
              <Row label="Node" mono={Boolean(info?.nodeName)}>
                {missing(info?.nodeName)}
              </Row>
              <Row label="IP pod" mono={Boolean(info?.podIp)}>
                <Copyable text={info?.podIp}>{missing(info?.podIp, 14)}</Copyable>
              </Row>
            </dl>
            {lacksIdentity && (
              <p className="panel-note">
                “Tidak tersedia” berarti platform tidak menyuntikkan <code>POD_NAMESPACE</code>, <code>NODE_NAME</code>, atau <code>POD_IP</code>. Nama pod dan IP
                diambil dari hostname dan antarmuka jaringan; nama node hanya bisa lewat downward API (lihat <code>k8s/app.yaml</code>).
              </p>
            )}
          </section>

          <section className="panel" aria-labelledby="h-probe">
            <h2 id="h-probe">Probe</h2>
            <dl className="dl">
              <ProbeRow name="Liveness" path="/api/healthz" active={active} />
              <ProbeRow name="Readiness" path="/api/readyz" active={active} />
              <ProbeRow name="Startup" path="/api/startupz" active={active} />
            </dl>
          </section>
        </div>

        <div className="stack">
          <section className="panel" aria-labelledby="h-dep">
            <h2 id="h-dep">Dependency dan upstream</h2>
            <dl className="dl">
              <Row label="DEPENDENCY_URL">
                {loading ? (
                  <Skel w={8} />
                ) : dep?.configured ? (
                  <span className={`pill ${dep.ok ? 'ok' : 'err'}`}>{dep.ok ? 'Sehat' : `Gagal (${dep.status ?? dep.error ?? 'ERR'})`}</span>
                ) : (
                  <span className="muted">tidak diset</span>
                )}
              </Row>
              <Row label="UPSTREAM_URL">
                {loading ? <Skel w={10} /> : info.upstreamConfigured ? 'dikonfigurasi' : <span className="muted">tidak diset</span>}
              </Row>
            </dl>
          </section>

          <section className="panel" aria-labelledby="h-perilaku">
            <h2 id="h-perilaku">Perilaku aktif (env Deployment)</h2>
            <dl className="dl">
              {BEHAVIOR_LABELS.map(([key, name, unit]) => {
                const value = info?.behavior[key];
                const on = value !== undefined && value !== 0 && value !== false;
                let shown: ReactNode = <Skel w={6} />;
                if (value !== undefined) shown = typeof value === 'number' ? `${value} ${unit}`.trim() : String(value);
                return (
                  <Row key={key} label={name}>
                    {on ? <span className="pill warn">{shown}</span> : <span className="muted">{shown}</span>}
                  </Row>
                );
              })}
            </dl>
            <p className="panel-note">
              {info && !BEHAVIOR_LABELS.some(([k]) => info.behavior[k] !== 0 && info.behavior[k] !== false)
                ? 'Semua nol: workload berjalan sehat. Ubah env di Deployment untuk memerankan skenario rollout.'
                : 'Nilai selain nol berarti workload sengaja dibuat bermasalah untuk skenario uji.'}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
