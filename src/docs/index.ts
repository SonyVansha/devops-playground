import type { Doc, DocGroup } from './types.ts';
import { doc as mulaiCepat } from './pages/mulai-cepat.ts';
import { doc as probeLifecycle } from './pages/probe-lifecycle.ts';
import { doc as skenarioDeploy } from './pages/skenario-deploy.ts';
import { doc as canaryRollout } from './pages/canary-rollout.ts';
import { doc as envoy } from './pages/envoy-gateway.ts';
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
import { doc as en_mulaiCepat } from './en/mulai-cepat.ts';
import { doc as en_probeLifecycle } from './en/probe-lifecycle.ts';
import { doc as en_skenarioDeploy } from './en/skenario-deploy.ts';
import { doc as en_canaryRollout } from './en/canary-rollout.ts';
import { doc as en_envoy } from './en/envoy-gateway.ts';
import { doc as en_kong } from './en/kong.ts';
import { doc as en_multiHop } from './en/multi-hop.ts';
import { doc as en_auth } from './en/auth.ts';
import { doc as en_caching } from './en/caching.ts';
import { doc as en_resilience } from './en/resilience.ts';
import { doc as en_faultInjection } from './en/fault-injection.ts';
import { doc as en_jaringanConfig } from './en/jaringan-config.ts';
import { doc as en_observability } from './en/observability.ts';
import { doc as en_buildScan } from './en/build-scan.ts';
import { doc as en_troubleshooting } from './en/troubleshooting.ts';
import { doc as en_referensi } from './en/referensi.ts';
import type { Lang } from '../i18n/core.ts';

// Urutan grup dan halaman di sini = urutan di sidebar dan tombol Sebelumnya/Berikutnya.
// Menambah halaman baru: buat file di ./pages lalu daftarkan di salah satu grup (test memvalidasi slug dan endpoint).
export const GROUPS: DocGroup[] = [
  { name: 'Mulai', docs: [mulaiCepat, probeLifecycle] },
  { name: 'Skenario', docs: [skenarioDeploy, canaryRollout, multiHop, resilience, faultInjection] },
  { name: 'Gateway & akses', docs: [envoy, kong, auth, caching] },
  { name: 'Operasional', docs: [jaringanConfig, observability, buildScan] },
  { name: 'Referensi', docs: [troubleshooting, referensi] },
];

export const DOCS: Doc[] = GROUPS.flatMap((g) => g.docs);

export function groupOf(slug: string): string | undefined {
  return GROUPS.find((g) => g.docs.some((d) => d.slug === slug))?.name;
}

// Padanan Inggris: slug sama (URL berlaku untuk kedua bahasa), struktur sama (dijaga test/docs-i18n.test.ts).
const EN_DOCS: Doc[] = [
  en_mulaiCepat,
  en_probeLifecycle,
  en_skenarioDeploy,
  en_canaryRollout,
  en_envoy,
  en_kong,
  en_multiHop,
  en_auth,
  en_caching,
  en_resilience,
  en_faultInjection,
  en_jaringanConfig,
  en_observability,
  en_buildScan,
  en_troubleshooting,
  en_referensi,
];
const EN_BY_SLUG = new Map(EN_DOCS.map((d) => [d.slug, d]));
const EN_GROUP_NAMES = ['Start', 'Scenarios', 'Gateway & access', 'Operations', 'Reference'];

export const GROUPS_EN: DocGroup[] = GROUPS.map((g, i) => ({
  name: EN_GROUP_NAMES[i],
  docs: g.docs.map((d) => {
    const en = EN_BY_SLUG.get(d.slug);
    if (!en) throw new Error(`terjemahan Inggris belum ada: ${d.slug}`);
    return en;
  }),
}));

export const DOCS_EN: Doc[] = GROUPS_EN.flatMap((g) => g.docs);

export function groupsFor(lang: Lang): DocGroup[] {
  return lang === 'id' ? GROUPS : GROUPS_EN;
}

export function docsFor(lang: Lang): Doc[] {
  return lang === 'id' ? DOCS : DOCS_EN;
}

export function groupNameOf(lang: Lang, slug: string): string | undefined {
  return groupsFor(lang).find((g) => g.docs.some((d) => d.slug === slug))?.name;
}
