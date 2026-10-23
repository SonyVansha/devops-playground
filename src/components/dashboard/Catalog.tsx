'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { call, toCurl, urlFor, type CallResult } from './api';
import { hasPlaceholder } from './outcome';
import { Icon } from '../shell/Icons';
import { CopyButton, ResponseView } from './ui';

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
      { title: 'Identitas dari gateway', method: 'GET', path: '/api/secure/whoami?require=1', simulates: 'Gateway meneruskan identitas klien (Kong: X-Consumer-*, Envoy Gateway: header dari SecurityPolicy, mis. x-client-id).', verify: '401 tanpa kredensial; 200 dan consumer terisi lewat gateway.', headers: { apikey: '<api-key>' } },
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
      { title: 'Header gateway', method: 'GET', path: '/api/gateway', simulates: 'Header dari gateway (request-id, forwarded, consumer, trace).', verify: 'x-request-id, x-forwarded-*, traceparent terisi; x-envoy-* bila enableEnvoyHeaders aktif.' },
      { title: 'Path echo', method: 'GET', path: '/path/a/b/c', simulates: 'Rewrite/strip-path/prefix.', verify: 'Path yang diterima app sesuai aturan routing.' },
      { title: 'Halaman biru / hijau', method: 'GET', path: '/blue', simulates: 'Dua route berbeda ke satu Service (juga /green).', verify: 'Route, plugin, dan auth per path.' },
      { title: 'Redirect', method: 'GET', path: '/api/redirect?n=3&code=302', simulates: 'Rantai redirect relatif.', verify: 'Location tidak bocor host internal; prefix terjaga.' },
      { title: 'CORS preflight', method: 'OPTIONS', path: '/api/cors', simulates: 'Preflight; app tidak menambah CORS.', verify: 'Gateway yang menambahkan Access-Control-*.', headers: { Origin: 'https://frontend.local', 'Access-Control-Request-Method': 'GET' } },
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
      { title: 'Delay 5 detik', method: 'GET', path: '/api/delay?ms=5000', simulates: 'Upstream lambat.', verify: 'Timeout client/gateway/ingress sesuai konfigurasi. Envoy memotong di 15 dtk secara bawaan (504).' },
      { title: 'Respons 1 MB', method: 'GET', path: '/api/payload?kb=1024', simulates: 'Respons besar.', verify: 'Buffering, compression, limit respons proxy.' },
      { title: 'Streaming SSE', method: 'GET', path: '/api/sse?events=15&interval=1000', simulates: 'Respons streaming.', verify: 'Event tiba satu per satu (curl -N); tidak di-buffer proxy.' },
      { title: 'Config ter-mount', method: 'GET', path: '/api/config', simulates: 'ConfigMap/Secret di volume.', verify: 'Checksum berubah setelah rollout config baru.' },
    ],
  },
];

const SCENARIO_GROUP = 'Skenario deploy';

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

// Browser menolak/mengabaikan header ini di fetch; untuk tes yang sebenarnya pakai curl.
const BROWSER_BLOCKED = ['origin', 'accept-encoding', 'access-control-request-method', 'access-control-request-headers', 'cookie', 'host'];

const envText = (env: string) => env.replace(/\s*\(.*\)\s*$/, '').split(/\s{2,}/).join('\n');

function EndpointRow({ e }: Readonly<{ e: Endpoint }>) {
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(e.headers ?? {}).map(([k, v]) => [k, hasPlaceholder(v) ? '' : v])),
  );
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<CallResult | null>(null);
  const abort = useRef<AbortController | null>(null);

  const headerNames = Object.keys(e.headers ?? {});
  const missing = headerNames.filter((k) => hasPlaceholder(e.headers?.[k] ?? '') && !vals[k]?.trim());
  const blocked = headerNames.filter((k) => BROWSER_BLOCKED.includes(k.toLowerCase()));
  const effective = () => Object.fromEntries(Object.entries(vals).filter(([, v]) => v.trim() !== ''));

  const run = async () => {
    abort.current = new AbortController();
    setBusy(true);
    setRes(null);
    setRes(await call(e.method, e.path, { headers: effective(), signal: abort.current.signal }));
    setBusy(false);
  };

  const curl = () => toCurl(e.method, e.path, effective(), '');
  const whyDisabled = missing.length > 0 ? `Isi ${missing.join(', ')} dulu.` : '';

  return (
    <li className="item">
      <div className="item-main">
        <h3>{e.title}</h3>
        <p>{e.simulates}</p>
        <p className="verify-line">
          <b>Verifikasi:</b> {e.verify}
        </p>
        {headerNames.length > 0 && (
          <details className="item-headers" open={missing.length > 0}>
            <summary>Header request ({headerNames.length})</summary>
            <div className="stack" style={{ gap: 8 }}>
              {headerNames.map((k) => (
                <label key={k}>
                  <span className="mono">{k}</span>
                  <input
                    value={vals[k] ?? ''}
                    placeholder={hasPlaceholder(e.headers?.[k] ?? '') ? (e.headers?.[k] ?? '') : ''}
                    onChange={(ev) => setVals({ ...vals, [k]: ev.target.value })}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
              ))}
              {blocked.length > 0 && (
                <p className="hint">
                  Browser mengabaikan header {blocked.join(', ')}. Untuk tes yang sebenarnya, pakai <strong>Salin curl</strong>.
                </p>
              )}
            </div>
          </details>
        )}
      </div>
      <div className="item-side">
        <code className="req">
          {e.method} {e.path}
        </code>
        <div className="row">
          {busy ? (
            <button type="button" className="btn sm" onClick={() => abort.current?.abort()}>
              Batalkan
            </button>
          ) : (
            <button type="button" className="btn sm" onClick={() => void run()} disabled={missing.length > 0} aria-describedby={whyDisabled ? `why-${e.title}` : undefined}>
              <Icon name="play" size={14} />
              Jalankan
            </button>
          )}
          <CopyButton label="Salin curl" text={curl} />
          {e.method === 'GET' && (
            <a className="btn sm" href={urlFor(e.path)} target="_blank" rel="noreferrer">
              Buka
            </a>
          )}
        </div>
        {whyDisabled && (
          <span className="hint" id={`why-${e.title}`}>
            {whyDisabled}
          </span>
        )}
        {busy && <span className="hint">Menjalankan…</span>}
      </div>
      {res && (
        <div className="item-result">
          <ResponseView res={res} />
        </div>
      )}
    </li>
  );
}

