'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useT } from '../../i18n/client';

export interface NavGroup {
  name: string;
  items: Array<{ slug: string; title: string; summary?: string }>;
}

export default function DocsNav({ groups }: Readonly<{ groups: NavGroup[] }>) {
  const t = useT();
  const pathname = usePathname() ?? '';
  const [query, setQuery] = useState('');

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({ ...g, items: g.items.filter((i) => `${i.title} ${i.summary ?? ''}`.toLowerCase().includes(q)) }))
      .filter((g) => g.items.length > 0);
  }, [groups, query]);

  return (
    <nav aria-label={t('docs.nav.aria')} className="docs-nav">
      <input
        type="search"
        className="nav-filter"
        aria-label={t('docs.nav.filter')}
        placeholder={t('docs.nav.filter')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoComplete="off"
        spellCheck={false}
      />
      {shown.map((group) => (
        <div key={group.name}>
          <h2>{group.name}</h2>
          <ul>
            {group.items.map((item) => {
              const active = pathname.endsWith(`/docs/${item.slug}`);
              return (
                <li key={item.slug}>
                  <Link href={`/docs/${item.slug}`} aria-current={active ? 'page' : undefined}>
                    {item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
      {shown.length === 0 && <p className="muted nav-empty">{t('docs.nav.empty', { q: query })}</p>}
    </nav>
  );
}
