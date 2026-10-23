import type { Doc } from '../types.ts';

export const doc: Doc = {
  slug: 'mulai-cepat',
  title: 'Mulai cepat',
  summary: 'Jalankan app di lokal, Docker, atau Kubernetes, lalu pastikan semuanya sehat dengan satu smoke test.',
  blocks: [
    { t: 'h', text: 'Apa app ini?' },
    {
      t: 'p',
      text: 'DevOps Playground adalah **workload dummy**: aplikasi sederhana yang sengaja bisa dibuat sehat, lambat, rusak, atau bocor memori, supaya kamu bisa menguji platform (Kubernetes, ingress, API gateway, rollout, alerting, scan keamanan) **sebelum** aplikasi production dijalankan. App ini bukan alat penguji; tesnya kamu jalankan dari luar (kubectl, curl, k6, CI).',
    },
    { t: 'h', text: '1. Jalankan' },
    {
      t: 'code',
      title: 'Lokal (dev)',
      code: 'npm ci\nnpm run dev          # http://localhost:3000',
    },
    {
      t: 'code',
      title: 'Docker (sama seperti di cluster: read-only, nonroot)',
      code: 'docker build --pull -t devops-playground:1.0.0 .\ndocker run --rm -p 3000:3000 --read-only --tmpfs /tmp --tmpfs /app/.next/cache \\\n  --cap-drop ALL --security-opt no-new-privileges devops-playground:1.0.0',
    },
    {
      t: 'note',
      kind: 'info',
      text: 'Di **Git Bash (Windows)**, path seperti `/tmp` diubah otomatis menjadi path Windows dan `docker run` gagal. Awali dengan `export MSYS_NO_PATHCONV=1`.',
    },
    {
      t: 'code',
      title: 'Kubernetes',
      code: 'kubectl apply -f k8s/app.yaml\nkubectl -n playground rollout status deploy/playground\nkubectl -n playground port-forward svc/playground 3000:80',
    },
    {
      t: 'note',
      kind: 'warn',
      text: 'Ganti `image:` di `k8s/app.yaml` (`docker.io/your-dockerhub-user/devops-playground:1.0.0`, ganti `your-dockerhub-user` dengan username Docker Hub-mu) dengan image yang sudah kamu push. Namespace memakai Pod Security `restricted`, jadi pod harus nonroot dan tanpa capability.',
    },
    { t: 'h', text: '2. Pastikan sehat' },
    {
      t: 'check',
      title: 'Smoke test kontrak',
      command: 'BASE_URL={{BASE}} bash scripts/smoke.sh',
      expect: 'semua baris berawalan `PASS` dan skrip keluar dengan kode 0 (`echo $?` mencetak `0`).',
    },
    {
      t: 'check',
      title: 'Satu request manual',
      command: 'curl -s {{BASE}}/api/hello',
      expect: 'JSON `{"message":"hello","version":"dev","pod":...}`. Versi dan pod berasal dari env `APP_VERSION` dan `POD_NAME`.',
    },
    { t: 'h', text: '3. Tur dashboard' },
    {
      t: 'ul',
      items: [
        '**Overview**: identitas pod, status probe live, dependency, dan perilaku aktif dari env.',
        '**Skenario & endpoint**: katalog skenario deploy dan endpoint, lengkap dengan tombol salin `curl`.',
        '**Fault injection**: tombol chaos saat runtime (butuh token, lihat halaman Fault injection).',
        '**Docs** (halaman ini): panduan lengkap dan cara cek.',
      ],
    },
    { t: 'h', text: 'Struktur repo' },
    {
      t: 'table',
      head: ['Lokasi', 'Isi'],
      rows: [
        ['`src/app/api/*`', 'Semua endpoint (probe, hello, chain, secure, cache, chaos, dst.)'],
        ['`src/lib/*`', 'Logika bersama: state, behavior (env), chaos guard, jwt, cache, chain, dependency'],
        ['`k8s/app.yaml`', 'Deployment, Service, Ingress, HPA, PDB, NetworkPolicy, ConfigMap contoh'],
        ['`k8s/envoy-gateway/`', 'Gateway, HTTPRoute, dan policy Envoy Gateway + `test.sh`'],
        ['`k8s/kong/`', 'Plugin dan route Kong + `test.sh` (alternatif)'],
        ['`k8s/rollouts/`', 'Canary Argo Rollouts + analisis'],
        ['`k8s/chain/`', 'Rantai tiga tier (multi-hop)'],
        ['`scripts/smoke.sh`', 'Smoke test kontrak untuk CI/CD'],
        ['`loadtest/hello.js`', 'Beban k6 untuk uji zero-downtime'],
        ['`test/`', 'Unit dan route test (`npm test`)'],
      ],
    },
  ],
};
