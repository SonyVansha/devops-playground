'use client';

import { useRouter } from 'next/navigation';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { LANG_COOKIE, localeOf, makeT, type Lang, type Translate } from './core.ts';

interface I18nValue {
  lang: Lang;
  /** Locale untuk format tanggal/angka, mis. "en-GB". */
  locale: string;
  t: Translate;
  /** Pesan yang tersedia di rute ini (dipakai I18nExtra untuk menambah bagian). */
  messages: Readonly<Record<string, string>>;
  setLang: (lang: Lang) => void;
}

const I18n = createContext<I18nValue | null>(null);

// Server mengirim kamus bahasa aktif saja; mengganti bahasa menulis cookie lalu meminta server merender ulang.
export function I18nProvider({ lang, messages, children }: Readonly<{ lang: Lang; messages: Readonly<Record<string, string>>; children: ReactNode }>) {
  const router = useRouter();
  const value = useMemo<I18nValue>(
    () => ({
      lang,
      locale: localeOf(lang),
      t: makeT(messages),
      messages,
      setLang: (next) => {
        document.cookie = `${LANG_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
        router.refresh();
      },
    }),
    [lang, messages, router],
  );
  return <I18n.Provider value={value}>{children}</I18n.Provider>;
}

// Menambah bagian kamus untuk satu rute di atas kerangka yang sudah ada (mis. dashboard, docs).
export function I18nExtra({ messages, children }: Readonly<{ messages: Readonly<Record<string, string>>; children: ReactNode }>) {
  const parent = useI18n();
  const value = useMemo<I18nValue>(() => {
    const merged = { ...parent.messages, ...messages };
    return { ...parent, messages: merged, t: makeT(merged) };
  }, [parent, messages]);
  return <I18n.Provider value={value}>{children}</I18n.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18n);
  if (!ctx) throw new Error('I18nProvider belum terpasang');
  return ctx;
}

export function useT(): Translate {
  return useI18n().t;
}
