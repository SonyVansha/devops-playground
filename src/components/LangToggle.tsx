'use client';

import { LANGS } from '../i18n/core';
import { useI18n } from '../i18n/client';

// Dua pilihan bahasa, EN dan ID. Memilih menulis cookie lalu server merender ulang halaman (termasuk dokumentasi).
export default function LangToggle() {
  const { lang, setLang, t } = useI18n();
  return (
    <div className="lang-toggle" role="group" aria-label={t('lang.label')}>
      {LANGS.map((l) => (
        <button key={l} type="button" lang={l} className="lang-opt" aria-pressed={lang === l} aria-label={t(l === 'en' ? 'lang.en' : 'lang.id')} onClick={() => lang !== l && setLang(l)}>
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
