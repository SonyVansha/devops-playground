'use client';

import { useEffect, useState } from 'react';
import { useT } from '../i18n/client';

type Theme = 'light' | 'dark';

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

// Tema mengikuti sistem sampai pengguna memilih; pilihan disimpan di browser (bukan di server).
export default function ThemeToggle() {
  const t = useT();
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const forced = document.documentElement.dataset.theme;
    setTheme(forced === 'light' || forced === 'dark' ? forced : systemTheme());
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem('theme', next);
    } catch {
      // penyimpanan diblokir: tema tetap berlaku untuk sesi ini
    }
  };

  const dark = theme === 'dark';
  return (
    <button type="button" className="btn sm icon-btn" onClick={toggle} aria-pressed={dark} aria-label={t('theme.label')} title={dark ? t('theme.toLight') : t('theme.toDark')}>
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        {dark ? (
          <>
            <circle cx="8" cy="8" r="3" />
            <path d="M8 1.5v1.5M8 13v1.5M1.5 8H3M13 8h1.5M3.4 3.4l1 1M11.6 11.6l1 1M12.6 3.4l-1 1M4.4 11.6l-1 1" />
          </>
        ) : (
          <path d="M13.2 9.6A5.6 5.6 0 0 1 6.4 2.8a5.6 5.6 0 1 0 6.8 6.8z" />
        )}
      </svg>
    </button>
  );
}
