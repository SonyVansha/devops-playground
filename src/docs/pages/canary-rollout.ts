import type { Doc } from '../types.ts';

export const doc: Doc = {
  slug: 'canary-rollout',
  title: 'Canary (Argo Rollouts)',
  summary: 'Rilis bertahap 20% → 60% → 100% dengan analisis otomatis; versi rusak dibatalkan sendiri.',
  blocks: [
    {
      t: 'p',
      text: 'Rollout memakai pod template dari Deployment `playground` (`workloadRef`), jadi kamu merilis versi baru dengan mengubah Deployment. Analisis berupa Job `curl` yang memanggil `/api/hello` pada Service canary 40 kali; canary dianggap sehat bila minimal 95% respons 200.',
    },
    { t: 'h', text: 'Prasyarat' },
    {
      t: 'ul',
      items: [
        'Controller Argo Rollouts terpasang di cluster dan plugin `kubectl argo rollouts`.',
        '`k8s/app.yaml` sudah di-apply (namespace `playground`).',
        'Arahkan HPA ke Rollout (`scaleTargetRef: {apiVersion: argoproj.io/v1alpha1, kind: Rollout, name: playground}`), kalau tidak HPA dan Rollout berebut kendali replika.',
      ],
    },
    {
      t: 'code',
      code: 'kubectl apply -f k8s/rollouts/rollout.yaml\nkubectl argo rollouts get rollout playground -n playground --watch',
    },
    {
      t: 'note',
      kind: 'info',
      text: 'Tanpa traffic router (Kong, Envoy Gateway, Istio, NGINX), bobot canary mengikuti **jumlah pod** (20% dari 5 replika = 1 pod). Analisis tetap akurat karena menembak Service canary langsung.',
    },
    { t: 'h', text: 'Skenario A: canary sehat → dipromosikan' },
    { t: 'code', code: 'kubectl -n playground set env deploy/playground APP_VERSION=v2' },
    {
      t: 'check',
      title: 'Promosi penuh',
      command: 'kubectl argo rollouts get rollout playground -n playground\ncurl -s {{BASE}}/api/hello | grep -o \'"version":"[^"]*"\'',
      expect: 'tahap 20% → analisis `Successful` → 60% → analisis `Successful` → 100%, status `Healthy`. Versi yang melayani menjadi `v2`.',
    },
    { t: 'h', text: 'Skenario B: canary rusak → dibatalkan otomatis' },
    { t: 'code', code: 'kubectl -n playground set env deploy/playground APP_VERSION=v3 ERROR_RATE=30' },
    {
      t: 'check',
      title: 'Rollout dibatalkan',
      command: 'kubectl argo rollouts get rollout playground -n playground\nkubectl -n playground get analysisrun',
      expect: 'AnalysisRun `Failed` (success rate < 95%), Rollout `Degraded`, pod canary di-scale turun, dan stable (`v2`) tetap melayani 100% traffic.',
    },
    {
      t: 'code',
      title: 'Pulihkan template',
      code: 'kubectl -n playground set env deploy/playground APP_VERSION=v2 ERROR_RATE-',
    },
    { t: 'h', text: 'Skenario C dan D' },
    {
      t: 'table',
      head: ['Skenario', 'Perintah', 'Hasil'],
      rows: [
        ['Canary lambat', '`set env deploy/playground APP_VERSION=v3 LATENCY_MS=8000`', 'curl timeout 5 dtk → success rendah → dibatalkan'],
        ['Tidak pernah siap', '`set env deploy/playground APP_VERSION=v3 BOOT_FAIL=true`', 'pod canary CrashLoopBackOff, rollout tertahan di tahap 1'],
      ],
    },
    { t: 'h', text: 'Bukti zero-downtime dengan k6' },
    {
      t: 'check',
      title: 'Beban selama rollout',
      command: 'k6 run -e BASE_URL={{BASE}} -e RATE=20 -e DURATION=3m loadtest/hello.js',
      expect: 'threshold `http_req_failed` dan `http_req_duration` lulus; metric `served_by_version` menunjukkan perpindahan v2 → v3 bertahap, tanpa lonjakan error di stable.',
    },
    {
      t: 'note',
      kind: 'warn',
      text: 'Varian analisis berbasis Prometheus (`k8s/rollouts/analysis-prometheus.yaml`) belum diuji; nama label `pod` bergantung pada konfigurasi scrape-mu. Image `curlimages/curl` di Job analisis belum dipin dengan digest.',
    },
  ],
};
