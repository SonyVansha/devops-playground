import type { Doc, DocGroup } from './types.ts';
import { doc as mulaiCepat } from './pages/mulai-cepat.ts';
import { doc as probeLifecycle } from './pages/probe-lifecycle.ts';
import { doc as skenarioDeploy } from './pages/skenario-deploy.ts';
import { doc as canaryRollout } from './pages/canary-rollout.ts';
import { doc as kong } from './pages/kong.ts';
import { doc as multiHop } from './pages/multi-hop.ts';
import { doc as auth } from './pages/auth.ts';
import { doc as caching } from './pages/caching.ts';
import { doc as resilience } from './pages/resilience.ts';
import { doc as faultInjection } from './pages/fault-injection.ts';
import { doc as jaringanConfig } from './pages/jaringan-config.ts';
import { doc as observability } from './pages/observability.ts';
import { doc as buildScan } from './pages/build-scan.ts';
import { doc as troubleshooting } from './pages/troubleshooting.ts';
import { doc as referensi } from './pages/referensi.ts';

// Urutan grup dan halaman di sini = urutan di sidebar dan tombol Sebelumnya/Berikutnya.
// Menambah halaman baru: buat file di ./pages lalu daftarkan di salah satu grup (test memvalidasi slug dan endpoint).
export const GROUPS: DocGroup[] = [
  { name: 'Mulai', docs: [mulaiCepat, probeLifecycle] },
  { name: 'Skenario', docs: [skenarioDeploy, canaryRollout, multiHop, resilience, faultInjection] },
  { name: 'Gateway & akses', docs: [kong, auth, caching] },
  { name: 'Operasional', docs: [jaringanConfig, observability, buildScan] },
  { name: 'Referensi', docs: [troubleshooting, referensi] },
];

export const DOCS: Doc[] = GROUPS.flatMap((g) => g.docs);

export function groupOf(slug: string): string | undefined {
  return GROUPS.find((g) => g.docs.some((d) => d.slug === slug))?.name;
}
