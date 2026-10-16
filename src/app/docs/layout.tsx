import Link from 'next/link';
import type { ReactNode } from 'react';
import { BaseUrlProvider } from '../../components/docs/BaseUrl';
import DocsNav from '../../components/docs/DocsNav';
import { GROUPS } from '../../docs/index';

export const metadata = {
  title: 'Dokumentasi | DevOps Playground',
  description: 'Panduan memakai dan memeriksa workload dummy untuk skenario Kubernetes, gateway, dan rollout',
};

const navGroups = GROUPS.map((g) => ({ name: g.name, items: g.docs.map((d) => ({ slug: d.slug, title: d.title })) }));

export default function DocsLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <BaseUrlProvider>
      <div className="docs-shell">
        <header className="docs-top">
          <Link href="/docs" className="brand">
            DevOps Playground <span className="muted">/ Dokumentasi</span>
          </Link>
          <nav className="links" aria-label="Navigasi situs">
            <Link href="/docs">Semua dokumen</Link>
            <Link href="/">Dashboard</Link>
          </nav>
        </header>
        <div className="docs">
          <aside className="docs-side">
            <DocsNav groups={navGroups} />
          </aside>
          <details className="docs-menu">
            <summary>Daftar dokumentasi</summary>
            <DocsNav groups={navGroups} />
          </details>
          <main className="docs-main">
            {children}
          </main>
        </div>
      </div>
    </BaseUrlProvider>
  );
}
