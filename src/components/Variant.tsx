import { headers } from 'next/headers';
import { gatewayHeaders } from '@/lib/gateway';
import { podInfo } from '@/lib/util';

interface Theme {
  name: string;
  bg: string;
  fg: string;
  soft: string;
}

const THEMES = {
  blue: { name: 'Service Blue', bg: '#1b4fb8', fg: '#f4f8ff', soft: '#c7d8f7' },
  green: { name: 'Service Green', bg: '#146c3a', fg: '#f3fbf6', soft: '#bfe5cd' },
} as const satisfies Record<string, Theme>;

export type VariantKey = keyof typeof THEMES;

// Satu komponen, dua tampilan: dipakai route /blue dan /green untuk tes routing API gateway.
export default async function Variant({ variant }: Readonly<{ variant: VariantKey }>) {
  const theme = THEMES[variant];
  const info = podInfo();
  const rows = gatewayHeaders(await headers());
  const pod = info.podName ?? info.hostname ?? '—';

  return (
    <main>
      <section style={{ background: theme.bg, color: theme.fg }}>
        <div style={{ maxWidth: 1120, margin: '0 auto', padding: '56px 24px 48px' }}>
          <p style={{ margin: 0, color: theme.soft, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Route <span className="mono" style={{ textTransform: 'none' }}>/{variant}</span>
          </p>
          <h1 style={{ margin: '8px 0 12px', color: theme.fg, fontSize: 'clamp(36px, 7vw, 64px)', letterSpacing: '-0.03em' }}>{theme.name}</h1>
          <p style={{ margin: 0, color: theme.soft, fontSize: 16 }}>
            Dilayani oleh pod <span className="mono" style={{ color: theme.fg }}>{pod}</span>
          </p>
        </div>
      </section>
      <div className="app" style={{ maxWidth: 760 }}>
        <section className="panel" aria-label="Header yang diterima dari gateway">
          <h2>Header yang diterima dari gateway</h2>
          <dl className="dl">
            {Object.entries(rows).map(([name, value]) => (
              <div className="dl-row" key={name}>
                <dt className="mono">{name}</dt>
                <dd className="mono">{value ?? <span className="muted">—</span>}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </main>
  );
}
