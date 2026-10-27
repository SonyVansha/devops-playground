'use client';

import { useEffect, useState } from 'react';
import { useT } from '../../i18n/client';
import type { Heading } from '../../docs/headings';

// Daftar isi "Di halaman ini" dengan penanda bagian yang sedang dibaca (IntersectionObserver).
export default function Toc({ headings }: Readonly<{ headings: Heading[] }>) {
  const t = useT();
  const [active, setActive] = useState<string | null>(headings[0]?.id ?? null);

  useEffect(() => {
    const elements = headings.map((h) => document.getElementById(h.id)).filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0 || typeof IntersectionObserver === 'undefined') return undefined;
    // Di dasar halaman, heading terakhir sering tidak bisa mencapai area deteksi: anggap bagian terakhir yang dibaca.
    const lastId = headings[headings.length - 1].id;
    const atBottom = () => window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
    const observer = new IntersectionObserver(
      (entries) => {
        if (atBottom()) return;
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) setActive(visible[0].target.id);
      },
      { rootMargin: '-10% 0px -70% 0px' },
    );
    elements.forEach((el) => observer.observe(el));
    const onScroll = () => {
      if (atBottom()) setActive(lastId);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
    };
  }, [headings]);

  if (headings.length < 2) return null;
  return (
    <nav className="toc" aria-label={t('docs.toc')}>
      <h2>{t('docs.toc')}</h2>
      <ul>
        {headings.map((h) => (
          <li key={h.id}>
            <a href={`#${h.id}`} aria-current={active === h.id ? 'true' : undefined} onClick={() => setActive(h.id)}>
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
