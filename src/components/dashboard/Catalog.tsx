'use client';

import { toCurl, urlFor } from './api';
import { CopyButton } from './ui';

interface Endpoint {
  title: string;
  method: string;
  path: string;
  simulates: string;
  verify: string;
  headers?: Record<string, string>;
}

interface DeployScenario {
  title: string;
  env: string;
  expect: string;
}

const ENDPOINTS: ReadonlyArray<{ group: string; items: Endpoint[] }> = [
  {
    group: 'Workload & rollout',
    items: [
      { title: 'Hello (endpoint bisnis)', method: 'GET', path: '/api/hello', simulates: 'Traffic aplikasi nyata; dipengaruhi ERROR_RATE dan LATENCY_MS.', verify: 'Success rate dan latency per versi di canary analysis / dashboard.' },
      { title: 'Identitas pod', method: 'GET', path: '/api/info', simulates: 'Versi, pod, node, uptime, perilaku aktif.', verify: 'Versi baru muncul setelah rollout; distribusi pod merata.' },
      { title: 'Metrics', method: 'GET', path: '/api/metrics', simulates: 'Target scrape Prometheus.', verify: 'ServiceMonitor ter-scrape; alert 5xx jalan.' },
    ],
  },
  {
    group: 'Probe & lifecycle',
    items: [
      { title: 'Liveness', method: 'GET', path: '/api/healthz', simulates: 'Livenessprobe.', verify: 'Kubelet restart container saat 503.' },
      { title: 'Readiness', method: 'GET', path: '/api/readyz', simulates: 'Readiness; 503 saat draining.', verify: 'Pod keluar dari Endpoints; tidak ada 5xx saat rolling update.' },
      { title: 'Startup', method: 'GET', path: '/api/startupz', simulates: 'Startup probe; 503 selama STARTUP_DELAY_SECONDS.', verify: 'Liveness tidak membunuh app yang start lambat.' },
    ],
  },
  {
    group: 'Service-to-service & dependency',
    items: [
      { title: 'Multi-hop', method: 'GET', path: '/api/chain?depth=3', simulates: 'App memanggil app berikutnya (UPSTREAM_URL) sebanyak depth hop.', verify: 'Semua hop punya traceId sama; header trace/request-id sampai ke hop terakhir.', headers: { traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01' } },
      { title: 'Kegagalan berantai', method: 'GET', path: '/api/chain?depth=2', simulates: 'Hop di bawah mati atau lambat (CHAIN_TIMEOUT_MS).', verify: '502 menjalar ke atas dengan detail di downstream; alert dan timeout bekerja.' },
      { title: 'Readiness + dependency', method: 'GET', path: '/api/readyz', simulates: 'Readiness gagal bila DEPENDENCY_URL tidak sehat (liveness tetap 200).', verify: 'Pod keluar dari Endpoints, tidak di-restart; kembali ready saat dependency pulih.' },
    ],
  },
  {
    group: 'Autentikasi & identitas',
    items: [
      { title: 'Identitas dari gateway', method: 'GET', path: '/api/secure/whoami?require=1', simulates: 'Kong key-auth, jwt, basic-auth, oidc menambah X-Consumer-*.', verify: '401 tanpa kredensial; 200 dan consumer terisi lewat gateway.', headers: { apikey: '<api-key>' } },
      { title: 'Klaim JWT', method: 'GET', path: '/api/secure/jwt', simulates: 'Bearer JWT; verifikasi HS256 bila JWT_SECRET di-set.', verify: 'Klaim terbaca; signature salah atau token kedaluwarsa dibalas 401.', headers: { Authorization: 'Bearer <jwt>' } },
      { title: 'Basic auth di app', method: 'GET', path: '/api/secure/basic', simulates: 'Basic auth level aplikasi (BASIC_USER, BASIC_PASSWORD).', verify: '401 + WWW-Authenticate tanpa kredensial; 200 dengan kredensial benar.', headers: { Authorization: 'Basic <base64 user:pass>' } },
    ],
  },
  {
    group: 'Caching',
    items: [
      { title: 'Cache publik + ETag', method: 'GET', path: '/api/cache?ttl=60&v=1', simulates: 'Cache-Control public, ETag dan Last-Modified yang sama di semua pod.', verify: 'Request ulang dari cache (generatedAt tidak berubah); If-None-Match menghasilkan 304.' },
      { title: 'Cache shared + SWR', method: 'GET', path: '/api/cache?ttl=30&mode=swr&smax=120&vary=accept-encoding', simulates: 's-maxage, stale-while-revalidate, Vary.', verify: 'Gateway/CDN menghormati s-maxage dan membuat varian per Accept-Encoding.' },
      { title: 'Tanpa cache', method: 'GET', path: '/api/cache?mode=nostore', simulates: 'Cache-Control no-store.', verify: 'Tidak pernah di-cache; tidak ada ETag.' },
      { title: 'Compression', method: 'GET', path: '/api/cache?kb=512&v=big&gzip=1', simulates: 'Body 512 KB sangat kompresibel; default tidak dikompres, gzip=1 dikompres oleh app.', verify: 'Tanpa gzip=1: kompresi harus dilakukan gateway/ingress. Dengan gzip=1: Content-Encoding gzip dan transfer ~1 KB.', headers: { 'Accept-Encoding': 'gzip' } },
    ],
  },
  {
    group: 'Ingress, gateway & jaringan',
    items: [
      { title: 'Header diterima', method: 'GET', path: '/api/headers', simulates: 'Request lewat ingress/gateway.', verify: 'X-Forwarded-*, Host benar; kredensial ter-redact.' },
      { title: 'Header gateway', method: 'GET', path: '/api/gateway', simulates: 'Plugin gateway (consumer, correlation-id, trace).', verify: 'X-Consumer-Username, X-Correlation-Id, traceparent terisi.' },
      { title: 'Path echo', method: 'GET', path: '/path/a/b/c', simulates: 'Rewrite/strip-path/prefix.', verify: 'Path yang diterima app sesuai aturan routing.' },
      { title: 'Halaman biru / hijau', method: 'GET', path: '/blue', simulates: 'Dua route berbeda ke satu Service (juga /green).', verify: 'Route, plugin, dan auth per path.' },
      { title: 'Redirect', method: 'GET', path: '/api/redirect?n=3&code=302', simulates: 'Rantai redirect relatif.', verify: 'Location tidak bocor host internal; prefix terjaga.' },
      { title: 'CORS preflight', method: 'OPTIONS', path: '/api/cors', simulates: 'Preflight; app tidak menambah CORS.', verify: 'Gateway yang menambahkan Access-Control-*.', headers: { Origin: 'https://example.com', 'Access-Control-Request-Method': 'GET' } },
      { title: 'Cookie / sticky', method: 'GET', path: '/api/cookie?name=sid&value=abc', simulates: 'Session affinity.', verify: 'Dengan cookie jar, pod yang melayani konsisten.' },
      { title: 'DNS in-cluster', method: 'GET', path: '/api/connect?type=dns&target=kubernetes.default.svc', simulates: 'Resolusi DNS dari dalam pod.', verify: 'CoreDNS sehat; host ada di CONNECT_ALLOWLIST.' },
      { title: 'TCP / egress', method: 'GET', path: '/api/connect?type=tcp&target=kubernetes.default.svc:443', simulates: 'Konektivitas keluar pod.', verify: 'NetworkPolicy egress mengizinkan/memblokir sesuai desain.' },
    ],
  },
  {
    group: 'Resilience & batas',
    items: [
      { title: 'Status code', method: 'GET', path: '/api/status/503', simulates: 'Error upstream apa pun (200-599).', verify: 'Retry, error page, alert, outlier detection.' },
      { title: 'Flaky 30%', method: 'GET', path: '/api/flaky?rate=30&status=503', simulates: 'Kegagalan acak.', verify: 'Retry policy dan circuit breaker bekerja.' },
      { title: 'Delay 5 detik', method: 'GET', path: '/api/delay?ms=5000', simulates: 'Upstream lambat.', verify: 'Timeout client/gateway/ingress sesuai konfigurasi.' },
      { title: 'Respons 1 MB', method: 'GET', path: '/api/payload?kb=1024', simulates: 'Respons besar.', verify: 'Buffering, compression, limit respons proxy.' },
      { title: 'Streaming SSE', method: 'GET', path: '/api/sse?events=15&interval=1000', simulates: 'Respons streaming.', verify: 'Event tiba satu per satu (curl -N); tidak di-buffer proxy.' },
      { title: 'Config ter-mount', method: 'GET', path: '/api/config', simulates: 'ConfigMap/Secret di volume.', verify: 'Checksum berubah setelah rollout config baru.' },
    ],
  },
];

const DEPLOY_SCENARIOS: DeployScenario[] = [
  { title: 'Rollout gagal → rollback', env: 'BOOT_FAIL=true', expect: 'Pod CrashLoopBackOff, rollout tertahan; kubectl rollout undo atau rollback pipeline berjalan.' },
  { title: 'Start lambat', env: 'STARTUP_DELAY_SECONDS=60', expect: 'Startup/readiness 503 selama 60 dtk; liveness tidak membunuh; traffic baru masuk setelah ready.' },
  { title: 'Crash berkala', env: 'CRASH_AFTER_SECONDS=120', expect: 'RESTARTS naik, backoff bertambah, alert CrashLoop menyala.' },
  { title: 'Dependency mati', env: 'DEPENDENCY_URL=http://tier-b.playground.svc/api/readyz', expect: 'Readiness 503 selama dependency tidak sehat; pod keluar dari Endpoints tanpa restart.' },
  { title: 'Rantai service', env: 'UPSTREAM_URL=http://tier-b.playground.svc', expect: '/api/chain meneruskan ke tier berikutnya; trace sama di semua hop (lihat k8s/chain).' },
  { title: 'Canary rusak', env: 'APP_VERSION=v2  ERROR_RATE=20', expect: 'Analisis canary mendeteksi 5xx di v2 lalu membatalkan/rollback otomatis.' },
  { title: 'Canary lambat', env: 'APP_VERSION=v2  LATENCY_MS=800', expect: 'Latency p95 v2 melewati ambang; promosi dihentikan.' },
  { title: 'Memory leak', env: 'LEAK_MB_PER_MINUTE=20 (limit 256Mi)', expect: 'Memori naik tiap menit sampai OOMKilled; alert memori dan restart.' },
];

function EndpointItem({ e }: Readonly<{ e: Endpoint }>) {
  const curl = () => toCurl(e.method, e.path, e.headers ?? {}, '');
  return (
    <li className="item">
      <div>
        <h3>{e.title}</h3>
        <p>{e.simulates}</p>
        <p className="verify-line">
          <b>Verifikasi:</b> {e.verify}
        </p>
      </div>
      <div className="item-side">
        <code className="req">
          {e.method} {e.path}
        </code>
        <div className="row">
          <CopyButton label="Salin curl" text={curl} />
          {e.method === 'GET' && (
            <a className="btn sm" href={urlFor(e.path)} target="_blank" rel="noreferrer">
              Buka
            </a>
          )}
        </div>
      </div>
    </li>
  );
}

export default function Catalog() {
  return (
    <div className="stack" style={{ gap: 8 }}>
      <p className="muted" style={{ maxWidth: '70ch' }}>
        App ini adalah workload yang diuji, bukan alat penguji. Jalankan tes dari luar (kubectl, CI, k6, curl, atau gateway) dengan perintah di
        bawah, lalu amati hasilnya di cluster atau pipeline. Panduan langkah demi langkah ada di{' '}
        <a href="/docs">Dokumentasi</a>.
      </p>

      <h2 className="section-title">Skenario deploy (diatur lewat env di Deployment)</h2>
      <div className="scroll-x">
        <table className="kv">
          <thead>
            <tr>
              <th>Skenario</th>
              <th>Env</th>
              <th>Yang diharapkan</th>
            </tr>
          </thead>
          <tbody>
            {DEPLOY_SCENARIOS.map((s) => (
              <tr key={s.title}>
                <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{s.title}</td>
                <td>
                  <code>{s.env}</code>
                </td>
                <td>{s.expect}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ENDPOINTS.map((g) => (
        <section key={g.group}>
          <h2 className="section-title">{g.group}</h2>
          <ul className="items">
            {g.items.map((e) => (
              <EndpointItem key={e.title} e={e} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
