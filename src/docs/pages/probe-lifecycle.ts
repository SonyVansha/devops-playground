import type { Doc } from '../types.ts';

export const doc: Doc = {
  slug: 'probe-lifecycle',
  title: 'Probe & lifecycle',
  summary: 'Liveness, readiness, startup, graceful shutdown, dan readiness yang bergantung pada dependency.',
  blocks: [
    { t: 'h', text: 'Tiga probe' },
    {
      t: 'table',
      head: ['Endpoint', '200 jika', '503 jika', 'Dipakai untuk'],
      rows: [
        ['`/api/healthz` (`/api/livez`)', 'proses sehat', 'toggle chaos `unhealthy`', 'livenessProbe (kubelet me-restart container)'],
        [
          '`/api/readyz`',
          'siap, sehat, tidak draining, dependency sehat',
          'toggle `notready`, `unhealthy`, **draining**, atau `DEPENDENCY_URL` gagal',
          'readinessProbe (pod keluar dari Endpoints, **tidak** di-restart)',
        ],
        ['`/api/startupz`', 'startup selesai', 'selama `STARTUP_DELAY_SECONDS`', 'startupProbe (menahan liveness saat start lambat)'],
      ],
    },
    {
      t: 'note',
      kind: 'info',
      text: 'Di `k8s/app.yaml`: startup tiap 2 dtk × 30 kali (maks 60 dtk), liveness tiap 10 dtk, readiness tiap 5 dtk. Liveness **sengaja tidak** bergantung pada dependency: dependency yang mati tidak boleh me-restart pod.',
    },
    {
      t: 'check',
      title: 'Ketiga probe sehat',
      command: 'for p in healthz readyz startupz; do echo "$p $(curl -s -o /dev/null -w \'%{http_code}\' {{BASE}}/api/$p)"; done',
      expect: 'tiga baris, masing-masing berakhir `200`.',
    },
    { t: 'h', text: 'Start lambat' },
    {
      t: 'code',
      code: 'kubectl -n playground set env deploy/playground STARTUP_DELAY_SECONDS=40\nkubectl -n playground get pods -w',
    },
    {
      t: 'p',
      text: 'Pod baru berstatus `Running` tetapi `0/1` (belum Ready) sampai 40 detik berlalu, dan **tidak** di-restart karena startupProbe menahan liveness. Sementara itu pod lama tetap melayani traffic.',
    },
    {
      t: 'check',
      title: 'Startup menahan readiness',
      command: 'kubectl -n playground get pods\ncurl -s -o /dev/null -w "%{http_code}\\n" {{BASE}}/api/startupz',
      expect: 'selama delay: pod baru `0/1`, `RESTARTS` tetap `0`. Setelah delay: `1/1` dan `/api/startupz` menjawab `200`.',
    },
    { t: 'h', text: 'Graceful shutdown (drain)' },
    {
      t: 'p',
      text: 'Urutan saat pod dihentikan: `preStop` (sleep 5 dtk) → SIGTERM → app menandai `ready=false` dan `draining=true` → tetap melayani request selama `DRAIN_SECONDS` (default 10) → exit 0. `terminationGracePeriodSeconds: 30` lebih besar dari 5 + 10 sehingga tidak kena SIGKILL. Butuh `NEXT_MANUAL_SIG_HANDLE=true` (sudah di Dockerfile dan manifest).',
    },
    {
      t: 'check',
      title: 'Drain di Docker (exit code 0)',
      command: 'docker run -d --name dp -p 3000:3000 devops-playground:1.0.0\nsleep 5\ndocker stop -t 20 dp\ndocker inspect -f "exit={{.State.ExitCode}}" dp\ndocker rm dp',
      expect: '`exit=0`. Jika `exit=137`, proses di-SIGKILL (periksa `NEXT_MANUAL_SIG_HANDLE` dan `DRAIN_SECONDS` lebih kecil dari grace period).',
    },
    {
      t: 'check',
      title: 'Drain di Kubernetes tanpa error',
      command: 'kubectl -n playground rollout restart deploy/playground\n# di terminal lain, selama rollout berjalan:\nk6 run -e BASE_URL={{BASE}} -e DURATION=1m loadtest/hello.js',
      expect: 'threshold k6 `http_req_failed` lulus (kurang dari 1% gagal): rolling update tanpa downtime.',
    },
    {
      t: 'check',
      title: 'Log drain',
      command: 'kubectl -n playground logs <nama-pod> | grep draining',
      expect: 'baris JSON `{"level":"info","msg":"signal received, draining","drainSeconds":10,...}`.',
    },
    { t: 'h', text: 'Readiness bergantung dependency' },
    {
      t: 'code',
      code: 'kubectl -n playground set env deploy/playground \\\n  DEPENDENCY_URL=http://tier-b.playground.svc.cluster.local/api/readyz',
    },
    {
      t: 'p',
      text: 'Setiap cek readiness memanggil `DEPENDENCY_URL` (timeout 1,5 dtk, hasil di-cache 2 dtk). Jika gagal, `/api/readyz` membalas 503 dengan field `dependency`. URL hanya dibaca dari env, bukan dari request.',
    },
    {
      t: 'check',
      title: 'Dependency mati → readiness turun, liveness tetap',
      command: 'kubectl -n playground scale deploy/tier-b --replicas=0\nsleep 5\ncurl -s -o /dev/null -w "readyz=%{http_code}\\n" {{BASE}}/api/readyz\ncurl -s -o /dev/null -w "healthz=%{http_code}\\n" {{BASE}}/api/healthz',
      expect: '`readyz=503` dan `healthz=200`; `kubectl get pods` menunjukkan `RESTARTS` tidak bertambah. Setelah tier-b hidup lagi, readyz kembali `200`.',
    },
  ],
};
