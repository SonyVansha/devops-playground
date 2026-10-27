import { headers } from 'next/headers';
import Link from 'next/link';
import Rich from '../../../components/Rich';
import { Icon } from '../../../components/shell/Icons';
import Shell from '../../../components/shell/Shell';
import { translator } from '../../../i18n/index';
import { getLang } from '../../../i18n/server';
import { gatewayHeaders } from '../../../lib/gateway';

export const dynamic = 'force-dynamic';

// Menampilkan path yang sampai ke app, untuk tes ingress path routing / rewrite / prefix.
export default async function PathEcho({ params }: Readonly<{ params: Promise<{ slug?: string[] }> }>) {
  const { slug = [] } = await params;
  const t = translator(await getLang());
  const rows = gatewayHeaders(await headers());
  const nav = (
    <>
      <Link href="/" className="nav-item">
        <Icon name="back" />
        {t('docs.nav.dashboard')}
      </Link>
      <Link href="/docs" className="nav-item">
        <Icon name="docs" />
        {t('nav.docs')}
      </Link>
    </>
  );
  return (
    <Shell nav={nav} title={t('path.nav')}>
      <main className="canvas">
        <div className="title-row">
          <div>
            <h1>{t('path.title')}</h1>
            <p className="sub-line">
              <Rich text={t('path.sub', { path: `/${slug.join('/')}` })} />
            </p>
          </div>
        </div>
        <section className="panel" aria-label={t('path.headers')} style={{ maxWidth: 760 }}>
          <h2>{t('path.headers')}</h2>
          <dl className="dl">
            {Object.entries(rows).map(([name, value]) => (
              <div className="dl-row" key={name}>
                <dt className="mono">{name}</dt>
                <dd className="mono">{value ?? <span className="muted">—</span>}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </Shell>
  );
}
