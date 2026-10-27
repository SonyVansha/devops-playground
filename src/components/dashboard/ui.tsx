'use client';

import { useState } from 'react';
import { useT } from '../../i18n/client';
import { statusClass, type CallResult } from './api';
import { clip, fmtBytes, prettyBody, statusLine, transcript, type Outcome } from './outcome';

export function StatusBadge({ status }: Readonly<{ status: number }>) {
  return <span className={`badge ${statusClass(status)}`}>{status === 0 ? 'ERR' : status}</span>;
}

export function CopyButton({ text, label }: Readonly<{ text: string | (() => string); label?: string }>) {
  const t = useT();
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
      {done ? t('common.copied') : (label ?? t('common.copy'))}
    </button>
  );
}

// Hasil sebuah aksi, satu baris ringkas di dekat tombolnya; respons mentah bisa dibuka.
export function ResultNote({ outcome, raw = true }: Readonly<{ outcome: Outcome; raw?: boolean }>) {
  const t = useT();
  return (
    <div className={`result-note ${outcome.tone === 'ok' ? 'ok' : 'err'}`} role="status" aria-live="polite">
      <div className="row">
        <strong>{outcome.text}</strong>
        <span className="spacer" />
        <span className="muted">
          {outcome.label}, {outcome.res.ms} ms
        </span>
        <StatusBadge status={outcome.res.status} />
      </div>
      {raw && (
        <details>
          <summary>{t('res.raw')}</summary>
          <pre className="out">{outcome.res.body || outcome.res.error || t('res.empty')}</pre>
        </details>
      )}
    </div>
  );
}

// Respons sebuah request sebagai transkrip terminal: perintah, status, header, lalu body (dipotong agar halaman tetap ringan).
export function ResponseView({ res, method, path }: Readonly<{ res: CallResult; method?: string; path?: string }>) {
  const t = useT();
  const [all, setAll] = useState(false);
  const pretty = prettyBody(res.body);
  const shown = all ? { text: pretty, clipped: false } : clip(pretty);
  const bytes = new TextEncoder().encode(res.body).length;
  const failed = res.status === 0;
  return (
    <div className="response" role="status" aria-live="polite">
      <pre className="term" tabIndex={0} aria-label={t('res.aria')}>
        {method && path && (
          <span className="term-line term-cmd">
            $ {method} {path}
          </span>
        )}
        <span className={`term-line term-status ${statusClass(res.status)}`}>
          {statusLine(res.status, t)}
          <span className="term-meta">
            {'  '}
            {res.ms} ms{failed ? '' : `, ${fmtBytes(bytes)}`}
            {res.redirected ? `, ${t('res.redirected')}` : ''}
          </span>
        </span>
        {failed && <span className="term-line term-hdr">{res.error === 'aborted' ? t('res.aborted') : t('res.noServer.l')}</span>}
        {res.headers.map(([k, v]) => (
          <span key={k} className="term-line term-hdr">
            {k}: {v}
          </span>
        ))}
        {res.body && <span className="term-line term-gap" />}
        {res.body && <span className="term-line term-body">{shown.text}</span>}
      </pre>
      <div className="row">
        {shown.clipped && (
          <button type="button" className="btn sm" onClick={() => setAll(true)}>
            {t('res.showAll', { size: fmtBytes(bytes) })}
          </button>
        )}
        <CopyButton label={t('res.copy')} text={() => transcript({ ...res, body: pretty }, t, method, path)} />
      </div>
    </div>
  );
}
