'use client';

import { useState } from 'react';
import { call, type CallResult } from './api';
import { usePoll } from './hooks';
import { StatusBadge } from './ui';

interface ChaosStatus {
  enabled: boolean;
  tokenConfigured: boolean;
  pod: string | null;
  ready: boolean;
  healthy: boolean;
  cpuWorkers: number;
  heldMb: number;
}

export default function Chaos({ active }: Readonly<{ active: boolean }>) {
  const { data, refresh } = usePoll<ChaosStatus>('/api/chaos', 4000, active);
  const [token, setToken] = useState('');
  const [pod, setPod] = useState('');
  const [seconds, setSeconds] = useState(30);
  const [workers, setWorkers] = useState(1);
  const [mb, setMb] = useState(100);
  const [confirmCrash, setConfirmCrash] = useState(false);
  const [last, setLast] = useState<{ label: string; res: CallResult } | null>(null);

  const fire = async (label: string, method: string, path: string) => {
    const sep = path.includes('?') ? '&' : '?';
    const target = pod.trim() ? `${path}${sep}pod=${encodeURIComponent(pod.trim())}` : path;
    const res = await call(method, target, { headers: { 'X-Chaos-Token': token } });
    setLast({ label, res });
    void refresh();
  };

  const blocked = !data?.enabled || !data.tokenConfigured;

  return (
    <div className="stack">
      {data && !data.enabled && (
        <div className="banner warn">
          Chaos nonaktif di pod ini. Set <code>ENABLE_CHAOS=true</code> dan <code>CHAOS_TOKEN</code> (Secret) di namespace tes.
        </div>
      )}
      {data?.enabled && !data.tokenConfigured && (
        <div className="banner err">
          <code>ENABLE_CHAOS=true</code> tetapi <code>CHAOS_TOKEN</code> belum di-set, semua aksi akan ditolak (403).
        </div>
      )}
      <p className="muted" style={{ maxWidth: '72ch' }}>
        Fault injection saat runtime, tanpa redeploy. Aksi di sini memengaruhi <strong>satu pod acak</strong> di belakang Service. Isi “Target pod” (nama
        pod ada di tab Ringkasan) untuk menarget pod tertentu; pod lain membalas 409, jadi ulangi sampai kena.
      </p>

      <div className="card stack">
        <div className="row">
          <label className="field-grow">
            Chaos token (hanya di memori browser)
            <input type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} />
          </label>
          <label className="field-grow">
            Target pod (opsional)
            <input value={pod} onChange={(e) => setPod(e.target.value)} placeholder={data?.pod ?? 'nama pod'} spellCheck={false} />
          </label>
        </div>
        {data && (
          <div className="row">
            <span className={`pill ${data.ready ? 'ok' : 'err'}`}>{data.ready ? 'Ready' : 'Not ready'}</span>
            <span className={`pill ${data.healthy ? 'ok' : 'err'}`}>{data.healthy ? 'Healthy' : 'Unhealthy'}</span>
            <span className="pill">CPU workers: {data.cpuWorkers}</span>
            <span className="pill">Memori ditahan: {data.heldMb} MB</span>
          </div>
        )}
      </div>

      <div className="grid quad">
        <div className="card stack">
          <h2>Probe</h2>
          <p className="sub">Toggle readiness (keluar dari endpoints) atau liveness (kubelet restart container).</p>
          <div className="row">
            <button type="button" className="btn" disabled={blocked} onClick={() => fire('toggle readiness', 'POST', '/api/chaos/notready')}>
              Toggle readiness
            </button>
            <button type="button" className="btn" disabled={blocked} onClick={() => fire('toggle liveness', 'POST', '/api/chaos/unhealthy')}>
              Toggle liveness
            </button>
          </div>
        </div>

        <div className="card stack">
          <h2>CPU</h2>
          <p className="sub">Busy loop di worker thread; probe tetap hidup. Untuk HPA dan CPU throttling.</p>
          <div className="row">
            <label className="field-grow">
              Durasi (dtk)
              <input type="number" min={1} max={120} value={seconds} onChange={(e) => setSeconds(Number(e.target.value) || 1)} />
            </label>
            <label className="field-grow">
              Worker (1-4)
              <input type="number" min={1} max={4} value={workers} onChange={(e) => setWorkers(Number(e.target.value) || 1)} />
            </label>
          </div>
          <button type="button" className="btn primary" disabled={blocked} onClick={() => fire('burn cpu', 'POST', `/api/chaos/cpu?seconds=${seconds}&workers=${workers}`)}>
            Bakar CPU
          </button>
        </div>

        <div className="card stack">
          <h2>Memori</h2>
          <p className="sub">Tahan memori sampai melewati limit untuk memicu OOMKilled.</p>
          <label>
            Jumlah (MB)
            <input type="number" min={1} max={512} value={mb} onChange={(e) => setMb(Number(e.target.value) || 1)} />
          </label>
          <div className="row">
            <button type="button" className="btn primary" disabled={blocked} onClick={() => fire('allocate memory', 'POST', `/api/chaos/mem?mb=${mb}`)}>
              Alokasi
            </button>
            <button type="button" className="btn" disabled={blocked} onClick={() => fire('release memory', 'DELETE', '/api/chaos/mem')}>
              Lepas
            </button>
          </div>
        </div>

        <div className="card stack">
          <h2>Crash</h2>
          <p className="sub">Proses exit 1 → tes restart policy dan CrashLoopBackOff.</p>
          {confirmCrash ? (
            <div className="row">
              <button
                type="button"
                className="btn danger"
                disabled={blocked}
                onClick={() => {
                  setConfirmCrash(false);
                  void fire('crash', 'POST', '/api/chaos/crash');
                }}
              >
                Ya, matikan pod
              </button>
              <button type="button" className="btn" onClick={() => setConfirmCrash(false)}>
                Batal
              </button>
            </div>
          ) : (
            <button type="button" className="btn danger" disabled={blocked} onClick={() => setConfirmCrash(true)}>
              Crash proses…
            </button>
          )}
        </div>
      </div>

      {last && (
        <div className="card stack" aria-live="polite">
          <div className="row">
            <h2>Hasil terakhir</h2>
            <span className="muted">{last.label}</span>
            <span className="spacer" />
            <StatusBadge status={last.res.status} />
          </div>
          <pre className="out">{last.res.body || last.res.error || '(kosong)'}</pre>
        </div>
      )}
    </div>
  );
}
