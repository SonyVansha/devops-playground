import Link from 'next/link';
import DocsSearch from '../../components/docs/DocsSearch';
import Rich from '../../components/Rich';
import { groupsFor } from '../../docs/index';
import { translator } from '../../i18n/index';
import { getLang } from '../../i18n/server';

export default async function DocsIndex() {
  const lang = await getLang();
  const t = translator(lang);
  return (
    <div>
      <header className="docs-hero">
        <h1>{t('docs.hero.title')}</h1>
        <p>
          <Rich text={t('docs.hero.lead')} />
        </p>
        <p className="quick">
          {t('docs.hero.new')} <Link href="/docs/mulai-cepat">{t('docs.hero.start')}</Link>. {t('docs.hero.problem')}{' '}
          <Link href="/docs/troubleshooting">{t('docs.hero.trouble')}</Link>.
        </p>
      </header>

      <aside className="callout warn" role="note" style={{ marginTop: 24 }}>
        <span className="callout-label">{t('docs.status.label')}</span>
        <Rich text={t('docs.status.body')} />
      </aside>

      <DocsSearch groups={groupsFor(lang).map((g) => ({ name: g.name, docs: g.docs.map((d) => ({ slug: d.slug, title: d.title, summary: d.summary })) }))} />
    </div>
  );
}