const matches = (q: string, ...parts: string[]) => parts.some((p) => p.toLowerCase().includes(q));

export default function Catalog() {
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const q = query.trim().toLowerCase();

  // Tekan "/" untuk langsung mencari (hanya bila tampilan ini sedang terlihat).
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const t = ev.target as HTMLElement | null;
      const typing = t !== null && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT');
      const el = search.current;
      if (ev.key === '/' && !typing && el && el.offsetParent !== null) {
        ev.preventDefault();
        el.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const scenarios = useMemo(
    () => (group === null || group === SCENARIO_GROUP ? DEPLOY_SCENARIOS.filter((s) => !q || matches(q, s.title, s.env, s.expect)) : []),
    [q, group],
  );
  const groups = useMemo(
    () =>
      ENDPOINTS.filter((g) => group === null || group === g.group)
        .map((g) => ({ ...g, items: g.items.filter((e) => !q || matches(q, e.title, e.path, e.simulates, e.verify)) }))
        .filter((g) => g.items.length > 0),
    [q, group],
  );
  const total = scenarios.length + groups.reduce((n, g) => n + g.items.length, 0);
  const chips = [SCENARIO_GROUP, ...ENDPOINTS.map((g) => g.group)];

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="filter-bar">
        <label className="field-grow">
          Cari skenario atau endpoint
          <input
            ref={search}
            type="search"
            value={query}
            onChange={(ev) => setQuery(ev.target.value)}
            placeholder="mis. cache, 503, jwt, canary  (tekan / untuk mencari)"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <span className="muted" aria-live="polite">
          {q || group ? `${total} hasil` : ''}
        </span>
      </div>
      <div className="chips" role="group" aria-label="Filter kategori">
        <button type="button" className="chip" aria-pressed={group === null} onClick={() => setGroup(null)}>
          Semua
        </button>
        {chips.map((c) => (
          <button key={c} type="button" className="chip" aria-pressed={group === c} onClick={() => setGroup(group === c ? null : c)}>
            {c}
          </button>
        ))}
      </div>

      {total === 0 && <p className="empty-frame">Tidak ada yang cocok dengan “{query}”. Hapus filter untuk melihat semuanya.</p>}

      {scenarios.length > 0 && (
        <section>
          <h2 className="section-title">{SCENARIO_GROUP}</h2>
          <p className="muted" style={{ marginBottom: 10 }}>
            Atur lewat env di Deployment, lalu amati perilakunya di cluster atau pipeline.
          </p>
          <div className="scroll-x" tabIndex={0} role="region" aria-label="Tabel skenario deploy">
            <table className="kv stack-sm">
              <thead>
                <tr>
                  <th scope="col">Skenario</th>
                  <th scope="col">Env</th>
                  <th scope="col">Yang diharapkan</th>
                  <th scope="col">
                    <span className="sr-only">Aksi</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((s) => (
                  <tr key={s.title}>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{s.title}</td>
                    <td>
                      <code>{s.env}</code>
                    </td>
                    <td>{s.expect}</td>
                    <td>
                      <CopyButton label="Salin env" text={envText(s.env)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {groups.map((g) => (
        <section key={g.group}>
          <h2 className="section-title">{g.group}</h2>
          <ul className="items">
            {g.items.map((e) => (
              <EndpointRow key={e.title} e={e} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
