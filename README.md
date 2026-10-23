# DevOps Playground (Next.js)

**Workload dummy** yang di-deploy untuk menguji skenario DevOps sebelum aplikasi production berjalan: rollout/rollback, canary, probe, HPA, OOM, ingress, API gateway (Kong), NetworkPolicy, config rotation, scan keamanan.
App ini adalah objek yang diuji, bukan alat penguji. Tes dijalankan dari luar (kubectl, CI/CD, k6, curl, gateway). Perilakunya diatur lewat env di Deployment atau lewat fault injection saat runtime.

## Jalankan

```bash
npm ci && npm run dev          # lokal
npm test                       # unit + route test
npm run test:coverage          # menulis lcov.info untuk SonarQube
docker build -t devops-playground:1.0.0 .
docker run --rm -p 3000:3000 -e ENABLE_CHAOS=true devops-playground:1.0.0
kubectl apply -f k8s/app.yaml
```

Tes sub-path ingress (basePath bersifat build-time):
`docker build --build-arg BASE_PATH=/playground -t devops-playground:1.0.0 .`

## Dokumentasi (`/docs`)

Panduan pemakaian dan cara memeriksa hasilnya ada **di dalam app**: buka `/docs` (15 halaman, pencarian, kolom Base URL yang mengisi semua contoh `curl`, dan blok "Cara cek" berisi hasil yang diharapkan).

Menambah halaman baru: buat file di `src/docs/pages/` (objek `Doc` berisi blok `h`, `p`, `ul`, `code`, `table`, `note`, `check`), lalu daftarkan di `src/docs/index.ts`. `npm test` memvalidasi slug, tautan antar halaman, struktur tabel, **setiap endpoint `/api/...` yang disebut harus ada di kode**, dan setiap env di halaman Referensi harus dipakai di kode, sehingga docs tidak diam-diam menjadi basi.

## Dashboard

Buka `/` (read-only, tanpa fitur penguji): **Overview** (identitas, probe live, perilaku aktif), **Skenario & endpoint** (katalog skenario + perintah curl + apa yang diverifikasi), **Fault injection** (kontrol chaos runtime).

## Skenario deploy (env di Deployment)

Satu image, banyak peran. Ubah env lalu amati reaksi cluster/pipeline:

| Skenario | Env | Yang diamati |
|---|---|---|
| Rollout gagal → rollback | `BOOT_FAIL=true` | CrashLoopBackOff, rollout tertahan, `kubectl rollout undo` / rollback pipeline |
| Start lambat | `STARTUP_DELAY_SECONDS=60` | Startup/readiness 503; liveness tidak membunuh; traffic masuk setelah ready |
| Crash berkala | `CRASH_AFTER_SECONDS=120` | RESTARTS naik, backoff, alert CrashLoop |
| Canary rusak | `APP_VERSION=v2 ERROR_RATE=20` | Canary analysis (Argo Rollouts/Flagger) membatalkan rollout dari 5xx di `/api/hello` |
| Canary lambat | `APP_VERSION=v2 LATENCY_MS=800` | Latency p95 melewati ambang |
| Memory leak | `LEAK_MB_PER_MINUTE=20` | Memori naik sampai OOMKilled |
| Zero-downtime rollout | (drain bawaan) | Tidak ada 5xx saat `kubectl rollout restart` sambil load test ke `/api/hello` |
| HPA | chaos `/api/chaos/cpu` | Replika bertambah |
| Liveness restart | chaos `/api/chaos/unhealthy` | Container di-restart kubelet |
| Rotasi config | ubah ConfigMap | Checksum di `/api/config` berubah |
| NetworkPolicy/egress | `/api/connect` | Koneksi diizinkan/diblokir sesuai policy |

Contoh:

```bash
kubectl -n playground set env deploy/playground BOOT_FAIL=true
kubectl -n playground rollout status deploy/playground --timeout=60s   # gagal -> uji rollback
kubectl -n playground rollout undo deploy/playground
```

