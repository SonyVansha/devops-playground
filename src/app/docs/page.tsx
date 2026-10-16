import Link from 'next/link';
import DocsSearch from '../../components/docs/DocsSearch';
import { GROUPS } from '../../docs/index';

export default function DocsIndex() {
  return (
    <div>
      <header className="docs-hero">
        <h1>Dokumentasi</h1>
        <p>
          Cara memakai app ini sebagai workload dummy, dan cara memastikan hasilnya benar. Setiap topik punya bagian <strong>Verifikasi</strong>:
          perintah yang bisa langsung dijalankan beserta hasil yang seharusnya muncul.
        </p>
        <p className="quick">
          Baru pertama kali? <Link href="/docs/mulai-cepat">Mulai cepat</Link>. Ada yang tidak sesuai harapan?{' '}
          <Link href="/docs/troubleshooting">Troubleshooting</Link>.
        </p>
      </header>

      <aside className="callout warn" role="note" style={{ marginTop: 24 }}>
        <span className="callout-label">Status pengujian</span>
        Perilaku level aplikasi sudah diuji di container. Langkah yang membutuhkan cluster (Kubernetes, Envoy Gateway, Kong, Argo Rollouts) belum diuji di cluster
        sungguhan: jalankan dengan <code>--dry-run=server</code> dulu dan sesuaikan dengan lingkunganmu.
      </aside>

      <DocsSearch groups={GROUPS.map((g) => ({ name: g.name, docs: g.docs.map((d) => ({ slug: d.slug, title: d.title, summary: d.summary })) }))} />
    </div>
  );
}
