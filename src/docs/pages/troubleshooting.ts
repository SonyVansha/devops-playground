import type { Doc } from '../types.ts';

export const doc: Doc = {
  slug: 'troubleshooting',
  title: 'Troubleshooting',
  summary: 'Gejala umum, penyebab, dan cara memperbaikinya.',
  blocks: [
    {
      t: 'table',
      head: ['Gejala', 'Kemungkinan penyebab', 'Perbaikan'],
      rows: [
        [
          'Namespace, Node, atau IP pod kosong ("tidak tersedia") di dashboard',
          'platform tidak menyuntikkan env downward API (`POD_NAMESPACE`, `NODE_NAME`, `POD_IP`); app memakai manifest milik platform, bukan `k8s/app.yaml`',
          'nama pod dan IP kini diambil otomatis; namespace dari file service account bila ter-mount. Untuk nama node, tambahkan env `NODE_NAME` dari `spec.nodeName` (downward API) jika platform mengizinkan',
        ],
        [
          'Request lambat dijawab `504` tepat di ±15 detik padahal app sehat',
          'timeout route bawaan Envoy (15 detik); ini timeout proxy, bukan bug app',
          'naikkan `timeouts.request` pada rule HTTPRoute (halaman API gateway Envoy Gateway); verifikasi dengan `curl {{BASE}}/api/delay?ms=16000`',
        ],
        [
          'Stream (SSE) terputus di ±15 detik tanpa event `done`',
          'timeout route Envoy berlaku untuk seluruh respons, termasuk streaming',
          '`timeouts.request: 0s` pada route yang melayani stream',
        ],
        [
          '`/api/secure/whoami` tidak mengenali identitas dari gateway',
          'nama header identitas dari gateway berbeda dari yang dipantau app',
          'lihat `watchedHeaders` pada responsnya; atur env `IDENTITY_HEADERS` sesuai `forwardClientIDHeader`/`forwardUsernameHeader`/`claimToHeaders`',
        ],
        [
          'Rate limit Envoy Gateway: 429 muncul lebih lambat dari batas yang dipasang',
          'rate limit `Local` dihitung per replika Envoy, jadi batas efektif = batas × jumlah replika',
          'turunkan batas per replika atau pakai `rateLimit.type: Global` (butuh Redis)',
        ],
        ['Semua pod menyebut diri `0.0.0.0`', 'versi lama memakai env `HOSTNAME` (alamat bind) sebagai nama pod', 'gunakan versi terbaru: nama pod diambil dari hostname OS. Cek `curl {{BASE}}/api/info` → `podName` dan `identitySource`'],
        ['Pod `CrashLoopBackOff` sejak awal', '`BOOT_FAIL=true` atau `CRASH_AFTER_SECONDS` tertinggal di env', '`kubectl -n playground get deploy playground -o yaml | grep -A1 -E "BOOT_FAIL|CRASH_AFTER"`; hapus dengan `set env ... BOOT_FAIL-`'],
        ['`Cannot find module ...` saat start container', 'file Next terbuang dari output standalone (mis. `@swc/helpers` ikut di-exclude)', 'jangan exclude `@swc/helpers`; build ulang dan cek `docker logs`'],
        ['Container tidak bisa diakses dari luar / probe gagal di K8s', '`HOSTNAME` dari Kubernetes (nama pod) dipakai Next sebagai alamat bind', 'set env `HOSTNAME=0.0.0.0` (sudah ada di manifest)'],
        ['`readyz` 503 padahal app sehat', '`draining`, toggle `notready`, atau `DEPENDENCY_URL` gagal', '`curl {{BASE}}/api/readyz` dan lihat field `dependency`, `draining`'],
        ['Pod `0/1` lama saat start', '`STARTUP_DELAY_SECONDS` aktif atau startupProbe belum lulus', 'cek `curl {{BASE}}/api/startupz` dan env perilaku di tab Overview'],
        ['Chaos selalu `403`', '`ENABLE_CHAOS` bukan `true` atau `CHAOS_TOKEN` kosong', '`curl {{BASE}}/api/chaos` → lihat `enabled` dan `tokenConfigured`'],
        ['Chaos `401`', 'header `X-Chaos-Token` salah/kosong', 'ambil ulang token dari Secret `playground-chaos`'],
        ['Chaos `409`', '`?pod=` menunjuk pod lain', 'ulangi request atau `port-forward` langsung ke pod'],
        ['`/api/connect` selalu `403`', '`CONNECT_ALLOWLIST` kosong atau host tidak terdaftar', 'tambahkan host ke env (dipisah koma)'],
        ['`/api/secure/jwt` selalu `verified:null`', '`JWT_SECRET` belum di-set di pod', 'buat Secret `playground-auth` lalu `rollout restart`'],
        ['`/api/secure/basic` `503`', '`BASIC_USER`/`BASIC_PASSWORD` belum di-set', 'isi Secret `playground-auth`'],
        ['`/api/config` `"mounted":false`', 'ConfigMap tidak ada atau `CONFIG_DIR` salah', '`kubectl -n playground get cm playground-config`'],
        ['`/api/chain` `502` padahal tier bawah sehat', '`UPSTREAM_URL` salah / Service tidak punya Endpoints / timeout < latency', 'cek field `downstream.error`: `ECONNREFUSED`, `ENOTFOUND`, atau `TIMEOUT` (naikkan `CHAIN_TIMEOUT_MS`)'],
        ['Rate limit Kong tidak terlihat (tidak ada 429)', 'request tidak membawa `Host: gateway.local` atau lewat route lain', 'tambahkan header Host; cek `kubectl get ingress -n playground`'],
        ['Kuota rate limit "tidak reset"', 'limit 5 per **menit**, tes sebelumnya masih terhitung', 'tunggu 60 detik sebelum menjalankan `test.sh` lagi'],
        ['Rollout Argo tidak jalan setelah `set env`', 'perubahan dilakukan di Rollout, bukan Deployment (`workloadRef`)', 'ubah Deployment `playground`; Rollout membaca templatenya'],
        ['`docker run` gagal: `invalid mount path: C`', 'Git Bash mengubah `/tmp` jadi path Windows', '`export MSYS_NO_PATHCONV=1`'],
        ['`curl -w "%{size_download}"` bernilai 0 di Windows', '`-o /dev/null` tidak valid untuk curl Windows', 'pakai `-o NUL`'],
        ['Hit cache gateway tidak terjadi', 'respons `no-store`/`private`, atau `Vary` membuat kunci berbeda per klien', 'cek `Cache-Control` dan `Vary` di `/api/cache`; samakan header request antar panggilan'],
      ],
    },
    {
      t: 'check',
      title: 'Diagnosis cepat di Kubernetes',
      command: 'kubectl -n playground get pods -o wide\nkubectl -n playground describe pod <nama-pod> | sed -n \'/Events:/,$p\'\nkubectl -n playground logs <nama-pod> --previous\nkubectl -n playground get endpoints playground',
      expect: 'Events menjelaskan alasan (probe gagal, OOMKilled, ImagePullBackOff). `--previous` menampilkan log container sebelum restart. `endpoints` kosong berarti tidak ada pod Ready di belakang Service.',
    },
    {
      t: 'note',
      kind: 'info',
      text: 'Masih buntu? Buka tab **Overview** di dashboard: identitas pod, status probe, dependency, dan perilaku aktif tampil di satu tempat, dan itu yang paling sering menjawab "kenapa pod ini begini".',
    },
  ],
};