Canary Argo Rollouts: lihat `k8s/rollouts/README.md`. Beban tes k6: `loadtest/hello.js`.

Smoke test kontrak untuk CI/CD setelah deploy:

```bash
BASE_URL=https://playground.example.com EXPECT_VERSION=v2 bash scripts/smoke.sh
```

## Endpoint

| Endpoint | Fungsi |
|---|---|
| `/api/healthz` `/livez` `/readyz` `/startupz` | Probe (readiness 503 saat draining) |
| `/api/hello` | Endpoint "bisnis": dipengaruhi `ERROR_RATE`/`LATENCY_MS`, mengembalikan versi + pod |
| `/api/chain?depth=3` | Multi-hop: memanggil `UPSTREAM_URL` sebanyak depth hop; trace (`traceparent`, `b3`, `x-request-id`) diteruskan; hop gagal → 502 berantai |
| `/api/secure/whoami[?require=1]` | Identitas dari header gateway (`X-Consumer-*`); 401 bila `require=1` dan anonim |
| `/api/secure/jwt` | Klaim JWT dari Bearer; verifikasi HS256 + expiry bila `JWT_SECRET` di-set (token/signature tidak pernah dikembalikan) |
| `/api/secure/basic` | Basic auth level app (`BASIC_USER`/`BASIC_PASSWORD`); 503 bila belum dikonfigurasi |
| `/api/cache?ttl=&mode=&v=&smax=&vary=&kb=` | Cache-Control (`public`/`private`/`nostore`/`swr`), `s-maxage`, `Vary`, ETag + Last-Modified (304), body kompresibel |
| `/api/info` | Pod, namespace, node, uptime, memori, perilaku aktif |
| `/api/headers` | Echo header (kredensial di-redact) |
| `/api/echo` | Echo method/query/body (maks 64KB) |
| `/api/status/{code}` | Balas status code 200-599 |
| `/api/delay?ms=` | Delay (maks 30 dtk) |
| `/api/flaky?rate=30&status=503` | Gagal acak (retry, circuit breaker) |
| `/api/sse?events=10&interval=1000` | Server-Sent Events (buffering, idle timeout) |
| `/api/payload?kb=` (GET) / POST | Respons besar (maks 10MB) / hitung byte upload (maks 20MB) |
| `/api/redirect?n=3&code=302` `&loop=1` | Rantai/loop redirect (Location relatif) |
| `/api/cors` | Preflight; `?mode=app` agar app sendiri menambah header CORS |
| `/api/cookie?name=&value=` | Set cookie / pod mana yang melayani (sticky session) |
| `/api/connect?type=dns` (atau `tcp`, `http`) `&target=` | Tes DNS/egress/service-to-service, hanya host di `CONNECT_ALLOWLIST` |
| `/api/config` | Nama, ukuran, checksum file ConfigMap/Secret ter-mount (tanpa isi) |
| `/api/gateway` | Header yang ditambahkan gateway (consumer, trace, dll) |
| `/api/metrics` | Prometheus: request per route/status, latency, memori |
| `/path/*` | Path yang diterima app |
| `/blue` `/green` | Dua halaman untuk tes routing gateway |

### Chaos (POST)

`/api/chaos/notready`, `/unhealthy`, `/cpu?seconds=&workers=`, `/mem?mb=` (DELETE untuk lepas), `/crash`. Syarat: `ENABLE_CHAOS=true`, `CHAOS_TOKEN` terpasang, header `X-Chaos-Token`. Tambah `?pod=<nama>` untuk menarget satu pod (pod lain membalas 409).

```bash
kubectl -n playground create secret generic playground-chaos --from-literal=token=$(openssl rand -hex 16)
```

### Database (PostgreSQL / MySQL)

Tab **Database** di dashboard: isi jenis, host, port, user, password, dan nama database langsung di form, tanpa edit `.env`. Koneksi dikirim per request lewat header `X-DB-Conn` (base64 JSON; password hanya di memori browser, tidak disimpan di server). Syarat keamanan: `ENABLE_DB=true`, `DB_TOKEN` terpasang, header `X-DB-Token`.

