import type { Doc } from '../types.ts';

export const doc: Doc = {
  slug: 'api-gateway-envoy',
  title: 'API gateway (Envoy Gateway)',
  summary: 'Routing, auth, rate limit, retry, timeout, dan kompresi lewat Gateway API dan policy Envoy Gateway, plus perilaku bawaan yang sering mengejutkan.',
  blocks: [
    {
      t: 'p',
      text: 'Envoy Gateway adalah implementasi **Gateway API** berbasis Envoy. Routing memakai objek standar (`Gateway`, `HTTPRoute`), sedangkan fitur tambahan (rate limit, auth, retry, kompresi) dipasang lewat policy `BackendTrafficPolicy`, `SecurityPolicy`, dan `ClientTrafficPolicy` yang menunjuk ke Gateway atau route.',
    },
    {
      t: 'note',
      kind: 'warn',
      text: 'Manifest di `k8s/envoy-gateway/` **belum dijalankan di cluster Envoy Gateway**. Yang sudah dilakukan: validasi terhadap skema CRD (18 resource valid, field yang salah ditolak) dan uji skrip `test.sh` sebagai kontrol negatif. `apiKeyAuth` dan `rateLimit.local` butuh Envoy Gateway yang cukup baru (sekitar 1.4 ke atas); cek dengan `kubectl explain securitypolicy.spec` dan `kubectl apply --dry-run=server`.',
    },
    { t: 'h', text: 'Perilaku bawaan yang perlu diketahui' },
    {
      t: 'table',
      head: ['Perilaku', 'Efek pada app ini', 'Cara mengubah'],
      rows: [
        [
          'Timeout route bawaan Envoy **15 detik**',
          '`/api/delay?ms=16000` dijawab 504 di detik ke-15, dan stream `/api/sse` yang lebih lama dari 15 detik terpotong tanpa event `done`',
          '`timeouts.request` pada rule `HTTPRoute` (`0s` = tanpa batas, cocok untuk streaming)',
        ],
        ['Header `x-envoy-*` tidak diteruskan ke app', '`/api/gateway` tidak menampilkan `x-envoy-attempt-count` dan sejenisnya', '`ClientTrafficPolicy` → `headers.enableEnvoyHeaders: true`'],
        ['`x-request-id` dibuat Envoy bila belum ada', 'tampil di `/api/gateway` dan diteruskan oleh `/api/chain` ke hop berikutnya', 'tidak perlu diatur'],
        ['`x-forwarded-port` berisi port listener Envoy (mis. `8080`), bukan port publik', 'terlihat di `/api/gateway`', 'jangan dipakai untuk membangun URL publik; pakai `x-forwarded-host` dan `x-forwarded-proto`'],
        ['IP klien diambil dari `x-forwarded-for`', 'IP benar hanya jika jumlah proxy tepercaya di depan Envoy (CDN, load balancer) diset', '`ClientTrafficPolicy` → `clientIPDetection.xForwardedFor.numTrustedHops`'],
        ['Rate limit `Local` dihitung **per replika Envoy**', 'dengan 2 replika Envoy, batas efektif bisa dua kali lipat', '`rateLimit.type: Global` (butuh Redis) untuk batas bersama'],
      ],
    },
    {
      t: 'check',
      title: 'Timeout route bawaan 15 detik',
      command: 'for ms in 8000 14000 16000; do\n  curl -s -o /dev/null -w "delay ${ms}ms -> HTTP %{http_code} setelah %{time_total}s\\n" "{{BASE}}/api/delay?ms=$ms"\ndone',
      expect: '8000 dan 14000 → `200`; 16000 → `504` setelah ±15 detik. Jika `504` muncul di detik 15 padahal app sehat, itu timeout route, bukan bug app. Setelah memasang `routes.yaml` (timeout 35 detik pada `/api/delay`), 16000 ms menjadi `200`.',
    },
    {
      t: 'check',
      title: 'Header yang ditambahkan proxy',
      command: 'curl -s {{BASE}}/api/gateway',
      expect: 'field `gateway` berisi `x-request-id` (dibuat Envoy), `x-forwarded-for`, `x-forwarded-host`, `x-forwarded-proto`, dan `x-forwarded-port`. Header `x-envoy-*` baru muncul setelah `enableEnvoyHeaders` diaktifkan.',
    },
    { t: 'h', text: 'Pasang' },
    {
      t: 'code',
      code: 'kubectl apply -f k8s/app.yaml\n# opsional, hanya bila cluster belum punya Gateway:\nkubectl apply -f k8s/envoy-gateway/gateway.yaml\nkubectl apply -f k8s/envoy-gateway/routes.yaml\n\n# alamat Gateway\nkubectl -n playground get gateway playground-gateway\nexport PROXY=http://<alamat-gateway>',
    },
    {
      t: 'note',
      kind: 'info',
      text: 'Di platform yang sudah menyediakan Gateway, lewati `gateway.yaml` dan ubah `parentRefs.name` di `routes.yaml` agar menunjuk ke Gateway milik platform. Semua route memakai host `gateway.local`; sesuaikan `hostnames`. Nilai API key di Secret `demo-apikeys` hanyalah placeholder.',
    },
    {
      t: 'table',
      head: ['Route', 'Resource', 'Yang diuji'],
      rows: [
        ['`/blue`', 'HTTPRoute + BackendTrafficPolicy (rate limit 5/menit) + header `X-Gateway`', '200 lalu 429; header `x-gateway` tampil di halaman'],
        ['`/green`', 'HTTPRoute + SecurityPolicy (apiKeyAuth + CORS)', '401 tanpa key, 200 dengan header `apikey`, preflight CORS'],
        ['`/gw/*`', 'HTTPRoute + filter `URLRewrite`', 'prefix `/gw` dibuang sebelum sampai ke app'],
        ['`/api/secure/whoami`', 'HTTPRoute + SecurityPolicy (apiKeyAuth)', 'identitas klien diteruskan lewat `x-client-id`'],
        ['`/api/flaky`', 'HTTPRoute + BackendTrafficPolicy (retry)', 'kegagalan turun dari ±30% menjadi mendekati 0'],
        ['`/api/delay`', 'HTTPRoute (`timeouts.request: 35s`)', 'request 20 detik lolos'],
        ['`/api/sse`', 'HTTPRoute (`timeouts.request: 0s`)', 'stream 18 detik tidak terpotong'],
        ['`/api/cache`', 'HTTPRoute + BackendTrafficPolicy (compression)', '`Content-Encoding: gzip` dari gateway'],
        ['`/api/cookie`', 'HTTPRoute + BackendTrafficPolicy (consistent hash cookie)', 'sticky session (butuh ≥ 2 replika)'],
      ],
    },
    {
      t: 'check',
      title: 'Skrip tes otomatis',
      command: 'PROXY=$PROXY API_KEY=$(kubectl -n playground get secret demo-apikeys -o jsonpath=\'{.data.demo-user}\' | base64 -d) \\\n  bash k8s/envoy-gateway/test.sh\n# tambah SLOW=1 untuk tes timeout dan streaming (±40 detik)',
      expect: 'baris `PASS` untuk header gateway, rate limit (429 setelah 5 request), key salah/benar, CORS, strip-path, identitas, retry, kompresi, dan sticky session. Skrip keluar dengan kode non-nol bila ada yang `FAIL`. Dijalankan ke infra tanpa route ini, skrip melaporkan FAIL untuk retry (±28% gagal), timeout (504), dan streaming (15 event), jadi ia benar-benar membedakan.',
    },
    { t: 'h', text: 'Cek manual satu per satu' },
    {
      t: 'check',
      title: 'Rate limit (/blue)',
      command: 'for i in $(seq 1 7); do curl -s -o /dev/null -w "%{http_code} " -H "Host: gateway.local" $PROXY/blue; done; echo',
      expect: '`200 200 200 200 200 429 429`. Kuota 5 per menit; tunggu 60 detik agar pulih.',
    },
    {
      t: 'check',
      title: 'Retry menutupi kegagalan acak (/api/flaky)',
      command: 'for i in $(seq 1 60); do curl -s -o /dev/null -w "%{http_code}\\n" -H "Host: gateway.local" "$PROXY/api/flaky?rate=30&status=503"; done | sort | uniq -c',
      expect: 'hampir semua `200` (peluang gagal 0,3⁴ ≈ 0,8% per request). Tanpa policy retry, sekitar 18 dari 60 gagal.',
    },
    {
      t: 'check',
      title: 'Stream panjang tidak terpotong (/api/sse)',
      command: 'curl -sN -H "Host: gateway.local" "$PROXY/api/sse?events=18&interval=1000" | grep -c "^id:"',
      expect: '`18` dan akhirnya muncul `event: done`. Tanpa `timeouts.request: 0s`, hanya 15 event yang tiba.',
    },
    {
      t: 'check',
      title: 'Kompresi dari gateway (/api/cache)',
      command: 'curl -s -D - -o /dev/null -H "Host: gateway.local" -H "Accept-Encoding: gzip" "$PROXY/api/cache?kb=200" | grep -i content-encoding',
      expect: '`content-encoding: gzip`. App sendiri tidak mengompres kecuali `gzip=1`, jadi header ini berasal dari gateway (atau CDN di depannya, jika ada).',
    },
    { t: 'h', text: 'Identitas ke app' },
    {
      t: 'p',
      text: 'Nama header identitas ditentukan oleh policy, jadi `/api/secure/whoami` memantau beberapa nama bawaan: `x-consumer-username` (Kong), `x-client-id` (`apiKeyAuth.forwardClientIDHeader`), `x-user` (`basicAuth.forwardUsernameHeader`), dan `x-forwarded-user`. Untuk nama lain, mis. klaim JWT lewat `claimToHeaders`, atur env `IDENTITY_HEADERS` (dipisah koma, urutan = prioritas).',
    },
    {
      t: 'check',
      title: 'Identitas dari API key',
      command: 'curl -s -H "Host: gateway.local" -H "apikey: <key>" "$PROXY/api/secure/whoami?require=1"',
      expect: '`"authenticated":true`, `"identityHeader":"x-client-id"`, dan `consumer.username` berisi ID klien dari Secret (`demo-user`). Tanpa key, gateway membalas 401 sebelum sampai ke app.',
    },
    {
      t: 'note',
      kind: 'warn',
      text: 'Header identitas dipercaya apa adanya oleh app. Jika pod bisa diakses langsung tanpa lewat Envoy, klien bisa memalsukannya. Batasi dengan NetworkPolicy yang hanya mengizinkan namespace proxy (mis. `envoy-gateway-system`), dan pastikan gateway menghapus header yang sama dari request klien.',
    },
    { t: 'h', text: 'Contoh policy lain (belum diuji)' },
    {
      t: 'p',
      text: 'Cuplikan berikut mengikuti dokumentasi Envoy Gateway tetapi **belum diuji** di repo ini; sesuaikan field dengan versi di clustermu.',
    },
    {
      t: 'code',
      title: 'SecurityPolicy basic auth dan JWT (contoh)',
      code: 'apiVersion: gateway.envoyproxy.io/v1alpha1\nkind: SecurityPolicy\nmetadata:\n  name: playground-secure-example\n  namespace: playground\nspec:\n  targetRefs:\n    - group: gateway.networking.k8s.io\n      kind: HTTPRoute\n      name: playground-whoami\n  basicAuth:\n    users:\n      name: basic-auth-users        # Secret berisi file .htpasswd\n    forwardUsernameHeader: x-user\n  # atau JWT:\n  # jwt:\n  #   providers:\n  #     - name: demo\n  #       remoteJWKS:\n  #         uri: https://issuer.example.com/.well-known/jwks.json\n  #       claimToHeaders:\n  #         - claim: sub\n  #           header: x-jwt-sub     # lalu set IDENTITY_HEADERS=x-jwt-sub',
    },
    {
      t: 'code',
      title: 'BackendTrafficPolicy fault injection (contoh)',
      code: 'apiVersion: gateway.envoyproxy.io/v1alpha1\nkind: BackendTrafficPolicy\nmetadata:\n  name: playground-fault-example\n  namespace: playground\nspec:\n  targetRefs:\n    - group: gateway.networking.k8s.io\n      kind: HTTPRoute\n      name: playground-flaky\n  faultInjection:\n    delay:\n      fixedDelay: 2s\n      percentage: 20\n    abort:\n      httpStatus: 503\n      percentage: 10',
    },
    {
      t: 'code',
      title: 'NetworkPolicy: hanya proxy yang boleh mengakses pod (contoh)',
      code: 'apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: allow-envoy-only\n  namespace: playground\nspec:\n  podSelector:\n    matchLabels: {app: playground}\n  policyTypes: [Ingress]\n  ingress:\n    - from:\n        - namespaceSelector:\n            matchLabels:\n              kubernetes.io/metadata.name: envoy-gateway-system\n      ports:\n        - port: 3000',
    },
  ],
};
