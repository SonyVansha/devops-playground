import type { Lang } from '../../i18n/core.ts';

// Teks dua bahasa untuk satu butir data. Nama env, path, dan perintah tidak diterjemahkan.
export type L = Record<Lang, string>;

export interface Endpoint {
  title: L;
  method: string;
  path: string;
  simulates: L;
  verify: L;
  headers?: Record<string, string>;
}

export interface Group {
  id: string;
  name: L;
  items: Endpoint[];
}

export interface DeployScenario {
  title: L;
  env: string;
  expect: L;
}

export const SCENARIO_GROUP: L = { en: 'Deploy scenarios', id: 'Skenario deploy' };

export const ENDPOINTS: readonly Group[] = [
  {
    id: 'workload',
    name: { en: 'Workload & rollout', id: 'Workload & rollout' },
    items: [
      {
        title: { en: 'Hello (business endpoint)', id: 'Hello (endpoint bisnis)' },
        method: 'GET',
        path: '/api/hello',
        simulates: { en: 'Real application traffic; affected by ERROR_RATE and LATENCY_MS.', id: 'Traffic aplikasi nyata; dipengaruhi ERROR_RATE dan LATENCY_MS.' },
        verify: { en: 'Success rate and latency per version in canary analysis or the dashboard.', id: 'Success rate dan latency per versi di canary analysis / dashboard.' },
      },
      {
        title: { en: 'Pod identity', id: 'Identitas pod' },
        method: 'GET',
        path: '/api/info',
        simulates: { en: 'Version, pod, node, uptime, active behavior.', id: 'Versi, pod, node, uptime, perilaku aktif.' },
        verify: { en: 'The new version appears after a rollout; pods are evenly distributed.', id: 'Versi baru muncul setelah rollout; distribusi pod merata.' },
      },
      {
        title: { en: 'Metrics', id: 'Metrics' },
        method: 'GET',
        path: '/api/metrics',
        simulates: { en: 'Prometheus scrape target.', id: 'Target scrape Prometheus.' },
        verify: { en: 'The ServiceMonitor is scraped; the 5xx alert fires.', id: 'ServiceMonitor ter-scrape; alert 5xx jalan.' },
      },
    ],
  },
  {
    id: 'probes',
    name: { en: 'Probes & lifecycle', id: 'Probe & lifecycle' },
    items: [
      {
        title: { en: 'Liveness', id: 'Liveness' },
        method: 'GET',
        path: '/api/healthz',
        simulates: { en: 'Liveness probe.', id: 'Livenessprobe.' },
        verify: { en: 'The kubelet restarts the container on 503.', id: 'Kubelet restart container saat 503.' },
      },
      {
        title: { en: 'Readiness', id: 'Readiness' },
        method: 'GET',
        path: '/api/readyz',
        simulates: { en: 'Readiness; 503 while draining.', id: 'Readiness; 503 saat draining.' },
        verify: { en: 'The pod leaves Endpoints; no 5xx during a rolling update.', id: 'Pod keluar dari Endpoints; tidak ada 5xx saat rolling update.' },
      },
      {
        title: { en: 'Startup', id: 'Startup' },
        method: 'GET',
        path: '/api/startupz',
        simulates: { en: 'Startup probe; 503 for STARTUP_DELAY_SECONDS.', id: 'Startup probe; 503 selama STARTUP_DELAY_SECONDS.' },
        verify: { en: 'Liveness does not kill an app that starts slowly.', id: 'Liveness tidak membunuh app yang start lambat.' },
      },
    ],
  },
  {
    id: 'service',
    name: { en: 'Service-to-service & dependency', id: 'Service-to-service & dependency' },
    items: [
      {
        title: { en: 'Multi-hop', id: 'Multi-hop' },
        method: 'GET',
        path: '/api/chain?depth=3',
        simulates: { en: 'The app calls the next app (UPSTREAM_URL) for depth hops.', id: 'App memanggil app berikutnya (UPSTREAM_URL) sebanyak depth hop.' },
        verify: {
          en: 'All hops share the same traceId; trace and request-id headers reach the last hop.',
          id: 'Semua hop punya traceId sama; header trace/request-id sampai ke hop terakhir.',
        },
        headers: { traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01' },
      },
      {
        title: { en: 'Cascading failure', id: 'Kegagalan berantai' },
        method: 'GET',
        path: '/api/chain?depth=2',
        simulates: { en: 'A downstream hop is down or slow (CHAIN_TIMEOUT_MS).', id: 'Hop di bawah mati atau lambat (CHAIN_TIMEOUT_MS).' },
        verify: {
          en: '502 propagates upward with details from downstream; alerts and timeouts work.',
          id: '502 menjalar ke atas dengan detail di downstream; alert dan timeout bekerja.',
        },
      },
      {
        title: { en: 'Readiness + dependency', id: 'Readiness + dependency' },
        method: 'GET',
        path: '/api/readyz',
        simulates: {
          en: 'Readiness fails when DEPENDENCY_URL is unhealthy (liveness stays 200).',
          id: 'Readiness gagal bila DEPENDENCY_URL tidak sehat (liveness tetap 200).',
        },
        verify: {
          en: 'The pod leaves Endpoints without a restart; it becomes ready again when the dependency recovers.',
          id: 'Pod keluar dari Endpoints, tidak di-restart; kembali ready saat dependency pulih.',
        },
      },
    ],
  },
  {
    id: 'auth',
    name: { en: 'Authentication & identity', id: 'Autentikasi & identitas' },
    items: [
      {
        title: { en: 'Identity from the gateway', id: 'Identitas dari gateway' },
        method: 'GET',
        path: '/api/secure/whoami?require=1',
        simulates: {
          en: 'The gateway forwards the client identity (Kong: X-Consumer-*, Envoy Gateway: headers from a SecurityPolicy, e.g. x-client-id).',
          id: 'Gateway meneruskan identitas klien (Kong: X-Consumer-*, Envoy Gateway: header dari SecurityPolicy, mis. x-client-id).',
        },
        verify: {
          en: '401 without credentials; 200 with the consumer filled in through the gateway.',
          id: '401 tanpa kredensial; 200 dan consumer terisi lewat gateway.',
        },
        headers: { apikey: '<api-key>' },
      },
      {
        title: { en: 'JWT claims', id: 'Klaim JWT' },
        method: 'GET',
        path: '/api/secure/jwt',
        simulates: { en: 'Bearer JWT; HS256 verification when JWT_SECRET is set.', id: 'Bearer JWT; verifikasi HS256 bila JWT_SECRET di-set.' },
        verify: {
          en: 'Claims are readable; a bad signature or an expired token gets 401.',
          id: 'Klaim terbaca; signature salah atau token kedaluwarsa dibalas 401.',
        },
        headers: { Authorization: 'Bearer <jwt>' },
      },
      {
        title: { en: 'Basic auth in the app', id: 'Basic auth di app' },
        method: 'GET',
        path: '/api/secure/basic',
        simulates: { en: 'Application-level basic auth (BASIC_USER, BASIC_PASSWORD).', id: 'Basic auth level aplikasi (BASIC_USER, BASIC_PASSWORD).' },
        verify: {
          en: '401 + WWW-Authenticate without credentials; 200 with the right ones.',
          id: '401 + WWW-Authenticate tanpa kredensial; 200 dengan kredensial benar.',
        },
        headers: { Authorization: 'Basic <base64 user:pass>' },
      },
    ],
  },
  {
    id: 'caching',
    name: { en: 'Caching', id: 'Caching' },
    items: [
      {
        title: { en: 'Public cache + ETag', id: 'Cache publik + ETag' },
        method: 'GET',
        path: '/api/cache?ttl=60&v=1',
        simulates: {
          en: 'Cache-Control public, with the same ETag and Last-Modified on every pod.',
          id: 'Cache-Control public, ETag dan Last-Modified yang sama di semua pod.',
        },
        verify: {
          en: 'A repeat request is served from cache (generatedAt does not change); If-None-Match returns 304.',
          id: 'Request ulang dari cache (generatedAt tidak berubah); If-None-Match menghasilkan 304.',
        },
      },
      {
        title: { en: 'Shared cache + SWR', id: 'Cache shared + SWR' },
        method: 'GET',
        path: '/api/cache?ttl=30&mode=swr&smax=120&vary=accept-encoding',
        simulates: { en: 's-maxage, stale-while-revalidate, Vary.', id: 's-maxage, stale-while-revalidate, Vary.' },
        verify: {
          en: 'The gateway or CDN honors s-maxage and creates a variant per Accept-Encoding.',
          id: 'Gateway/CDN menghormati s-maxage dan membuat varian per Accept-Encoding.',
        },
      },
      {
        title: { en: 'No cache', id: 'Tanpa cache' },
        method: 'GET',
        path: '/api/cache?mode=nostore',
        simulates: { en: 'Cache-Control no-store.', id: 'Cache-Control no-store.' },
        verify: { en: 'Never cached; no ETag.', id: 'Tidak pernah di-cache; tidak ada ETag.' },
      },
      {
        title: { en: 'Compression', id: 'Compression' },
        method: 'GET',
        path: '/api/cache?kb=512&v=big&gzip=1',
        simulates: {
          en: 'A highly compressible 512 KB body; uncompressed by default, compressed by the app with gzip=1.',
          id: 'Body 512 KB sangat kompresibel; default tidak dikompres, gzip=1 dikompres oleh app.',
        },
        verify: {
          en: 'Without gzip=1: the gateway or ingress must compress. With gzip=1: Content-Encoding gzip and about 1 KB transferred.',
          id: 'Tanpa gzip=1: kompresi harus dilakukan gateway/ingress. Dengan gzip=1: Content-Encoding gzip dan transfer ~1 KB.',
        },
        headers: { 'Accept-Encoding': 'gzip' },
      },
    ],
  },
  {
    id: 'network',
    name: { en: 'Ingress, gateway & networking', id: 'Ingress, gateway & jaringan' },
    items: [
      {
        title: { en: 'Received headers', id: 'Header diterima' },
        method: 'GET',
        path: '/api/headers',
        simulates: { en: 'A request that came through an ingress or gateway.', id: 'Request lewat ingress/gateway.' },
        verify: { en: 'X-Forwarded-* and Host are correct; credentials are redacted.', id: 'X-Forwarded-*, Host benar; kredensial ter-redact.' },
      },
      {
        title: { en: 'Gateway headers', id: 'Header gateway' },
        method: 'GET',
        path: '/api/gateway',
        simulates: {
          en: 'Headers from the gateway (request-id, forwarded, consumer, trace).',
          id: 'Header dari gateway (request-id, forwarded, consumer, trace).',
        },
        verify: {
          en: 'x-request-id, x-forwarded-* and traceparent are filled; x-envoy-* when enableEnvoyHeaders is on.',
          id: 'x-request-id, x-forwarded-*, traceparent terisi; x-envoy-* bila enableEnvoyHeaders aktif.',
        },
      },
      {
        title: { en: 'Path echo', id: 'Path echo' },
        method: 'GET',
        path: '/path/a/b/c',
        simulates: { en: 'Rewrite, strip-path, and prefix.', id: 'Rewrite/strip-path/prefix.' },
        verify: { en: 'The path the app receives matches the routing rule.', id: 'Path yang diterima app sesuai aturan routing.' },
      },
      {
        title: { en: 'Blue / green page', id: 'Halaman biru / hijau' },
        method: 'GET',
        path: '/blue',
        simulates: { en: 'Two different routes to one Service (also /green).', id: 'Dua route berbeda ke satu Service (juga /green).' },
        verify: { en: 'Route, plugin, and auth per path.', id: 'Route, plugin, dan auth per path.' },
      },
      {
        title: { en: 'Redirect', id: 'Redirect' },
        method: 'GET',
        path: '/api/redirect?n=3&code=302',
        simulates: { en: 'A chain of relative redirects.', id: 'Rantai redirect relatif.' },
        verify: { en: 'Location does not leak the internal host; the prefix is kept.', id: 'Location tidak bocor host internal; prefix terjaga.' },
      },
      {
        title: { en: 'CORS preflight', id: 'CORS preflight' },
        method: 'OPTIONS',
        path: '/api/cors',
        simulates: { en: 'Preflight; the app adds no CORS headers.', id: 'Preflight; app tidak menambah CORS.' },
        verify: { en: 'The gateway adds Access-Control-*.', id: 'Gateway yang menambahkan Access-Control-*.' },
        headers: { Origin: 'https://frontend.local', 'Access-Control-Request-Method': 'GET' },
      },
      {
        title: { en: 'Cookie / sticky', id: 'Cookie / sticky' },
        method: 'GET',
        path: '/api/cookie?name=sid&value=abc',
        simulates: { en: 'Session affinity.', id: 'Session affinity.' },
        verify: { en: 'With a cookie jar, the serving pod stays the same.', id: 'Dengan cookie jar, pod yang melayani konsisten.' },
      },
      {
        title: { en: 'In-cluster DNS', id: 'DNS in-cluster' },
        method: 'GET',
        path: '/api/connect?type=dns&target=kubernetes.default.svc',
        simulates: { en: 'DNS resolution from inside the pod.', id: 'Resolusi DNS dari dalam pod.' },
        verify: { en: 'CoreDNS is healthy; the host is in CONNECT_ALLOWLIST.', id: 'CoreDNS sehat; host ada di CONNECT_ALLOWLIST.' },
      },
      {
        title: { en: 'TCP / egress', id: 'TCP / egress' },
        method: 'GET',
        path: '/api/connect?type=tcp&target=kubernetes.default.svc:443',
        simulates: { en: 'Connectivity out of the pod.', id: 'Konektivitas keluar pod.' },
        verify: { en: 'The egress NetworkPolicy allows or blocks as designed.', id: 'NetworkPolicy egress mengizinkan/memblokir sesuai desain.' },
      },
    ],
  },
  {
    id: 'resilience',
    name: { en: 'Resilience & limits', id: 'Resilience & batas' },
    items: [
      {
        title: { en: 'Status code', id: 'Status code' },
        method: 'GET',
        path: '/api/status/503',
        simulates: { en: 'Any upstream error (200-599).', id: 'Error upstream apa pun (200-599).' },
        verify: { en: 'Retries, error pages, alerts, outlier detection.', id: 'Retry, error page, alert, outlier detection.' },
      },
      {
        title: { en: 'Flaky 30%', id: 'Flaky 30%' },
        method: 'GET',
        path: '/api/flaky?rate=30&status=503',
        simulates: { en: 'Random failures.', id: 'Kegagalan acak.' },
        verify: { en: 'The retry policy and circuit breaker work.', id: 'Retry policy dan circuit breaker bekerja.' },
      },
      {
        title: { en: '5-second delay', id: 'Delay 5 detik' },
        method: 'GET',
        path: '/api/delay?ms=5000',
        simulates: { en: 'Slow upstream.', id: 'Upstream lambat.' },
        verify: {
          en: 'Client, gateway, and ingress timeouts match the configuration. Envoy cuts off at 15 s by default (504).',
          id: 'Timeout client/gateway/ingress sesuai konfigurasi. Envoy memotong di 15 dtk secara bawaan (504).',
        },
      },
      {
        title: { en: '1 MB response', id: 'Respons 1 MB' },
        method: 'GET',
        path: '/api/payload?kb=1024',
        simulates: { en: 'A large response.', id: 'Respons besar.' },
        verify: { en: 'Buffering, compression, proxy response limits.', id: 'Buffering, compression, limit respons proxy.' },
      },
      {
        title: { en: 'SSE streaming', id: 'Streaming SSE' },
        method: 'GET',
        path: '/api/sse?events=15&interval=1000',
        simulates: { en: 'A streaming response.', id: 'Respons streaming.' },
        verify: { en: 'Events arrive one by one (curl -N); the proxy does not buffer them.', id: 'Event tiba satu per satu (curl -N); tidak di-buffer proxy.' },
      },
      {
        title: { en: 'Mounted config', id: 'Config ter-mount' },
        method: 'GET',
        path: '/api/config',
        simulates: { en: 'ConfigMap or Secret in a volume.', id: 'ConfigMap/Secret di volume.' },
        verify: { en: 'The checksum changes after a new config rollout.', id: 'Checksum berubah setelah rollout config baru.' },
      },
    ],
  },
];

export const DEPLOY_SCENARIOS: readonly DeployScenario[] = [
  {
    title: { en: 'Failed rollout and rollback', id: 'Rollout gagal → rollback' },
    env: 'BOOT_FAIL=true',
    expect: {
      en: 'Pod CrashLoopBackOff, the rollout stalls; kubectl rollout undo or a pipeline rollback runs.',
      id: 'Pod CrashLoopBackOff, rollout tertahan; kubectl rollout undo atau rollback pipeline berjalan.',
    },
  },
  {
    title: { en: 'Slow start', id: 'Start lambat' },
    env: 'STARTUP_DELAY_SECONDS=60',
    expect: {
      en: 'Startup and readiness return 503 for 60 s; liveness does not kill it; new traffic arrives once it is ready.',
      id: 'Startup/readiness 503 selama 60 dtk; liveness tidak membunuh; traffic baru masuk setelah ready.',
    },
  },
  {
    title: { en: 'Periodic crash', id: 'Crash berkala' },
    env: 'CRASH_AFTER_SECONDS=120',
    expect: { en: 'RESTARTS goes up, the backoff grows, the CrashLoop alert fires.', id: 'RESTARTS naik, backoff bertambah, alert CrashLoop menyala.' },
  },
  {
    title: { en: 'Dependency down', id: 'Dependency mati' },
    env: 'DEPENDENCY_URL=http://tier-b.playground.svc/api/readyz',
    expect: {
      en: 'Readiness is 503 while the dependency is unhealthy; the pod leaves Endpoints without a restart.',
      id: 'Readiness 503 selama dependency tidak sehat; pod keluar dari Endpoints tanpa restart.',
    },
  },
  {
    title: { en: 'Service chain', id: 'Rantai service' },
    env: 'UPSTREAM_URL=http://tier-b.playground.svc',
    expect: {
      en: '/api/chain forwards to the next tier; the same trace on every hop (see k8s/chain).',
      id: '/api/chain meneruskan ke tier berikutnya; trace sama di semua hop (lihat k8s/chain).',
    },
  },
  {
    title: { en: 'Broken canary', id: 'Canary rusak' },
    env: 'APP_VERSION=v2  ERROR_RATE=20',
    expect: {
      en: 'Canary analysis detects 5xx on v2, then cancels or rolls back automatically.',
      id: 'Analisis canary mendeteksi 5xx di v2 lalu membatalkan/rollback otomatis.',
    },
  },
  {
    title: { en: 'Slow canary', id: 'Canary lambat' },
    env: 'APP_VERSION=v2  LATENCY_MS=800',
    expect: { en: 'The v2 p95 latency crosses the threshold; promotion is halted.', id: 'Latency p95 v2 melewati ambang; promosi dihentikan.' },
  },
  {
    title: { en: 'Memory leak', id: 'Memory leak' },
    env: 'LEAK_MB_PER_MINUTE=20 (limit 256Mi)',
    expect: {
      en: 'Memory grows every minute until OOMKilled; the memory alert and a restart follow.',
      id: 'Memori naik tiap menit sampai OOMKilled; alert memori dan restart.',
    },
  },
];
