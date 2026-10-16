import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BaseUrlBar } from '../../../components/docs/BaseUrl';
import DocBlocks from '../../../components/docs/DocBlocks';
import Toc from '../../../components/docs/Toc';
import { headingsOf } from '../../../docs/headings';
import { DOCS, groupOf } from '../../../docs/index';

export const dynamicParams = false;

export function generateStaticParams() {
  return DOCS.map((d) => ({ slug: d.slug }));
}

export async function generateMetadata({ params }: Readonly<{ params: Promise<{ slug: string }> }>) {
  const { slug } = await params;
  const doc = DOCS.find((d) => d.slug === slug);
  return { title: doc ? `${doc.title} | Dokumentasi` : 'Dokumentasi', description: doc?.summary };
}

export default async function DocPage({ params }: Readonly<{ params: Promise<{ slug: string }> }>) {
  const { slug } = await params;
  const index = DOCS.findIndex((d) => d.slug === slug);
  if (index < 0) notFound();
  const doc = DOCS[index];
  const prev = DOCS[index - 1];
  const next = DOCS[index + 1];

  return (
    <div className="doc-layout">
      <article>
        <BaseUrlBar />
        <p className="doc-crumb">
          <Link href="/docs">Dokumentasi</Link> / {groupOf(slug)}
        </p>
        <h1 className="doc-title">{doc.title}</h1>
        <p className="lead">{doc.summary}</p>
        <DocBlocks blocks={doc.blocks} />
        <nav className="pager" aria-label="Halaman sebelumnya dan berikutnya">
          {prev ? (
            <Link href={`/docs/${prev.slug}`}>
              <small>Sebelumnya</small>
              <strong>{prev.title}</strong>
            </Link>
          ) : (
            <span />
          )}
          {next ? (
            <Link href={`/docs/${next.slug}`} className="next">
              <small>Berikutnya</small>
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