Opsional: env `DB_TYPE`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` dipakai sebagai default bila form dikosongkan / header tidak dikirim.

Karena host berasal dari input, **jangan** aktifkan `ENABLE_DB` di instance publik tanpa `DB_TOKEN` yang kuat.

| Endpoint | Fungsi |
|---|---|
| `GET /api/db` | Status fitur (tanpa rahasia) |
| `POST /api/db/test` | `SELECT 1` + versi server, latensi |
| `GET /api/db/tables` | Daftar tabel berawalan `playground_` |
| `POST /api/db/tables` | `{"name":"notes","columns":[{"name":"title","type":"text"}]}`; tipe: `text`, `integer`, `boolean`, `timestamp`; kolom `id` otomatis |
| `GET /api/db/tables/<name>` | 50 baris terbaru |
| `POST /api/db/tables/<name>` | `{"values":{"title":"halo"}}` (parameter bind) |

Nama tabel selalu diberi awalan `playground_`, jadi tabel aplikasi lain tidak tersentuh. Gunakan database tes, bukan production.

### Graceful shutdown

SIGTERM → readiness 503 + `draining=true`, app tetap melayani `DRAIN_SECONDS` (default 10) lalu exit 0. Amati dengan `kubectl rollout restart` sambil menjalankan Burst. Membutuhkan `NEXT_MANUAL_SIG_HANDLE=true` (sudah di Dockerfile dan manifest).

## Multi-hop, auth, dan cache

**Multi-hop & dependency** (`k8s/chain/chain.yaml`: tier-a → tier-b → tier-c dari satu image)

```bash
kubectl apply -f k8s/chain/chain.yaml
curl http://tier-a/api/chain?depth=2                         # traceId sama di semua hop
kubectl -n playground scale deploy/tier-c --replicas=0       # tier-c mati
curl -i http://tier-a/api/chain?depth=2                      # 502 berantai; readiness tier-b & tier-a gagal, pod TIDAK di-restart
kubectl -n playground scale deploy/tier-c --replicas=1       # pulih, semua ready lagi
```

`DEPENDENCY_URL` memengaruhi **readiness saja**; liveness sengaja tidak, karena dependency mati tidak boleh me-restart pod. `UPSTREAM_URL` dan `DEPENDENCY_URL` hanya dibaca dari env (bukan dari request), jadi tidak ada SSRF. Hop dibatasi 5 dan timeout `CHAIN_TIMEOUT_MS` (default 3000).

**Auth.** `/api/secure/whoami` menampilkan consumer yang diteruskan Kong (route `playground-secure` di `kong.yaml` memakai key-auth). Header `X-Consumer-*` dipercaya apa adanya: jika app bisa diakses langsung, klien bisa memalsukannya, jadi batasi dengan NetworkPolicy. Untuk JWT/basic di app, buat Secret `playground-auth` (`jwt-secret`, `basic-user`, `basic-password`, sudah dirujuk `app.yaml` sebagai opsional). Tanpa `JWT_SECRET`, `/api/secure/jwt` hanya mendekode klaim dan menyatakan `verified: null`.

**Cache.** ETag hanya bergantung pada `v` dan `kb`, jadi identik di semua replika. Contoh:

```bash
curl -si 'http://host/api/cache?ttl=60&v=1' | grep -iE 'etag|cache-control'
curl -si -H 'If-None-Match: "<etag>"' 'http://host/api/cache?ttl=60&v=1'   # 304
curl -s --compressed -o /dev/null -w '%{size_download}\n' 'http://host/api/cache?kb=512'         # ~512 KB: app tidak mengompres (itu tugas gateway/ingress)
curl -s --compressed -o /dev/null -w '%{size_download}\n' 'http://host/api/cache?kb=512&gzip=1'  # ~1 KB: dikompres oleh app
```

## Tes API Gateway (Envoy Gateway)

Infra deploy contoh memakai **Envoy Gateway**. Manifest di `k8s/envoy-gateway/` memakai Gateway API (`HTTPRoute`) plus policy Envoy Gateway:

```bash
kubectl apply -f k8s/app.yaml
kubectl apply -f k8s/envoy-gateway/gateway.yaml   # opsional: lewati bila Gateway sudah disediakan platform
kubectl apply -f k8s/envoy-gateway/routes.yaml    # ubah parentRefs bila nama Gateway berbeda
PROXY=http://<alamat-gateway> API_KEY=<key di Secret demo-apikeys> bash k8s/envoy-gateway/test.sh   # SLOW=1 untuk tes timeout dan streaming
```

| Route | Resource | Yang diuji |
|---|---|---|
| `/blue` | BackendTrafficPolicy (rate limit 5/menit) + header `X-Gateway` | 200 lalu 429 |
| `/green` | SecurityPolicy (apiKeyAuth + CORS) | 401 tanpa key, 200 dengan `apikey`, preflight |
| `/gw/*` | filter `URLRewrite` | prefix dibuang |
| `/api/secure/whoami` | SecurityPolicy (apiKeyAuth) | identitas lewat `x-client-id` |
| `/api/flaky` | BackendTrafficPolicy (retry) | kegagalan ±30% → mendekati 0 |
| `/api/delay`, `/api/sse` | `timeouts.request` pada HTTPRoute | request 20 dtk lolos, stream tidak terpotong |
| `/api/cache` | BackendTrafficPolicy (compression) | gzip dari gateway |
| `/api/cookie` | BackendTrafficPolicy (consistent hash cookie) | sticky session |

Perilaku bawaan Envoy yang terbukti di infra contoh: **timeout route 15 detik**. `/api/delay?ms=16000` dijawab 504 di detik ke-15 dan stream SSE terpotong di 15 event, sampai `timeouts.request` dinaikkan. Header `x-request-id` dibuat Envoy, dan header `x-envoy-*` tidak diteruskan kecuali `ClientTrafficPolicy.headers.enableEnvoyHeaders: true`.

Nama header identitas ditentukan policy, jadi `/api/secure/whoami` memantau `x-consumer-username` (Kong), `x-client-id` (apiKeyAuth), `x-user` (basicAuth), dan `x-forwarded-user`; env `IDENTITY_HEADERS` menimpanya (mis. untuk `claimToHeaders` JWT).

Status verifikasi: manifest divalidasi terhadap skema CRD (kubeconform `-strict`, 18 resource valid) dan `test.sh` diuji sebagai kontrol negatif terhadap infra yang belum memasang route ini. Manifest **belum dijalankan di cluster Envoy Gateway**, dan `apiKeyAuth` serta `rateLimit.local` butuh versi Envoy Gateway yang cukup baru (±1.4 ke atas).

## Tes API Gateway (Kong, alternatif)

Satu image, dua halaman berbeda: `/blue` dan `/green`. Setelah `k8s/app.yaml` ter-deploy dan Kong Ingress Controller terpasang:

```bash
kubectl apply -f k8s/kong/kong.yaml
PROXY=http://<kong-proxy-ip> API_KEY=<key di Secret demo-user-apikey> bash k8s/kong/test.sh
```

| Route | Plugin Kong | Yang dites |
|---|---|---|
| `/blue` | rate-limiting (5/menit), request-transformer, correlation-id | 200 lalu 429, header `X-Gateway`, `X-Correlation-Id` |
| `/green` | key-auth, cors, request-transformer, correlation-id | 401 tanpa key, 200 dengan header `apikey` |
| `/gw/*` | strip-path | `/gw/api/healthz` sampai ke app sebagai `/api/healthz` |

`/api/gateway` menampilkan header consumer/forwarded yang diinjeksi Kong. Ganti nilai key di `kong.yaml` sebelum dipakai di luar lab.

## Pipeline GitHub Actions (manual)

`.github/workflows/build-push.yml` membangun image lalu mendorongnya ke Docker Hub. Workflow ini **hanya jalan saat dipicu manual** (`workflow_dispatch`): tidak ada trigger `push`, `pull_request`, atau `schedule`.

Persiapan satu kali (Settings → Secrets and variables → Actions):

| Jenis | Nama | Isi |
|---|---|---|
| Secret | `DOCKERHUB_USERNAME` | username Docker Hub |
| Secret | `DOCKERHUB_TOKEN` | Access Token Docker Hub (Account settings → Security → New Access Token, hak *Read & Write*) |
| Variable (opsional) | `DOCKERHUB_REPOSITORY` | nama repository, default `devops-playground` |

Menjalankan: tab **Actions** → **Build and push image** → **Run workflow**, pilih branch, lalu isi (semuanya opsional):

| Input | Fungsi |
|---|---|
| `tag` | tag image; kosong = `sha-<7 karakter commit>` |
| `push_latest` | ikut mendorong tag `latest` |
| `base_path` | build arg `BASE_PATH`, mis. `/playground` untuk deploy di sub-path |
| `run_tests` | jalankan `typecheck` dan `npm test` sebelum build (default aktif) |

Hasilnya: image `<username>/<repository>:<tag>` (linux/amd64) dengan label OCI (commit, waktu build), provenance dan SBOM, plus ringkasan berisi digest. Gunakan digest itu di manifest (`image: user/repo@sha256:...`) agar deploy tidak berubah diam-diam. Input divalidasi sebelum dipakai (tag dan `BASE_PATH` dibatasi karakternya) dan tidak pernah di-interpolasi langsung ke skrip shell.

Catatan: workflow memakai tag versi mayor action (`@v4`, `@v3`, `@v5`, `@v6`); untuk keamanan rantai pasok lebih ketat, pin ke commit SHA. Pipeline ini belum memindai image dengan Trivy sebelum push.

## Ukuran image

Terukur dengan `docker build` (Docker Desktop): **242 MB** di disk, **56 MB** terkompresi (yang ditarik dari registry). Sekitar 200 MB adalah runtime Node milik base distroless, app hanya ~27 MB.

- Multi-stage + Next `output: standalone` (hanya file yang dipakai server).
- `sharp`/libvips (~37 MB) dibuang lewat `outputFileTracingExcludes` + `images.unoptimized`, karena app tidak memakai `next/image`. **Jangan** mengecualikan `@swc/helpers`: dibutuhkan Next saat runtime.
- Runtime `distroless/nodejs24-debian13:nonroot`: punya database paket sehingga Trivy bisa memindai OS; 0 CVE HIGH/CRITICAL saat diukur (varian `debian12` membawa 7 CVE HIGH di libssl3).
- `.dockerignore` mengecualikan `node_modules`, `.next`, `k8s`, `test`, `loadtest`, `scripts`.

Cek ulang: `docker build --pull -t devops-playground:1.0.0 . && docker images devops-playground`.

## Scan

```bash
trivy fs .                                   # dependency + secret + misconfig
trivy image devops-playground:1.0.0
trivy config k8s/ Dockerfile
sonar-scanner                                # pakai sonar-project.properties
```

## Keamanan yang diterapkan

- Dependency minimal (next, react, react-dom), versi dipin, `npm audit` = 0 vuln.
- Image runtime distroless `nodejs24 nonroot` (tanpa shell/apk), user 65532.
- Pod: `readOnlyRootFilesystem`, drop ALL capabilities, seccomp RuntimeDefault, tanpa service account token, PSS `restricted`, NetworkPolicy, resource limits.
- Header kredensial (Authorization, Cookie, apikey, dll) tidak pernah dipantulkan; chaos butuh token (perbandingan timing-safe); `/api/connect` memakai allowlist (anti-SSRF); semua input numerik di-clamp; log JSON hanya berisi nama route tetap (anti log-injection); tanpa `dangerouslySetInnerHTML`.
