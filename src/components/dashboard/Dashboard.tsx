'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n/client';
import type { MsgKey } from '../../i18n/en';
import { Icon, type IconName } from '../shell/Icons';
import Shell from '../shell/Shell';
import type { InfoData } from './api';
import { pushSample, type Sample } from './history';
import { usePoll } from './hooks';
import Overview from './Overview';
import { clock, describe } from './status';

// Tampilan selain Ringkasan dimuat saat pertama dibuka, jadi kunjungan ke "/" tidak mengunduh kode Chaos, Database, dan katalog.
const Catalog = dynamic(() => import('./Catalog'));
const Chaos = dynamic(() => import('./Chaos'));
const Database = dynamic(() => import('./Database'));

type ViewId = 'overview' | 'catalog' | 'chaos' | 'database';

const VIEWS: ReadonlyArray<{ id: ViewId; label: MsgKey; icon: IconName; sub: MsgKey | null }> = [
  { id: 'overview', label: 'view.overview', icon: 'overview', sub: null },
  { id: 'catalog', label: 'view.catalog', icon: 'catalog', sub: 'view.catalog.sub' },
  { id: 'chaos', label: 'view.chaos', icon: 'chaos', sub: 'view.chaos.sub' },
  { id: 'database', label: 'view.database', icon: 'database', sub: 'view.database.sub' },
];

function viewFromHash(): ViewId {
  const id = window.location.hash.slice(1);
  return VIEWS.find((v) => v.id === id)?.id ?? 'overview';
}

function sampleOf(t: number, info: InfoData | null, up: boolean): Sample {
  return {
    t,
    up,
    started: info?.started ?? false,
    healthy: info?.healthy ?? false,
    ready: info?.ready ?? false,
    draining: info?.draining ?? false,
    uptime: info?.uptimeSeconds ?? 0,
    cpu: info?.load?.cpuWorkers ?? 0,
    held: info?.load?.heldMb ?? 0,
  };
}

export default function Dashboard({ initialInfo }: Readonly<{ initialInfo: InfoData }>) {
  const { t, locale } = useI18n();

  // Tampilan aktif disimpan di URL (#database) agar refresh dan link yang dibagikan membuka tampilan yang sama.
  // Cetakan pertama selalu Ringkasan (server tidak tahu #hash); skrip kecil di <head> menyembunyikannya bila URL menuju tampilan lain.
  const [view, setView] = useState<ViewId>('overview');
  const [seen, setSeen] = useState<ReadonlySet<ViewId>>(new Set<ViewId>(['overview']));

  useEffect(() => {
    const sync = () => setView(viewFromHash());
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  useEffect(() => {
    setSeen((prev) => (prev.has(view) ? prev : new Set(prev).add(view)));
    document.documentElement.dataset.view = view; // dipakai CSS agar Ringkasan tidak sempat terlihat saat membuka #database dst.
  }, [view]);

  const select = (id: ViewId) => {
    setView(id);
    window.history.replaceState(null, '', `#${id}`);
    window.scrollTo({ top: 0 });
  };

  const { data: info, status, updatedAt, lastOkAt, refresh } = usePoll<InfoData>('/api/info', 5000, true, { data: initialInfo, at: Date.parse(initialInfo.time) });
  const reachable = status === 200;

  // Setiap polling selesai menambah satu pembacaan ke pita detak (5 menit terakhir, hanya di memori halaman).
  const [samples, setSamples] = useState<readonly Sample[]>(() => [sampleOf(Date.parse(initialInfo.time), initialInfo, true)]);
  useEffect(() => {
    if (updatedAt === null) return;
    setSamples((prev) => pushSample(prev, sampleOf(updatedAt, info, status === 200)));
    // hanya bereaksi pada pembacaan baru
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updatedAt]);

  const current = VIEWS.find((v) => v.id === view) ?? VIEWS[0];
  const pod = info?.podName ?? info?.hostname ?? null;
  const online = reachable ? t('scope.sr.online') : updatedAt === null ? t('scope.sr.checking') : t('scope.sr.offline');
  const state = reachable ? 'ok' : updatedAt === null ? '' : 'err';

  const scope = (
    <div className="scope-block" title={t('scope.hint')}>
      <span className={`dot ${state}`} aria-hidden="true" />
      <div className="scope-text">
        <span className="scope-title mono">{pod ?? t('scope.instance')}</span>
        <span className="scope-sub">
          {info ? (info.namespace ?? t('scope.noNamespace')) : t('scope.checking')}
          <span className="sr-only"> ({online})</span>
        </span>
      </div>
    </div>
  );

  const nav = (
    <nav aria-label={t('nav.label')} className="nav-list">
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
          {t(v.label)}
        </a>
      ))}
    </nav>
  );

  const footerNav = (
    <Link href="/docs" prefetch={false} className="nav-item">
      <Icon name="docs" />
      {t('nav.docs')}
    </Link>
  );

  return (
    <Shell nav={nav} scope={scope} footerNav={footerNav} meta={info ? t('nav.version', { v: info.appVersion }) : undefined} title={t(current.label)}>
      <main className="canvas">
        <div className="title-row">
          <div>
            <h1>{t(current.label)}</h1>
            <p className="sub-line" aria-live="polite">
              {view === 'overview' ? '' : current.sub ? t(current.sub) : ''}
            </p>
          </div>
          <div className="title-status" role="status" aria-label={t('head.status')}>
            <span className={`pill ${state}`}>{reachable ? t('pill.online') : updatedAt === null ? t('pill.checking') : t('pill.unreachable')}</span>
            {info && reachable && view !== 'overview' && (
              <>
                <span className={`pill ${info.ready ? 'ok' : 'err'}`}>{info.ready ? t('pill.ready') : t('pill.notReady')}</span>
                <span className={`pill ${info.healthy ? 'ok' : 'err'}`}>{info.healthy ? t('pill.healthy') : t('pill.unhealthy')}</span>
              </>
            )}
            {info?.draining && <span className="pill warn">{t('pill.draining')}</span>}
            <button type="button" className="btn sm" onClick={() => void refresh()}>
              <Icon name="refresh" size={14} />
              {t('head.refresh')}
            </button>
            {updatedAt !== null && <span className="stamp" suppressHydrationWarning>{t('head.updated', { time: clock(updatedAt, locale) })}</span>}
          </div>
        </div>

        <div id="panel-overview" hidden={view !== 'overview'}>
          {seen.has('overview') && (
            <Overview
              info={info}
              reachable={reachable}
              updatedAt={updatedAt}
              lastOkAt={lastOkAt}
              samples={samples}
              onRetry={() => void refresh()}
              active={view === 'overview'}
            />
          )}
        </div>
        <div id="panel-catalog" hidden={view !== 'catalog'}>
          {seen.has('catalog') && <Catalog />}
        </div>
        <div id="panel-chaos" hidden={view !== 'chaos'}>
          {seen.has('chaos') && (
            <Chaos
              active={view === 'chaos'}
              podName={pod}
              samples={samples}
              status={describe(info, reachable, lastOkAt, t, locale)}
              onChange={() => void refresh()}
            />
          )}
        </div>
        <div id="panel-database" hidden={view !== 'database'}>
          {seen.has('database') && <Database active={view === 'database'} />}
        </div>
      </main>
    </Shell>
  );
}
