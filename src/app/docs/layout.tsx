import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BaseUrlProvider } from '../../components/docs/BaseUrl';
import DocsNav from '../../components/docs/DocsNav';
import { Icon } from '../../components/shell/Icons';
import Shell from '../../components/shell/Shell';
import { groupsFor } from '../../docs/index';
import { I18nExtra } from '../../i18n/client';
import { DOCS_DOMAINS, messagesFor, translator } from '../../i18n/index';
import { getLang } from '../../i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = translator(await getLang());
  return { title: t('meta.docs.title'), description: t('meta.docs.description') };
}

// Di /docs, sidebar yang sama berisi menu dokumentasi; satu tautan kembali ke dashboard di atasnya.
export default async function DocsLayout({ children }: Readonly<{ children: ReactNode }>) {
  const lang = await getLang();
  const t = translator(lang);
  const navGroups = groupsFor(lang).map((g) => ({ name: g.name, items: g.docs.map((d) => ({ slug: d.slug, title: d.title, summary: d.summary })) }));
  const nav = (
    <>
      <Link href="/" className="nav-item">
        <Icon name="back" />
        {t('docs.nav.dashboard')}
      </Link>
      <DocsNav groups={navGroups} />
    </>
  );
  return (
    <I18nExtra messages={messagesFor(lang, DOCS_DOMAINS)}>
      <BaseUrlProvider>
        <Shell nav={nav} title={t('docs.crumb')}>
          <main className="canvas docs-main">{children}</main>
        </Shell>
      </BaseUrlProvider>
    </I18nExtra>
  );
}
