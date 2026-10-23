'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon, type IconName } from '../shell/Icons';
import Shell from '../shell/Shell';
import type { InfoData } from './api';
import { usePoll } from './hooks';
import Overview from './Overview';

// Tampilan selain Ringkasan dimuat saat pertama dibuka, jadi kunjungan ke "/" tidak mengunduh kode Chaos, Database, dan katalog.
const Catalog = dynamic(() => import('./Catalog'));
const Chaos = dynamic(() => import('./Chaos'));
const Database = dynamic(() => import('./Database'));

type ViewId = 'overview' | 'catalog' | 'chaos' | 'database';

const VIEWS: ReadonlyArray<{ id: ViewId; label: string; icon: IconName; sub: string }> = [
  { id: 'overview', label: 'Ringkasan', icon: 'overview', sub: '' },
  { id: 'catalog', label: 'Skenario & endpoint', icon: 'catalog', sub: 'Cari endpoint, jalankan, dan lihat hasilnya langsung.' },
  { id: 'chaos', label: 'Fault injection', icon: 'chaos', sub: 'Picu gangguan saat runtime tanpa redeploy, lalu pulihkan.' },
  { id: 'database', label: 'Database', icon: 'database', sub: 'Hubungkan ke PostgreSQL atau MySQL, buat tabel, dan isi data.' },
];

function viewFromHash(): ViewId {
  const id = window.location.hash.slice(1);
  return VIEWS.find((v) => v.id === id)?.id ?? 'overview';
}

function clock(ms: number | null): string {
  return ms === null ? '' : new Date(ms).toLocaleTimeString('id-ID', { hour12: false });
}

// Satu kalimat temuan untuk Ringkasan: hal terpenting dari data saat ini.
function finding(info: InfoData | null, reachable: boolean, lastOk: number | null): string {
  if (!info) return reachable ? 'Memuat identitas instance…' : 'Menghubungi instance…';
  if (!reachable) return `Instance tidak terjangkau. Data terakhir diambil pukul ${clock(lastOk)}.`;
  if (info.draining) return 'Pod sedang draining: readiness 503, tidak menerima traffic baru.';
  if (!info.started) return 'Pod belum selesai start: startup probe masih 503.';
  if (!info.healthy) return 'Liveness gagal: kubelet akan me-restart container ini.';
  if (!info.ready) return 'Pod belum ready: dikeluarkan dari Endpoints sampai kembali sehat.';
  return `Pod ${info.podName ?? info.hostname ?? '—'} sehat dan menerima traffic, versi ${info.appVersion}.`;
}

export default function Dashboard() {
  // Tampilan aktif disimpan di URL (#database) agar refresh dan link yang dibagikan membuka tampilan yang sama.
  // null = belum dibaca dari URL: panel disembunyikan dulu supaya tidak sempat memuat Ringkasan lalu pindah.
  const [view, setView] = useState<ViewId | null>(null);
  const [seen, setSeen] = useState<ReadonlySet<ViewId>>(new Set());

  useEffect(() => {
    const sync = () => setView(viewFromHash());
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  useEffect(() => {
    if (view) setSeen((prev) => (prev.has(view) ? prev : new Set(prev).add(view)));
  }, [view]);

  const select = (id: ViewId) => {
    setView(id);
    window.history.replaceState(null, '', `#${id}`);
    window.scrollTo({ top: 0 });
  };

  const { data: info, status, updatedAt, lastOkAt, refresh } = usePoll<InfoData>('/api/info', 5000, true);
  const reachable = status === 200;
  const current = VIEWS.find((v) => v.id === view) ?? VIEWS[0];
  const pod = info?.podName ?? info?.hostname ?? null;
  const online = reachable ? 'Online' : updatedAt === null ? 'sedang diperiksa' : 'tidak terjangkau';

  const scope = (
    <div className="scope-block" title="Pod yang sedang dilihat">
      <span className={`dot ${reachable ? 'ok' : updatedAt === null ? '' : 'err'}`} aria-hidden="true" />
      <div className="scope-text">
        <span className="scope-title mono">{pod ?? 'Instance'}</span>
        <span className="scope-sub">
          {info ? (info.namespace ?? 'namespace tidak tersedia') : 'Memeriksa…'}
          <span className="sr-only"> ({online})</span>
        </span>
      </div>
    </div>
  );

  const nav = (
    <nav aria-label="Tampilan dashboard" className="nav-list">
      {VIEWS.map((v) => (
        <a
          key={v.id}
          id={`nav-${v.id}`}
          href={`#${v.id}`}
          className="nav-item"
          aria-current={view === v.id ? 'page' : undefined}
          onClick={(e) => {
            e.preventDefault();
            select(v.id);
          }}
        >
          <Icon name={v.icon} />
          {v.label}
        </a>
      ))}
    </nav>
  );

  const footerNav = (
    <Link href="/docs" prefetch={false} className="nav-item">
      <Icon name="docs" />
      Dokumentasi
    </Link>
  );

  return (
    <Shell nav={nav} scope={scope} footerNav={footerNav} meta={info ? `Versi ${info.appVersion}` : undefined} title={current.label}>
      <main className="canvas">
        <div className="title-row">
          <div>
            <h1>{current.label}</h1>
            <p className="sub-line" aria-live="polite">
              {view === 'overview' || view === null ? finding(info, reachable, lastOkAt) : current.sub}
            </p>
          </div>
          <div className="title-status" role="status" aria-label="Status instance">
            <span className={`pill ${reachable ? 'ok' : updatedAt === null ? '' : 'err'}`}>
              {reachable ? 'Online' : updatedAt === null ? 'Memeriksa' : 'Tidak terjangkau'}
            </span>
            {info && reachable && view !== 'overview' && view !== null && (
              <>
                <span className={`pill ${info.ready ? 'ok' : 'err'}`}>{info.ready ? 'Ready' : 'Not ready'}</span>
                <span className={`pill ${info.healthy ? 'ok' : 'err'}`}>{info.healthy ? 'Healthy' : 'Unhealthy'}</span>
              </>
            )}
            {info?.draining && <span className="pill warn">Draining</span>}
            <button type="button" className="btn sm" onClick={() => void refresh()}>
              <Icon name="refresh" size={14} />
              Muat ulang
            </button>
            {updatedAt !== null && <span className="stamp">Diperbarui {clock(updatedAt)}</span>}
          </div>
        </div>

        <div id="panel-overview" hidden={view !== 'overview'}>
          {seen.has('overview') && (
            <Overview info={info} reachable={reachable} updatedAt={updatedAt} lastOkAt={lastOkAt} onRetry={() => void refresh()} active={view === 'overview'} />
          )}
        </div>
        <div id="panel-catalog" hidden={view !== 'catalog'}>
          {seen.has('catalog') && <Catalog />}
        </div>
        <div id="panel-chaos" hidden={view !== 'chaos'}>
          {seen.has('chaos') && <Chaos active={view === 'chaos'} podName={pod} />}
        </div>
        <div id="panel-database" hidden={view !== 'database'}>
          {seen.has('database') && <Database active={view === 'database'} />}
        </div>
      </main>
    </Shell>
  );
}
