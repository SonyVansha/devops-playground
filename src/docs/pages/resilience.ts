import type { Doc } from '../types.ts';

export const doc: Doc = {
  slug: 'resilience',
  title: 'Resilience & batas proxy',
  summary: 'Status code, delay, kegagalan acak, streaming SSE, payload besar, redirect, CORS, dan cookie.',
  blocks: [
    { t: 'h', text: 'Status code dan delay' },
    {
      t: 'check',
      title: 'Status code apa pun (200–599)',
      command: 'for c in 200 404 429 500 503 504; do echo "$c -> $(curl -s -o /dev/null -w \'%{http_code}\' {{BASE}}/api/status/$c)"; done',
      expect: 'tiap kode dibalas persis sama. Kode di luar 200–599 atau bukan angka dibalas `400`. Berguna untuk menguji retry, halaman error, alert, dan outlier detection.',
    },
    {
      t: 'check',
      title: 'Delay terkendali',
      command: 'curl -s -o /dev/null -w "%{time_total}s\\n" "{{BASE}}/api/delay?ms=2000"',
      expect: '≈ `2.0s`. Maksimal 30000 ms. Untuk uji timeout, set delay sedikit di atas timeout gateway/ingress dan pastikan responsnya 504/timeout. Di belakang Envoy/Envoy Gateway, timeout route bawaan adalah 15 detik: `ms=16000` dijawab `504` di detik ke-15 walau app sehat (lihat halaman API gateway Envoy Gateway untuk mengubahnya).',
    },
    { t: 'h', text: 'Kegagalan acak (retry, circuit breaker)' },
    {
      t: 'check',
      title: 'Flaky 30%',
      command: 'for i in $(seq 1 50); do curl -s -o /dev/null -w "%{http_code}\\n" "{{BASE}}/api/flaky?rate=30&status=503"; done | sort | uniq -c',
      expect: 'campuran `200` dan `503` dengan 503 kira-kira 30% (acak). `rate=0` selalu 200, `rate=100` selalu gagal dengan status yang diminta (400–599).',
    },
    { t: 'h', text: 'Streaming (SSE)' },
    {
      t: 'check',
      title: 'Event datang satu per satu',
      command: 'curl -N "{{BASE}}/api/sse?events=5&interval=1000"',
      expect: 'lima event `id: 1..5` muncul **satu per detik** (bukan sekaligus di akhir), ditutup `event: done`. Jika semuanya muncul bersamaan, ada proxy yang mem-buffer respons (matikan buffering atau cek `X-Accel-Buffering`). Stream yang lebih lama dari timeout route proxy akan terputus tanpa `event: done` (Envoy: 15 detik secara bawaan; coba `events=20&interval=1000`).',
    },
    { t: 'h', text: 'Payload besar' },
    {
      t: 'check',
      title: 'Respons besar dan upload',
      command: 'curl -s "{{BASE}}/api/payload?kb=1024" | wc -c\nhead -c 3000000 /dev/zero | curl -s -X POST --data-binary @- {{BASE}}/api/payload',
      expect: 'baris pertama `1048576`. Upload 3 MB mengembalikan `{"receivedBytes":3000000}`. Jika gateway/ingress punya batas ukuran body (mis. `client_max_body_size`), request yang lebih besar dari batas itu dijawab `413` oleh proxy, bukan oleh app (batas app sendiri 20 MB).',
    },
    { t: 'h', text: 'Redirect' },
    {
      t: 'check',
      title: 'Rantai redirect relatif',
      command: 'curl -si "{{BASE}}/api/redirect?n=3&code=302" | grep -iE "^(HTTP|location)"\ncurl -sL -o /dev/null -w "akhir: %{http_code}, redirect: %{num_redirects}\\n" "{{BASE}}/api/redirect?n=3"\ncurl -sL --max-redirs 5 -o /dev/null -w "loop: %{http_code}\\n" "{{BASE}}/api/redirect?loop=1"',
      expect: '`HTTP/1.1 302` dengan `location: redirect?n=2&code=302` (relatif, tanpa host internal). Mengikuti redirect: `akhir: 200, redirect: 3`. Loop: curl berhenti dengan error "Maximum redirects followed".',
    },
    { t: 'h', text: 'CORS' },
    {
      t: 'check',
      title: 'App tidak menambah CORS (gateway yang harus)',
      command: 'curl -si -X OPTIONS -H "Origin: https://example.com" -H "Access-Control-Request-Method: GET" {{BASE}}/api/cors | grep -iE "^HTTP|access-control"\ncurl -si -X OPTIONS -H "Origin: https://example.com" "{{BASE}}/api/cors?mode=app" | grep -i access-control',
      expect: 'tanpa `mode=app`: `HTTP 204` dan **tidak ada** header `access-control-*` (jika muncul, berarti gateway yang menambahkannya). Dengan `mode=app`: `access-control-allow-origin: *`.',
    },
    { t: 'h', text: 'Cookie dan sticky session' },
    {
      t: 'check',
      title: 'Cookie jar',
      command: 'curl -s -c jar.txt "{{BASE}}/api/cookie?name=sid&value=abc123"\ncurl -s -b jar.txt {{BASE}}/api/cookie\ncurl -si "{{BASE}}/api/cookie?name=sid&value=x" -H "x-forwarded-proto: https" | grep -i set-cookie',
      expect: 'request kedua menampilkan `"cookieNames":["sid"]` beserta nama `pod`. Untuk sticky session, ulangi dengan `-b jar.txt` dan pastikan `pod` selalu sama. `Set-Cookie` berisi `HttpOnly; SameSite=Lax`, ditambah `Secure` bila `x-forwarded-proto: https`. Nama dan nilai cookie dibatasi `[A-Za-z0-9_-]{1,32}`.',
    },
  ],
};
