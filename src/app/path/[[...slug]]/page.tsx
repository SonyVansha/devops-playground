import { headers } from 'next/headers';
import { gatewayHeaders } from '../../../lib/gateway';

export const dynamic = 'force-dynamic';

// Menampilkan path yang sampai ke app, untuk tes ingress path routing / rewrite / prefix.
export default async function PathEcho({ params }: Readonly<{ params: Promise<{ slug?: string[] }> }>) {
  const { slug = [] } = await params;
  const rows = gatewayHeaders(await headers());
  return (
    <main className="app" style={{ maxWidth: 760 }}>
      <p className="muted" style={{ marginBottom: 8 }}>
        <a href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/`}>Dashboard</a> / Path echo
      </p>
      <h1 className="wordmark">Path yang diterima app</h1>
      <p style={{ margin: '10px 0 20px' }}>
        <code>/{slug.join('/')}</code>
      </p>
      <section className="panel" aria-label="Header dari proxy dan gateway">
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
  );
}
