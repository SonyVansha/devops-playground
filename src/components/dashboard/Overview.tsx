'use client';

import { fmtUptime, type InfoData } from './api';
import { usePoll } from './hooks';

function Row({ label, children, mono }: Readonly<{ label: string; children: React.ReactNode; mono?: boolean }>) {
  return (
    <div className="dl-row">
      <dt>{label}</dt>
      <dd className={mono ? 'mono' : undefined}>{children}</dd>
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
      <span className="row" style={{ justifyContent: 'space-between' }}>
        <code>{path}</code>
        <span className={cls}>{text}</span>
      </span>
    </Row>
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

export default function Overview({ info, active }: Readonly<{ info: InfoData | null; active: boolean }>) {
  const v = (x: string | null | undefined) => x ?? '—';
  const missing = (x: string | null | undefined) => (info && !x ? <span className="muted">tidak tersedia</span> : v(x));
  const lacksIdentity = info ? !info.namespace || !info.nodeName || !info.podIp : false;
  const dep = info?.dependency;
  const anyBehavior = info ? BEHAVIOR_LABELS.some(([k]) => info.behavior[k] !== 0 && info.behavior[k] !== false) : false;

  return (
    <div className="stack" style={{ gap: 24 }}>
      <div className="cols">
        <section className="panel" aria-labelledby="h-identitas">
          <h2 id="h-identitas">Identitas workload</h2>
          <dl className="dl">
            <Row label="Versi">{v(info?.appVersion)}</Row>
            <Row label="Pod" mono>
              {v(info?.podName ?? info?.hostname)}
            </Row>
            <Row label="Namespace">{missing(info?.namespace)}</Row>
            <Row label="Node" mono>
              {missing(info?.nodeName)}
            </Row>
            <Row label="IP pod" mono>
              {missing(info?.podIp)}
            </Row>
            <Row label="Node.js">{v(info?.nodeVersion)}</Row>
            <Row label="Uptime">{info ? fmtUptime(info.uptimeSeconds) : '—'}</Row>
            <Row label="Memori (RSS)">{info ? `${info.rssMb} MB` : '—'}</Row>
          </dl>
          {lacksIdentity && (
            <p className="sub" style={{ margin: 0, padding: '10px 16px 12px', borderTop: '1px solid var(--line)', color: 'var(--muted)', fontSize: 13 }}>
              “Tidak tersedia” berarti platform tidak menyuntikkan env <code>POD_NAMESPACE</code>, <code>NODE_NAME</code>, atau <code>POD_IP</code>. Nama pod dan IP
              diambil otomatis dari hostname dan antarmuka jaringan; nama node hanya bisa lewat downward API (lihat <code>k8s/app.yaml</code>).
            </p>
          )}
        </section>

        <div className="stack">
          <section className="panel" aria-labelledby="h-probe">
            <h2 id="h-probe">Probe</h2>
            <dl className="dl">
              <ProbeRow name="Liveness" path="/api/healthz" active={active} />
              <ProbeRow name="Readiness" path="/api/readyz" active={active} />
              <ProbeRow name="Startup" path="/api/startupz" active={active} />
            </dl>
          </section>

          <section className="panel" aria-labelledby="h-dep">
            <h2 id="h-dep">Dependency & upstream</h2>
            <dl className="dl">
              <Row label="DEPENDENCY_URL">
                {!info ? (
                  '—'
                ) : dep?.configured ? (
                  <span className={`pill ${dep.ok ? 'ok' : 'err'}`}>
                    {dep.ok ? 'Sehat' : `Gagal (${dep.status ?? dep.error ?? 'ERR'})`}
                  </span>
                ) : (
                  <span className="muted">tidak diset</span>
                )}
              </Row>
              <Row label="UPSTREAM_URL">
                {!info ? '—' : info.upstreamConfigured ? 'dikonfigurasi' : <span className="muted">tidak diset</span>}
              </Row>
            </dl>
          </section>
        </div>
      </div>

      <section className="panel" aria-labelledby="h-perilaku">
        <h2 id="h-perilaku">Perilaku aktif (dari env Deployment)</h2>
        <dl className="dl">
          {BEHAVIOR_LABELS.map(([key, name, unit]) => {
            const value = info?.behavior[key];
            const on = value !== undefined && value !== 0 && value !== false;
            let shown = '—';
            if (value !== undefined) shown = typeof value === 'number' ? `${value} ${unit}`.trim() : String(value);
            return (
              <Row key={key} label={name}>
                {on ? <span className="pill warn">{shown}</span> : <span className="muted">{shown}</span>}
              </Row>
            );
          })}
        </dl>
        <p className="sub" style={{ margin: 0, padding: '10px 16px 12px', borderTop: '1px solid var(--line)', color: 'var(--muted)', fontSize: 13 }}>
          {info && !anyBehavior
            ? 'Semua nol: workload berjalan sehat. Ubah env di Deployment untuk memerankan skenario rollout.'
            : 'Nilai selain nol berarti workload sengaja dibuat bermasalah untuk skenario uji.'}
        </p>
      </section>
    </div>
  );
}
