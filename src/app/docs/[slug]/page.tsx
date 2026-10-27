import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BaseUrlBar } from '../../../components/docs/BaseUrl';
import DocBlocks from '../../../components/docs/DocBlocks';
import Toc from '../../../components/docs/Toc';
import { headingsOf } from '../../../docs/headings';
import { DOCS, docsFor, groupNameOf } from '../../../docs/index';
import { translator } from '../../../i18n/index';
import { getLang } from '../../../i18n/server';

export const dynamicParams = false;

export function generateStaticParams() {
  return DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: Readonly<{ params: Promise<{ slug: string }> }>) {
  const { slug } = await params;
  const lang = await getLang();
  const doc = docsFor(lang).find((d) => d.slug === slug);
  return { title: doc ? `${doc.title} | ${translator(lang)('docs.metaSuffix')}` : translator(lang)('docs.metaSuffix'), description: doc?.summary };
}

export default async function DocPage({ params }: Readonly<{ params: Promise<{ slug: string }> }>) {
  const { slug } = await params;
  const lang = await getLang();
  const t = translator(lang);
  const docs = docsFor(lang);
  const index = docs.findIndex((d) => d.slug === slug);
  if (index < 0) notFound();
  const doc = docs[index];
  const prev = docs[index - 1];
  const next = docs[index + 1];

  return (
    <div className="doc-layout">
      <article>
        <BaseUrlBar />
        <p className="doc-crumb">
          <Link href="/docs">{t('docs.crumb')}</Link> / {groupNameOf(lang, slug)}
        </p>
        <h1 className="doc-title">{doc.title}</h1>
        <p className="lead">{doc.summary}</p>
        <DocBlocks blocks={doc.blocks} t={t} />
        <nav className="pager" aria-label={t('docs.pager.aria')}>
          {prev ? (
            <Link href={`/docs/${prev.slug}`}>
              <small>{t('docs.prev')}</small>
              <strong>{prev.title}</strong>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`/docs/${next.slug}`} className="next">
              <small>{t('docs.next')}</small>
              <strong>{next.title}</strong>
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </article>
      <aside>
        <Toc headings={headingsOf(doc.blocks)} />
      </aside>
    </div>
  );
}
