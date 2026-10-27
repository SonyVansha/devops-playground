'use client';

import { useState } from 'react';
import { useT } from '../../i18n/client';
import { useBaseUrl } from './BaseUrl';

export function fillBase(code: string, base: string): string {
  return code.split('{{BASE}}').join(base.replace(/\/+$/, ''));
}

export default function CodeBlock({ code, title }: Readonly<{ code: string; title?: string }>) {
  const t = useT();
  const { base } = useBaseUrl();
  const [copied, setCopied] = useState(false);
  const text = fillBase(code, base);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <figure className="codeblock">
      <figcaption>
        <span className="muted">{title ?? t('docs.code.default')}</span>
        <button type="button" className="btn sm" onClick={copy}>
          {copied ? t('common.copied') : t('common.copy')}
        </button>
      </figcaption>
      <pre tabIndex={0}>
        <code>{text}</code>
      </pre>
    </figure>
  );
}

// Kode inline yang ikut mengisi {{BASE}} (dipakai di sel tabel dan catatan).
export function InlineCode({ text }: Readonly<{ text: string }>) {
  const { base } = useBaseUrl();
  return <code>{fillBase(text, base)}</code>;
}
