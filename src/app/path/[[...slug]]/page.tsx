import { headers } from 'next/headers';
import Link from 'next/link';
import { gatewayHeaders } from '../../../lib/gateway';
import { Icon } from '../../../components/shell/Icons';
import Shell from '../../../components/shell/Shell';

export const dynamic = 'force-dynamic';

// Menampilkan path yang sampai ke app, untuk tes ingress path routing / rewrite / prefix.
export default async function PathEcho({ params }: Readonly<{ params: Promise<{ slug?: string[] }> }>) {
  const { slug = [] } = await params;
  const rows = gatewayHeaders(await headers());
  const nav = (
    <>
      <Link href="/" className="nav-item">
        <Icon name="back" />
        Dashboard
      </Link>
      <Link href="/docs" className="nav-item">
        <Icon name="docs" />
        Dokumentasi
      </Link>
    </>
  );
  return (
    <Shell nav={nav} title="Path echo">
      <main className="canvas">
        <div className="title-row">
          <div>
            <h1>Path yang diterima app</h1>
            <p className="sub-line">
              Path yang sampai ke app setelah melewati ingress atau gateway: <code>/{slug.join('/')}</code>
            </p>
          </div>
        </div>
        <section className="panel" aria-label="Header dari proxy dan gateway" style={{ maxWidth: 760 }}>
          <h2>Header dari proxy dan gateway</h2>
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
