'use client';

import { useState, type ReactNode } from 'react';
import { fmtBytes, clip, type Outcome } from './outcome';
import { statusClass, type CallResult } from './api';

export function StatusBadge({ status }: Readonly<{ status: number }>) {
  return <span className={`badge ${statusClass(status)}`}>{status === 0 ? 'ERR' : status}</span>;
}

export function CopyButton({ text, label = 'Copy' }: Readonly<{ text: string | (() => string); label?: string }>) {
  const [done, setDone] = useState(false);
  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(typeof text === 'function' ? text() : text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      setDone(false);
    }
  };
  return (
    <button type="button" className="btn sm" onClick={onClick}>
      {done ? 'Tersalin' : label}
    </button>
  );
}

// Hasil sebuah aksi, satu baris ringkas di dekat tombolnya; respons mentah bisa dibuka.
export function ResultNote({ outcome, raw = true }: Readonly<{ outcome: Outcome; raw?: boolean }>) {
  return (
    <div className={`result-note ${outcome.tone === 'ok' ? 'ok' : 'err'}`} role="status" aria-live="polite">
      <div className="row">
        <strong>{outcome.text}</strong>
        <span className="spacer" />
        <span className="muted">
          {outcome.label} · {outcome.res.ms} ms
        </span>
        <StatusBadge status={outcome.res.status} />
      </div>
      {raw && (
        <details>
          <summary>Respons mentah</summary>
          <pre className="out">{outcome.res.body || outcome.res.error || '(kosong)'}</pre>
        </details>
      )}
    </div>
  );
}

// Respons sebuah request: status, waktu, ukuran, header ringkas, dan body (dipotong agar halaman tetap ringan).
export function ResponseView({ res, request }: Readonly<{ res: CallResult; request?: ReactNode }>) {
  const [all, setAll] = useState(false);
  const shown = all ? { text: res.body, clipped: false } : clip(res.body);
  const bytes = new TextEncoder().encode(res.body).length;
  return (
    <div className="response" role="status" aria-live="polite">
      <div className="row">
        <StatusBadge status={res.status} />
        <span className="muted">
          {res.ms} ms · {fmtBytes(bytes)}
          {res.redirected ? ' · dialihkan' : ''}
        </span>
        {request}
        {res.error && <strong className="response-error">{res.error === 'aborted' ? 'Dibatalkan' : 'Tidak bisa menghubungi server aplikasi.'}</strong>}
      </div>
      {res.headers.length > 0 && (
        <details>
          <summary>Header respons ({res.headers.length})</summary>
          <dl className="hdrs">
            {res.headers.map(([k, v]) => (
              <div key={k}>
                <dt className="mono">{k}</dt>
                <dd className="mono">{v}</dd>
              </div>
            ))}
          </dl>
        </details>
      )}
      {res.body && (
        <>
          <pre className="out">{shown.text}</pre>
          {shown.clipped && (
            <button type="button" className="btn sm" onClick={() => setAll(true)}>
              Tampilkan semua ({fmtBytes(bytes)})
            </button>
          )}
        </>
      )}
      {!res.body && !res.error && <p className="muted">Body kosong.</p>}
    </div>
  );
}
