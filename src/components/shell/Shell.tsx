'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import Mark from '../Mark';
import { useT } from '../../i18n/client';
import LangToggle from '../LangToggle';
import ThemeToggle from '../ThemeToggle';
import { Icon } from './Icons';

interface ShellProps {
  /** Isi navigasi utama (link/tombol dengan kelas nav-item). */
  nav: ReactNode;
  /** Judul tampilan, dipakai di bar ponsel. */
  title: string;
  /** Blok scope di bawah nama produk (namespace / pod). */
  scope?: ReactNode;
  /** Tautan di dasar sidebar (mis. Dokumentasi). */
  footerNav?: ReactNode;
  /** Teks kecil di dasar sidebar (mis. versi). */
  meta?: ReactNode;
  children: ReactNode;
}

// Kerangka satu untuk semua halaman: sidebar di atas ground, konten di "lembar" putih.
// Di ponsel sidebar menjadi laci; Esc menutup, fokus kembali ke tombol menu.
export default function Shell({ nav, title, scope, footerNav, meta, children }: Readonly<ShellProps>) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const pathname = usePathname();

  const close = () => {
    setOpen(false);
    menuButton.current?.focus();
  };

  // Memilih tautan di dalam laci menutupnya. replaceState (pindah tampilan dashboard) tidak memicu hashchange, jadi klik ditangani langsung.
  const closeOnLink = (e: MouseEvent<HTMLElement>) => {
    if ((e.target as HTMLElement).closest('a')) setOpen(false);
  };

  // Tutup laci saat pindah halaman atau hash berubah.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onHash = () => setOpen(false);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    sidebar.current?.querySelector<HTMLElement>('a, button')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className="shell">
      <header className="mobilebar">
        <button
          ref={menuButton}
          type="button"
          className="btn icon-btn"
          aria-label={t('shell.openMenu')}
          aria-expanded={open}
          aria-controls="sidebar"
          onClick={() => setOpen(true)}
        >
          <Icon name="menu" />
        </button>
        <span className="mobilebar-title">{title}</span>
      </header>

      {open && <button type="button" className="scrim" aria-label={t('shell.closeMenu')} tabIndex={-1} onClick={close} />}

      <aside id="sidebar" ref={sidebar} className={`sidebar${open ? ' open' : ''}`} aria-label={t('shell.mainNav')}>
        <div className="sidebar-head">
          <Link href="/" className="brand" aria-label={t('shell.brandAria')}>
            <Mark />
            <span>DevOps Playground</span>
          </Link>
          <button type="button" className="btn icon-btn sidebar-close" aria-label={t('shell.closeMenu')} onClick={close}>
            <Icon name="close" />
          </button>
        </div>
        {scope}
        <div className="sidebar-nav" onClick={closeOnLink}>
          {nav}
        </div>
        <div className="sidebar-foot" onClick={closeOnLink}>
          {footerNav}
          <div className="sidebar-meta">
            <div className="row" style={{ gap: 6 }}>
              <ThemeToggle />
              <LangToggle />
            </div>
            {meta && <span className="muted">{meta}</span>}
          </div>
        </div>
      </aside>

      <div className="main">
        <div className="sheet">{children}</div>
      </div>
    </div>
  );
}
