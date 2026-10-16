import type { Doc } from '../types.ts';

export const doc: Doc = {
  slug: 'api-gateway-kong',
  title: 'API gateway: Kong (alternatif)',
  summary: 'Untuk cluster yang memakai Kong: satu Service, dua halaman (blue/green), plugin rate-limit, key-auth, strip-path, CORS, dan header gateway.',
  blocks: [
    {
      t: 'note',
      kind: 'info',
      text: 'Halaman ini untuk cluster yang memakai **Kong**. Jika infra-mu memakai Envoy Gateway, ikuti halaman *API gateway (Envoy Gateway)*; skenario dan hasil yang diharapkan sejajar.',
    },
    {
      t: 'p',
      text: 'Satu image menyajikan dua halaman berbeda, `/blue` dan `/green`. Kong dipasang di depannya dengan plugin berbeda per route supaya kamu bisa memeriksa routing, autentikasi, rate limit, dan transformasi header.',
    },
    { t: 'h', text: 'Pasang' },
    {
      t: 'code',
      code: 'kubectl apply -f k8s/app.yaml\nkubectl apply -f k8s/kong/kong.yaml\n# ambil alamat proxy Kong, lalu:\nexport PROXY=http://<kong-proxy-ip>',
    },
    {
      t: 'note',
      kind: 'warn',
      text: 'Butuh Kong Ingress Controller (`ingressClassName: kong`). Nilai key di Secret `demo-user-apikey` hanyalah placeholder; ganti sebelum dipakai di luar lab. Semua request harus membawa header `Host: gateway.local`.',
    },
    {
      t: 'table',
      head: ['Route', 'Plugin Kong', 'Yang diuji'],
      rows: [
        ['`/blue`', 'rate-limiting (5/menit), request-transformer, correlation-id', '200 lalu 429, header `X-Gateway`, `X-Correlation-Id`'],
        ['`/green`', 'key-auth, cors, request-transformer, correlation-id', '401 tanpa key, 200 dengan header `apikey`'],
        ['`/gw/*`', 'strip-path', '`/gw/api/healthz` sampai ke app sebagai `/api/healthz`'],
        ['`/api/secure/whoami`', 'key-auth, request-transformer, correlation-id', 'identitas consumer diteruskan ke app'],
      ],
    },
    { t: 'h', text: 'Jalankan tes otomatis' },
    {
      t: 'check',
      title: 'Skrip tes Kong',
      command: 'PROXY=$PROXY API_KEY=$(kubectl -n playground get secret demo-user-apikey -o jsonpath=\'{.data.key}\' | base64 -d) \\\n  bash k8s/kong/test.sh',
      expect: 'baris `PASS` untuk: blue publik 200, green tanpa key 401, green key salah 401, green dengan key 200, strip-path 200, dan request ke-7+ ke `/blue` kena 429.',
    },
    { t: 'h', text: 'Cek manual satu per satu' },
    {
      t: 'check',
      title: 'Rate limit (/blue)',
      command: 'for i in $(seq 1 7); do curl -s -o /dev/null -w "%{http_code} " -H "Host: gateway.local" $PROXY/blue; done; echo',
      expect: '`200 200 200 200 200 429 429` (limit 5 per menit; tunggu 1 menit agar kuota pulih).',
    },
    {
      t: 'check',
      title: 'Autentikasi (/green)',
      command: 'curl -s -o /dev/null -w "tanpa key: %{http_code}\\n" -H "Host: gateway.local" $PROXY/green\ncurl -s -o /dev/null -w "dengan key: %{http_code}\\n" -H "Host: gateway.local" -H "apikey: <key>" $PROXY/green',
      expect: '`tanpa key: 401` dan `dengan key: 200`.',
    },
    {
      t: 'check',
      title: 'Header yang ditambahkan gateway',
      command: 'curl -s -H "Host: gateway.local" -H "apikey: <key>" $PROXY/api/secure/whoami?require=1',
      expect: '`"authenticated":true` dengan `consumer.username` = `demo-user`. Header `X-Gateway: kong` dan `X-Correlation-Id` muncul di `/api/gateway`.',
    },
    {
      t: 'check',
      title: 'Strip-path (/gw)',
      command: 'curl -s -H "Host: gateway.local" $PROXY/gw/api/gateway | grep -o \'"receivedPath":"[^"]*"\'',
      expect: '`"receivedPath":"/api/gateway"` (prefix `/gw` dibuang gateway), bukan `/gw/api/gateway`.',
    },
    {
      t: 'check',
      title: 'CORS preflight (/green)',
      command: 'curl -si -X OPTIONS -H "Host: gateway.local" -H "Origin: https://example.com" \\\n  -H "Access-Control-Request-Method: GET" $PROXY/green | grep -i access-control',
      expect: '`access-control-allow-origin: https://example.com`. Preflight dijawab plugin CORS **sebelum** key-auth, jadi tidak butuh key. Pembanding: `/api/cors?mode=app` membuat app yang menambah header itu.',
    },
    { t: 'h', text: 'Cache di gateway (contoh)' },
    {
      t: 'p',
      text: 'Untuk menguji cache gateway, pasang plugin `proxy-cache` pada route `/api/cache`, lalu lihat header `X-Cache-Status` (`Miss` lalu `Hit`). Contoh konfigurasi **belum diuji** di repo ini:',
    },
    {
      t: 'code',
      title: 'KongPlugin proxy-cache (contoh)',
      code: 'apiVersion: configuration.konghq.com/v1\nkind: KongPlugin\nmetadata:\n  name: proxy-cache\n  namespace: playground\nplugin: proxy-cache\nconfig:\n  response_code: [200]\n  request_method: [GET]\n  content_type: ["application/json"]\n  cache_ttl: 30\n  strategy: memory',
    },
    {
      t: 'note',
      kind: 'warn',
      text: '`X-Consumer-*` dipercaya apa adanya oleh app. Jika pod bisa diakses langsung (tanpa gateway), klien bisa memalsukannya. Batasi dengan NetworkPolicy agar hanya namespace Kong yang boleh masuk.',
    },
  ],
};
