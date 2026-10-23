'use client';

import { useState } from 'react';
import { call } from './api';
import { usePoll, useRemembered } from './hooks';
import { summarize, type Outcome } from './outcome';
import { ResultNote } from './ui';

interface ChaosStatus {
  enabled: boolean;
  tokenConfigured: boolean;
  pod: string | null;
  ready: boolean;
  healthy: boolean;
  cpuWorkers: number;
  heldMb: number;
}

type Card = 'cpu' | 'probe' | 'mem' | 'crash' | 'restore';

export default function Chaos({ active, podName }: Readonly<{ active: boolean; podName: string | null }>) {
  const { data, refresh } = usePoll<ChaosStatus>('/api/chaos', 4000, active);
  // Hanya target pod yang diingat. Token tidak pernah disimpan.
  const [saved, setSaved] = useRemembered('chaos', { pod: '' });
  const [token, setToken] = useState('');
  const [seconds, setSeconds] = useState(30);
  const [workers, setWorkers] = useState(1);
  const [mb, setMb] = useState(100);
  const [confirmCrash, setConfirmCrash] = useState(false);
  const [busy, setBusy] = useState<Card | null>(null);
  const [results, setResults] = useState<Partial<Record<Card, Outcome>>>({});

  const target = saved.pod.trim();

  const send = async (method: string, path: string) => {
    const sep = path.includes('?') ? '&' : '?';
    const url = target ? `${path}${sep}pod=${encodeURIComponent(target)}` : path;
    return call(method, url, { headers: { 'X-Chaos-Token': token } });
  };

  const fire = async (card: Card, label: string, method: string, path: string, okText: string) => {
    setBusy(card);
    const res = await send(method, path);
    setResults((r) => ({ ...r, [card]: summarize(label, res, { token: 'Chaos token', ok: okText }) }));
    setBusy(null);
    void refresh();
  };

  // Mengembalikan semua gangguan yang sedang aktif: readiness, liveness, dan memori yang ditahan.
  const restoreAll = async () => {
    setBusy('restore');
    const steps: Array<[string, string, string]> = [];
    if (data && !data.ready) steps.push(['POST', '/api/chaos/notready', 'readiness']);
    if (data && !data.healthy) steps.push(['POST', '/api/chaos/unhealthy', 'liveness']);
    if (data && data.heldMb > 0) steps.push(['DELETE', '/api/chaos/mem', 'memori']);
    let last: Outcome | null = null;
    const done: string[] = [];
    for (const [method, path, name] of steps) {
      const res = await send(method, path);
      last = summarize('pulihkan semua', res, { token: 'Chaos token' });
      if (last.tone === 'err') break;
      done.push(name);
    }
    const final = last;
    if (final) setResults((r) => ({ ...r, restore: final.tone === 'ok' ? { ...final, text: `Dipulihkan: ${done.join(', ')}.` } : final }));
    setBusy(null);
    void refresh();
  };

  let why = '';
  if (!data) why = 'Memeriksa status chaos…';
  else if (!data.enabled) why = 'Chaos nonaktif di server.';
  else if (!data.tokenConfigured) why = 'CHAOS_TOKEN belum di-set di server.';
  else if (!token) why = 'Isi chaos token dulu.';
  const blocked = why !== '' || busy !== null;

  const effects: string[] = [];
  if (data && !data.ready) effects.push('Readiness dimatikan');
  if (data && !data.healthy) effects.push('Liveness dimatikan');
  if (data && data.cpuWorkers > 0) effects.push(`CPU: ${data.cpuWorkers} worker`);
  if (data && data.heldMb > 0) effects.push(`Memori ditahan: ${data.heldMb} MB`);
  const nothingToRestore = !data || (data.ready && data.healthy && data.heldMb === 0);

  const crashTarget = target || data?.pod || podName || 'ini';
  const ready = data?.ready ?? true;
  const healthy = data?.healthy ?? true;

  return (
    <div className="stack">
      {data && !data.enabled && (
        <div className="banner warn" role="status">
          Chaos nonaktif di pod ini. Set <code>ENABLE_CHAOS=true</code> dan <code>CHAOS_TOKEN</code> (Secret) di namespace tes.
        </div>
      )}
      {data?.enabled && !data.tokenConfigured && (
        <div className="banner err" role="status">
          <code>ENABLE_CHAOS=true</code> tetapi <code>CHAOS_TOKEN</code> belum di-set, semua aksi ditolak.
        </div>
      )}

      <section className="card stack" aria-labelledby="chaos-h-session">
        <div>
          <h2 id="chaos-h-session">Sesi chaos</h2>
          <p className="sub">
            Aksi memengaruhi <strong>satu pod acak</strong> di belakang Service. Isi target pod untuk menarget pod tertentu; pod lain membalas 409, jadi ulangi sampai kena.
          </p>
        </div>
        <div className="row">
          <label className="field-grow">
            Chaos token
            <input type="password" autoComplete="new-password" value={token} onChange={(e) => setToken(e.target.value)} aria-describedby="chaos-token-hint" />
            <span className="hint" id="chaos-token-hint">
              Hanya di memori browser, hilang saat halaman dimuat ulang.
            </span>
          </label>
          <label className="field-grow">
            Target pod (opsional)
            <input
              value={saved.pod}
              onChange={(e) => setSaved({ pod: e.target.value })}
              placeholder={data?.pod ?? podName ?? 'nama pod'}
              autoComplete="off"
              spellCheck={false}
            />
            <span className="hint">Nama pod ada di sidebar. Diingat di browser ini.</span>
          </label>
        </div>
        <div className="form-actions">
          <div className="chips" aria-label="Gangguan yang sedang aktif">
            {effects.length === 0 && data && <span className="muted">Tidak ada gangguan aktif.</span>}
            {effects.map((ef) => (
              <span key={ef} className="pill warn">
                {ef}
              </span>
            ))}
          </div>
          <span className="spacer" />
          <button type="button" className="btn" disabled={blocked || nothingToRestore} onClick={() => void restoreAll()}>
            {busy === 'restore' ? 'Memulihkan…' : 'Pulihkan semua'}
          </button>
        </div>
        {why && <p className="hint">{why}</p>}
        {results.restore && <ResultNote outcome={results.restore} raw={false} />}
      </section>

      <div className="cols top">
        <div className="stack">
          <section className="card stack" aria-labelledby="chaos-h-cpu">
            <div>
              <h2 id="chaos-h-cpu">CPU</h2>
              <p className="sub">Busy loop di worker thread; probe tetap hidup. Untuk HPA dan CPU throttling.</p>
            </div>
            <div className="row">
              <label className="field-grow">
                Durasi (detik)
                <input type="number" min={1} max={120} value={seconds} onChange={(e) => setSeconds(Number(e.target.value) || 1)} />
              </label>
              <label className="field-grow">
                Worker (1-4)
                <input type="number" min={1} max={4} value={workers} onChange={(e) => setWorkers(Number(e.target.value) || 1)} />
              </label>
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="btn"
                disabled={blocked}
                onClick={() => void fire('cpu', 'bakar CPU', 'POST', `/api/chaos/cpu?seconds=${seconds}&workers=${workers}`, `CPU dibakar ${workers} worker selama ${seconds} detik.`)}
              >
                {busy === 'cpu' ? 'Memulai…' : 'Bakar CPU'}
              </button>
            </div>
            {results.cpu && <ResultNote outcome={results.cpu} raw={false} />}
          </section>

          <section className="card stack" aria-labelledby="chaos-h-probe">
            <div>
              <h2 id="chaos-h-probe">Probe</h2>
              <p className="sub">Readiness: pod keluar dari Endpoints. Liveness: kubelet me-restart container.</p>
            </div>
            <div className="form-actions">
              <button
                type="button"
                className="btn"
                disabled={blocked}
                onClick={() =>
                  void fire('probe', ready ? 'matikan readiness' : 'pulihkan readiness', 'POST', '/api/chaos/notready', ready ? 'Readiness dimatikan: pod keluar dari Endpoints.' : 'Readiness dipulihkan.')
                }
              >
                {ready ? 'Matikan readiness' : 'Pulihkan readiness'}
              </button>
              <button
                type="button"
                className="btn"
                disabled={blocked}
                onClick={() =>
                  void fire('probe', healthy ? 'matikan liveness' : 'pulihkan liveness', 'POST', '/api/chaos/unhealthy', healthy ? 'Liveness dimatikan: kubelet akan me-restart container.' : 'Liveness dipulihkan.')
                }
              >
                {healthy ? 'Matikan liveness' : 'Pulihkan liveness'}
              </button>
            </div>
            {results.probe && <ResultNote outcome={results.probe} raw={false} />}
          </section>
        </div>

        <div className="stack">
          <section className="card stack" aria-labelledby="chaos-h-mem">
            <div>
              <h2 id="chaos-h-mem">Memori</h2>
              <p className="sub">Tahan memori sampai melewati limit untuk memicu OOMKilled.</p>
            </div>
            <label>
              Jumlah (MB)
              <input type="number" min={1} max={512} value={mb} onChange={(e) => setMb(Number(e.target.value) || 1)} />
            </label>
            <div className="form-actions">
              <button type="button" className="btn" disabled={blocked} onClick={() => void fire('mem', 'alokasi memori', 'POST', `/api/chaos/mem?mb=${mb}`, `${mb} MB ditahan.`)}>
                {busy === 'mem' ? 'Mengalokasi…' : 'Alokasi'}
              </button>
              <button
                type="button"
                className="btn"
                disabled={blocked || (data?.heldMb ?? 0) === 0}
                onClick={() => void fire('mem', 'lepas memori', 'DELETE', '/api/chaos/mem', 'Memori dilepas.')}
              >
                Lepas
              </button>
            </div>
            {results.mem && <ResultNote outcome={results.mem} raw={false} />}
          </section>

          <section className="card stack" aria-labelledby="chaos-h-crash">
            <div>
              <h2 id="chaos-h-crash">Crash</h2>
              <p className="sub">Proses exit 1, untuk tes restart policy dan CrashLoopBackOff.</p>
            </div>
            {confirmCrash ? (
              <div className="form-actions">
                <button
                  type="button"
                  className="btn danger"
                  disabled={blocked}
                  onClick={() => {
                    setConfirmCrash(false);
                    void fire('crash', 'crash', 'POST', '/api/chaos/crash', 'Proses dimatikan; pod akan di-restart.');
                  }}
                >
                  Ya, matikan pod {crashTarget}
                </button>
                <button type="button" className="btn" onClick={() => setConfirmCrash(false)}>
                  Batal
                </button>
              </div>
            ) : (
              <div className="form-actions">
                <button type="button" className="btn danger" disabled={blocked} onClick={() => setConfirmCrash(true)}>
                  Crash proses…
                </button>
              </div>
            )}
            {results.crash && <ResultNote outcome={results.crash} raw={false} />}
          </section>
        </div>
      </div>
    </div>
  );
}
