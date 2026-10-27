import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { I18nProvider } from '../i18n/client';
import { messagesFor, translator } from '../i18n/index';
import { getLang } from '../i18n/server';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const t = translator(await getLang());
  return { title: t('meta.title'), description: t('meta.description') };
}

// Terapkan tema pilihan sebelum paint agar tidak berkedip. ?theme=light|dark dan ?lang=en|id juga diterima
// (berguna untuk tautan dan tangkapan layar); ?lang menulis cookie lalu memuat ulang sekali tanpa parameter itu.
const BOOT_SCRIPT = `(function(){try{var q=new URLSearchParams(location.search);var p=q.get('theme');var t=(p==='light'||p==='dark')?p:localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;var l=q.get('lang');if((l==='en'||l==='id')&&l!==document.documentElement.lang){document.cookie='lang='+l+';path=/;max-age=31536000;samesite=lax';q.delete('lang');var s=q.toString();location.replace(location.pathname+(s?'?'+s:'')+location.hash)}var h=location.hash.slice(1);if(h==='catalog'||h==='chaos'||h==='database')document.documentElement.dataset.view=h}catch(e){}})()`;

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const lang = await getLang();
  const t = translator(lang);
  return (
    <html lang={lang} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: BOOT_SCRIPT }} />
      </head>
      <body>
        <a className="skip" href="#konten">
          {t('shell.skip')}
        </a>
        <I18nProvider lang={lang} messages={messagesFor(lang, [])}>
          <div id="konten">{children}</div>
        </I18nProvider>
      </body>
    </html>
  );
}
