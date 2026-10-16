import type { Doc } from '../types.ts';

export const doc: Doc = {
  slug: 'multi-hop',
  title: 'Multi-hop & dependency',
  summary: 'Rantai tier-a → tier-b → tier-c: propagasi trace, kegagalan berantai, dan readiness berbasis dependency.',
  blocks: [
    {
      t: 'p',
      text: '`/api/chain?depth=N` membuat app memanggil app berikutnya (dari env `UPSTREAM_URL`) sebanyak N hop. Cocok untuk menguji service-to-service, service mesh, propagasi trace, timeout, dan kegagalan berantai.',
    },
    { t: 'h', text: 'Pasang tiga tier' },
    {
      t: 'code',
      code: 'kubectl apply -f k8s/chain/chain.yaml\nkubectl -n playground get pods -l "app in (tier-a,tier-b,tier-c)"\nkubectl -n playground port-forward svc/tier-a 3000:80',
    },
    {
      t: 'table',
      head: ['Tier', 'UPSTREAM_URL', 'DEPENDENCY_URL (readiness)'],
      rows: [
        ['tier-a', 'tier-b', 'tier-b `/api/readyz`'],
        ['tier-b', 'tier-c', 'tier-c `/api/readyz`'],
        ['tier-c', '(tidak ada, leaf)', '(tidak ada)'],
      ],
    },
    { t: 'h', text: 'Cek rantai sehat' },
    {
      t: 'check',
      title: 'Tiga hop dengan trace yang sama',
      command: 'curl -s -H "traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01" \\\n  -H "x-request-id: req-42" "{{BASE}}/api/chain?depth=2" | grep -oE \'"(pod|traceId|requestId)":"[^"]*"\'',
      expect: 'tiga pod berurutan (`tier-a`, `tier-b`, `tier-c`), `traceId` identik `0af7651916cd43dd8448eb211c80319c` di semua hop, dan `requestId` = `req-42`. Tiap hop punya `spanId` berbeda, dan `parentSpanId` hop berikutnya = `spanId` hop di atasnya.',
    },
    {
      t: 'note',
      kind: 'info',
      text: 'Tanpa header `traceparent`, hop pertama membuat `traceId` baru. Header lain yang diteruskan: `tracestate`, `b3`, `x-b3-*`, `x-correlation-id`. Kedalaman dibatasi 5 hop.',
    },
    { t: 'h', text: 'Kegagalan berantai' },
    { t: 'code', code: 'kubectl -n playground scale deploy/tier-c --replicas=0' },
    {
      t: 'check',
      title: '502 menjalar ke atas, readiness turun, tanpa restart',
      command: 'curl -s -o /dev/null -w "chain=%{http_code}\\n" "{{BASE}}/api/chain?depth=2"\ncurl -s -o /dev/null -w "readyz=%{http_code}\\n" {{BASE}}/api/readyz\ncurl -s -o /dev/null -w "healthz=%{http_code}\\n" {{BASE}}/api/healthz\nkubectl -n playground get pods',
      expect: '`chain=502`, `readyz=503`, `healthz=200`, dan kolom `RESTARTS` semua `0`. Body 502 memuat `"error":"downstream failed"` dengan detail di `downstream`. Tier yang bergantung (b lalu a) berstatus `0/1` namun tidak di-restart.',
    },
    { t: 'code', code: 'kubectl -n playground scale deploy/tier-c --replicas=1' },
    {
      t: 'check',
      title: 'Pulih otomatis',
      command: 'sleep 15; curl -s -o /dev/null -w "chain=%{http_code} readyz=%{http_code}\\n" "{{BASE}}/api/chain?depth=2"',
      expect: '`chain=200` dan semua pod `1/1` kembali tanpa intervensi.',
    },
    { t: 'h', text: 'Timeout dan latency' },
    {
      t: 'code',
      code: 'kubectl -n playground set env deploy/tier-c LATENCY_MS=5000\n# default CHAIN_TIMEOUT_MS=3000 -> hop di atasnya time out',
    },
    {
      t: 'check',
      title: 'Hop lambat terdeteksi',
      command: 'curl -s -w "\\nHTTP %{http_code} dalam %{time_total}s\\n" "{{BASE}}/api/chain?depth=2"',
      expect: 'HTTP `502` dengan `"downstream":{"error":"TIMEOUT"}` dalam ±3 detik (bukan 5), sesuai `CHAIN_TIMEOUT_MS`. Naikkan nilainya (maks 30000) untuk menguji timeout yang lebih longgar.',
    },
    {
      t: 'note',
      kind: 'ok',
      text: 'Keamanan: `UPSTREAM_URL` dan `DEPENDENCY_URL` hanya dibaca dari env, tidak pernah dari parameter request, sehingga endpoint ini tidak bisa dipakai untuk SSRF. Untuk tes konektivitas ke host lain, pakai `/api/connect` (lihat Jaringan & config).',
    },
  ],
};
