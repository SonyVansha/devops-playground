'use client';

import { useState } from 'react';
import { useI18n } from '../../i18n/client';
import Rich from '../Rich';
import { call } from './api';
import type { Sample } from './history';
import { usePoll, useRemembered } from './hooks';
import { summarize, type Outcome } from './outcome';
import Pulse, { CHAOS_ROWS } from './Pulse';
import type { Status } from './status';
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

interface ChaosProps {
  active: boolean;
  podName: string | null;
  samples: readonly Sample[];
  status: Status;
  /** Dipanggil setelah sebuah aksi, agar pita langsung membaca keadaan baru tanpa menunggu polling berikutnya. */
  onChange: () => void;
}

export default function Chaos({ active, podName, samples, status, onChange }: Readonly<ChaosProps>) {
  const { t } = useI18n();
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
  const tokenName = 'Chaos token';

  const send = async (method: string, path: string) => {
    const sep = path.includes('?') ? '&' : '?';
    const url = target ? `${path}${sep}pod=${encodeURIComponent(target)}` : path;
    return call(method, url, { headers: { 'X-Chaos-Token': token } });
  };

  const fire = async (card: Card, label: string, method: string, path: string, okText: string) => {
    setBusy(card);
    const res = await send(method, path);
    setResults((r) => ({ ...r, [card]: summarize(label, res, t, { token: tokenName, ok: okText }) }));
    setBusy(null);
    void refresh();
    onChange();
  };

  // Mengembalikan semua gangguan yang sedang aktif: readiness, liveness, dan memori yang ditahan.
  const restoreAll = async () => {
    setBusy('restore');
    const steps: Array<[string, string, string]> = [];
    if (data && !data.ready) steps.push(['POST', '/api/chaos/notready', t('chaos.n.ready')]);
    if (data && !data.healthy) steps.push(['POST', '/api/chaos/unhealthy', t('chaos.n.live')]);
    if (data && data.heldMb > 0) steps.push(['DELETE', '/api/chaos/mem', t('chaos.n.mem')]);
    let last: Outcome | null = null;
    const done: string[] = [];
    for (const [method, path, name] of steps) {
      const res = await send(method, path);
      last = summarize(t('chaos.l.restore'), res, t, { token: tokenName });
      if (last.tone === 'err') break;
      done.push(name);
    }
    const final = last;
    if (final) setResults((r) => ({ ...r, restore: final.tone === 'ok' ? { ...final, text: t('chaos.restored', { list: done.join(', ') }) } : final }));
    setBusy(null);
    void refresh();
    onChange();
  };

  let why = '';
  if (!data) why = t('chaos.why.checking');
  else if (!data.enabled) why = t('chaos.why.disabled');
  else if (!data.tokenConfigured) why = t('chaos.why.noToken');
  else if (!token) why = t('chaos.why.enterToken');
  const blocked = why !== '' || busy !== null;

  const effects: string[] = [];
  if (data && !data.ready) effects.push(t('chaos.fx.ready'));
  if (data && !data.healthy) effects.push(t('chaos.fx.live'));
  if (data && data.cpuWorkers > 0) effects.push(t(data.cpuWorkers === 1 ? 'chaos.fx.cpu.1' : 'chaos.fx.cpu', { n: data.cpuWorkers }));
  if (data && data.heldMb > 0) effects.push(t('chaos.fx.mem', { mb: data.heldMb }));
  const nothingToRestore = !data || (data.ready && data.healthy && data.heldMb === 0);

  const crashTarget = target || data?.pod || podName || t('chaos.crashThis');
  const ready = data?.ready ?? true;
  const healthy = data?.healthy ?? true;

  return (
    <div className="stack">
      {data && !data.enabled && (
        <div className="banner warn" role="status">
          <Rich text={t('chaos.off')} />
        </div>
      )}
      {data?.enabled && !data.tokenConfigured && (
        <div className="banner err" role="status">
          <Rich text={t('chaos.noToken')} />
        </div>
      )}

      <div className="chaos-layout">
        <div className="stack">
          <section className="card stack" aria-labelledby="chaos-h-session">
            <div>
              <h2 id="chaos-h-session">{t('chaos.session')}</h2>
              <p className="sub">
                <Rich text={t('chaos.sessionSub')} />
              </p>
            </div>
            <div className="row">
              <label className="field-grow">
                {t('chaos.token')}
                <input type="password" autoComplete="new-password" value={token} onChange={(e) => setToken(e.target.value)} aria-describedby="chaos-token-hint" />
                <span className="hint" id="chaos-token-hint">
                  {t('chaos.tokenHint')}
                </span>
              </label>
              <label className="field-grow">
                {t('chaos.target')}
                <input
                  value={saved.pod}
                  onChange={(e) => setSaved({ pod: e.target.value })}
                  placeholder={data?.pod ?? podName ?? t('chaos.targetPh')}
                  autoComplete="off"
                  spellCheck={false}
                />
                <span className="hint">{t('chaos.targetHint')}</span>
              </label>
            </div>
            {why && (
              <p className="hint" role="status">
                {t('chaos.disabledLine', { why })}
              </p>
            )}
            <div className="form-actions">
              <div className="chips" aria-label={t('chaos.activeAria')}>
                {effects.length === 0 && data && <span className="muted">{t('chaos.none')}</span>}
                {effects.map((ef) => (
                  <span key={ef} className="pill warn">
                    {ef}
                  </span>
                ))}
              </div>
              <span className="spacer" />
              <button type="button" className="btn" disabled={blocked || nothingToRestore} onClick={() => void restoreAll()}>
                {busy === 'restore' ? t('chaos.restoring') : t('chaos.restoreAll')}
              </button>
            </div>
            {results.restore && <ResultNote outcome={results.restore} raw={false} />}
          </section>

          <div className="cols top">
            <div className="stack">
              <section className="card stack" aria-labelledby="chaos-h-cpu">
                <div>
                  <h2 id="chaos-h-cpu">{t('chaos.cpu')}</h2>
                  <p className="sub">{t('chaos.cpuSub')}</p>
                </div>
                <div className="row">
                  <label className="field-grow">
                    {t('chaos.duration')}
                    <input type="number" min={1} max={120} value={seconds} onChange={(e) => setSeconds(Number(e.target.value) || 1)} />
                  </label>
                  <label className="field-grow">
                    {t('chaos.workers')}
                    <input type="number" min={1} max={4} value={workers} onChange={(e) => setWorkers(Number(e.target.value) || 1)} />
                  </label>
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn"
                    disabled={blocked}
                    onClick={() => void fire('cpu', t('chaos.l.cpu'), 'POST', `/api/chaos/cpu?seconds=${seconds}&workers=${workers}`, t(workers === 1 ? 'chaos.ok.cpu.1' : 'chaos.ok.cpu', { workers, seconds }))}
                  >
                    {busy === 'cpu' ? t('chaos.starting') : t('chaos.burn')}
                  </button>
                </div>
                {results.cpu && <ResultNote outcome={results.cpu} raw={false} />}
              </section>

              <section className="card stack" aria-labelledby="chaos-h-probe">
                <div>
                  <h2 id="chaos-h-probe">{t('chaos.probe')}</h2>
                  <p className="sub">{t('chaos.probeSub')}</p>
                </div>
                <div className="form-actions">
                  <button
                    type="button"
                    className="btn"
                    disabled={blocked}
                    onClick={() =>
                      void fire(
                        'probe',
                        ready ? t('chaos.l.readyOff') : t('chaos.l.readyOn'),
                        'POST',
                        '/api/chaos/notready',
                        ready ? t('chaos.ok.readyOff') : t('chaos.ok.readyOn'),
                      )
                    }
                  >
                    {ready ? t('chaos.readyOff') : t('chaos.readyOn')}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={blocked}
                    onClick={() =>
                      void fire(
                        'probe',
                        healthy ? t('chaos.l.liveOff') : t('chaos.l.liveOn'),
                        'POST',
                        '/api/chaos/unhealthy',
                        healthy ? t('chaos.ok.liveOff') : t('chaos.ok.liveOn'),
                      )
                    }
                  >
                    {healthy ? t('chaos.liveOff') : t('chaos.liveOn')}
                  </button>
                </div>
                {results.probe && <ResultNote outcome={results.probe} raw={false} />}
              </section>
            </div>

            <div className="stack">
              <section className="card stack" aria-labelledby="chaos-h-mem">
                <div>
                  <h2 id="chaos-h-mem">{t('chaos.mem')}</h2>
                  <p className="sub">{t('chaos.memSub')}</p>
                </div>
                <label>
                  {t('chaos.amount')}
                  <input type="number" min={1} max={512} value={mb} onChange={(e) => setMb(Number(e.target.value) || 1)} />
                </label>
                <div className="form-actions">
                  <button type="button" className="btn" disabled={blocked} onClick={() => void fire('mem', t('chaos.l.alloc'), 'POST', `/api/chaos/mem?mb=${mb}`, t('chaos.ok.alloc', { mb }))}>
                    {busy === 'mem' ? t('chaos.allocating') : t('chaos.allocate')}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={blocked || (data?.heldMb ?? 0) === 0}
                    onClick={() => void fire('mem', t('chaos.l.release'), 'DELETE', '/api/chaos/mem', t('chaos.ok.release'))}
                  >
                    {t('chaos.release')}
                  </button>
                </div>
                {results.mem && <ResultNote outcome={results.mem} raw={false} />}
              </section>

              <section className="card stack" aria-labelledby="chaos-h-crash">
                <div>
                  <h2 id="chaos-h-crash">{t('chaos.crash')}</h2>
                  <p className="sub">{t('chaos.crashSub')}</p>
                </div>
                {confirmCrash ? (
                  <div className="form-actions">
                    <button
                      type="button"
                      className="btn danger"
                      disabled={blocked}
                      onClick={() => {
                        setConfirmCrash(false);
                        void fire('crash', t('chaos.l.crash'), 'POST', '/api/chaos/crash', t('chaos.ok.crash'));
                      }}
                    >
                      {t('chaos.crashConfirm', { pod: crashTarget })}
                    </button>
                    <button type="button" className="btn" onClick={() => setConfirmCrash(false)}>
                      {t('common.cancel')}
                    </button>
                  </div>
                ) : (
                  <div className="form-actions">
                    <button type="button" className="btn danger" disabled={blocked} onClick={() => setConfirmCrash(true)}>
                      {t('chaos.crashBtn')}
                    </button>
                  </div>
                )}
                {results.crash && <ResultNote outcome={results.crash} raw={false} />}
              </section>
            </div>
          </div>
        </div>

        <aside className="chaos-side" aria-label={t('chaos.sideAria')}>
          <Pulse samples={samples} status={status} rows={CHAOS_ROWS} variant="side" title={t('chaos.sideTitle')} />
        </aside>
      </div>
    </div>
  );
}
