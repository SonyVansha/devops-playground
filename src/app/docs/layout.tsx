import Link from 'next/link';
import type { ReactNode } from 'react';
import { BaseUrlProvider } from '../../components/docs/BaseUrl';
import DocsNav from '../../components/docs/DocsNav';
import { Icon } from '../../components/shell/Icons';
import Shell from '../../components/shell/Shell';
import { GROUPS } from '../../docs/index';

export const metadata = {
  title: 'Dokumentasi | DevOps Playground',
  description: 'Panduan memakai dan memeriksa workload dummy untuk skenario Kubernetes, gateway, dan rollout',
};

const navGroups = GROUPS.map((g) => ({ name: g.name, items: g.docs.map((d) => ({ slug: d.slug, title: d.title, summary: d.summary })) }));

// Di /docs, sidebar yang sama berisi menu dokumentasi; satu tautan kembali ke dashboard di atasnya.
export default function DocsLayout({ children }: Readonly<{ children: ReactNode }>) {
  const nav = (
    <>
      <Link href="/" className="nav-item">
        <Icon name="back" />
        Dashboard
      </Link>
      <DocsNav groups={navGroups} />
    </>
  );
  return (
    <BaseUrlProvider>
      <Shell nav={nav} title="Dokumentasi">
        <main className="canvas docs-main">{children}</main>
      </Shell>
    </BaseUrlProvider>
  );
}
