'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { InfoData } from './api';
import Catalog from './Catalog';
import Chaos from './Chaos';
import { usePoll } from './hooks';
import Overview from './Overview';

const TABS = [
  { id: 'overview', label: 'Ringkasan' },
  { id: 'catalog', label: 'Skenario & endpoint' },
  { id: 'chaos', label: 'Fault injection' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export default function Dashboard() {
  const [tab, setTab] = useState<TabId>('overview');
  const { data: info, status } = usePoll<InfoData>('/api/info', 5000, true);

  const reachable = status === 200;
  const pod = info?.podName ?? info?.hostname;

  return (
    <main className="app">
      <header className="masthead">
        <div>
          <h1 className="wordmark">DevOps Playground</h1>
          <p className="tagline">
            Workload dummy untuk menguji Kubernetes, pipeline, dan API gateway sebelum aplikasi production berjalan.
          </p>
        </div>
        <nav className="masthead-links" aria-label="Navigasi utama">
          <Link href="/docs" className="btn">
            Dokumentasi
          </Link>
        </nav>
      </header>

      <div className="statusline" role="status" aria-label="Status instance">
        <span className={`pill ${reachable ? 'ok' : 'err'}`}>{reachable ? 'Online' : 'Tidak terjangkau'}</span>
        {info && <span className={`pill ${info.ready ? 'ok' : 'err'}`}>{info.ready ? 'Ready' : 'Not ready'}</span>}
        {info && <span className={`pill ${info.healthy ? 'ok' : 'err'}`}>{info.healthy ? 'Healthy' : 'Unhealthy'}</span>}
        {info?.draining && <span className="pill warn">Draining</span>}
        {pod && (
          <span>
            Pod <span className="mono">{pod}</span>
          </span>
        )}
        {info && (
          <span>
            Versi <span className="mono">{info.appVersion}</span>
          </span>
        )}
      </div>

      <div className="tabs" role="tablist" aria-label="Bagian dashboard">
        {TABS.map((t) => (
          <button
            key={t.id}
            id={`tab-${t.id}`}
            type="button"
            role="tab"
            className="tab"
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" hidden={tab !== 'overview'}>
        <Overview info={info} active={tab === 'overview'} />
      </div>
      <div id="panel-catalog" role="tabpanel" aria-labelledby="tab-catalog" hidden={tab !== 'catalog'}>
        <Catalog />
      </div>
      <div id="panel-chaos" role="tabpanel" aria-labelledby="tab-chaos" hidden={tab !== 'chaos'}>
        <Chaos active={tab === 'chaos'} />
      </div>
    </main>
  );
}
