'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';

export interface SearchGroup {
  name: string;
  docs: Array<{ slug: string; title: string; summary: string }>;
}

export default function DocsSearch({ groups }: Readonly<{ groups: SearchGroup[] }>) {
  const [query, setQuery] = useState('');
  const input = useRef<HTMLInputElement>(null);

  // Tekan "/" di mana saja untuk langsung mencari.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing = target !== null && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA');
      if (e.key === '/' && !typing) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map((g) => ({ ...g, docs: g.docs.filter((d) => `${d.title} ${d.summary}`.toLowerCase().includes(q)) }))
      .filter((g) => g.docs.length > 0);
  }, [groups, query]);

  return (
    <div>
      <label className="docs-search">
        Cari dokumentasi
        <input
          ref={input}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="mis. canary, rate limit, readiness, jwt  (tekan / untuk mencari)"
        />
      </label>
      <div aria-live="polite">
        {shown.map((g) => (
          <section key={g.name} className="doc-group">
            <h2>{g.name}</h2>
            <ul className="doc-list">
              {g.docs.map((d) => (
                <li key={d.slug}>
                  <Link href={`/docs/${d.slug}`} className="doc-row">
                    <strong>{d.title}</strong>
                    <span>{d.summary}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {shown.length === 0 && <p className="muted doc-group">Tidak ada dokumen yang cocok dengan “{query}”.</p>}
      </div>
    </div>
  );
}
