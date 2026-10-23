import type { Doc } from '../types.ts';

export const doc: Doc = {
  slug: 'build-dan-scan',
  title: 'Build, test & scan',
  summary: 'Menjalankan test dan coverage, membangun image, mengecek ukuran, serta scan Trivy dan SonarQube.',
  blocks: [
    { t: 'h', text: 'Test' },
    {
      t: 'code',
      code: 'npm run typecheck\nnpm test\nnpm run test:coverage     # menulis lcov.info untuk SonarQube',
    },
    {
      t: 'check',
      title: 'Semua test lulus',
      command: 'npm test 2>&1 | grep -E "^ℹ (tests|pass|fail)"',
      expect: '`fail 0` dan `pass` sama dengan `tests`. Test mencakup route (termasuk multi-hop lewat HTTP sungguhan), auth, cache, dan isi docs ini.',
    },
    { t: 'h', text: 'Build image' },
    {
      t: 'code',
      code: 'docker build --pull -t devops-playground:1.0.0 .\n# untuk uji ingress dengan sub-path:\ndocker build --build-arg BASE_PATH=/playground -t devops-playground:1.0.0 .',
    },
    {
      t: 'check',
      title: 'Ukuran image',
      command: 'docker images devops-playground:1.0.0 --format "{{.Size}}"',
      expect: 'sekitar `242MB` di disk (≈ 56 MB terkompresi): sekitar 200 MB adalah runtime Node milik base distroless, app ±27 MB. Lihat catatan di README tentang `sharp` dan `@swc/helpers` sebelum mengubah daftar exclude.',
    },
    {
      t: 'check',
      title: 'Image jalan dalam mode ketat',
      command: 'export MSYS_NO_PATHCONV=1   # hanya Git Bash Windows\ndocker run -d --name dp --read-only --tmpfs /tmp --tmpfs /app/.next/cache --cap-drop ALL \\\n  --security-opt no-new-privileges -p 3000:3000 -m 256m devops-playground:1.0.0\nsleep 6; BASE_URL=http://localhost:3000 bash scripts/smoke.sh; docker rm -f dp',
      expect: 'semua `PASS`. Container berjalan sebagai user `65532` (nonroot), filesystem read-only, tanpa capability.',
    },
    { t: 'h', text: 'Push ke Docker Hub (GitHub Actions)' },
    {
      t: 'p',
      text: 'Workflow `.github/workflows/build-push.yml` membangun image dan mendorongnya ke Docker Hub. Ia **hanya jalan saat dipicu manual** (`workflow_dispatch`), tidak ada trigger otomatis dari push atau pull request.',
    },
    {
      t: 'ol',
      items: [
        'Di GitHub: Settings → Secrets and variables → Actions, buat secret `DOCKERHUB_USERNAME` dan `DOCKERHUB_TOKEN` (Access Token Docker Hub dengan hak Read & Write).',
        'Opsional: buat variable `DOCKERHUB_REPOSITORY` bila nama repository berbeda dari `devops-playground`.',
        'Buka tab Actions → Build and push image → Run workflow, pilih branch, isi `tag` (kosong = `sha-<7 karakter commit>`), lalu jalankan.',
      ],
    },
    {
      t: 'table',
      head: ['Input', 'Fungsi'],
      rows: [
        ['`tag`', 'tag image; kosong = `sha-` + 7 karakter pertama commit'],
        ['`push_latest`', 'ikut mendorong tag `latest`'],
        ['`base_path`', 'build arg `BASE_PATH`, mis. `/playground` untuk deploy di sub-path'],
        ['`run_tests`', 'jalankan typecheck dan test sebelum build (default aktif)'],
      ],
    },
    {
      t: 'check',
      title: 'Image sudah ada di Docker Hub',
      command: 'docker pull <username>/devops-playground:<tag>\ndocker run --rm -p 3000:3000 <username>/devops-playground:<tag>',
      expect: 'image berhasil ditarik dan app jalan di `http://localhost:3000`. Ringkasan run di GitHub menampilkan digest `sha256:...`; pakai `image: <username>/devops-playground@sha256:...` di manifest agar deploy tidak berubah diam-diam.',
    },
    {
      t: 'note',
      kind: 'warn',
      text: 'Workflow belum memindai image dengan Trivy sebelum push, dan action memakai tag versi mayor (`@v4`, `@v6`) bukan commit SHA. Untuk lingkungan yang lebih ketat, tambahkan langkah scan dan pin action ke SHA.',
    },
    { t: 'h', text: 'Trivy' },
    {
      t: 'code',
      code: 'trivy image --severity HIGH,CRITICAL devops-playground:1.0.0\ntrivy fs --scanners vuln,secret,misconfig --severity HIGH,CRITICAL --skip-dirs node_modules --skip-dirs .next .\n# tanpa instal Trivy:\ndocker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:latest image devops-playground:1.0.0',
    },
    {
      t: 'check',
      title: 'Hasil yang diharapkan',
      command: 'trivy image --severity HIGH,CRITICAL --exit-code 1 devops-playground:1.0.0; echo "exit=$?"',
      expect: '`Total: 0` untuk OS (`debian 13`) dan untuk `Node.js`, serta `exit=0`. Saat diukur terakhir kali: 0 vulnerability HIGH/CRITICAL dan 0 secret; Dockerfile dan manifest K8s 0 misconfiguration. Hasil ini hanya berlaku pada saat pengukuran; scan ulang secara berkala karena CVE baru terus muncul.',
    },
    {
      t: 'note',
      kind: 'info',
      text: 'Base `distroless/nodejs24-debian13` dipilih karena `debian12` membawa CVE HIGH di libssl3 yang belum diperbarui upstream. Pin base image dengan digest di CI agar build bisa direproduksi.',
    },
    { t: 'h', text: 'Membaca hasil scan platform' },
    {
      t: 'p',
      text: 'Bila deploy lewat platform yang memindai build (secret, SCA, SAST, IaC, image), temuan umum untuk repo ini dan cara menanganinya:',
    },
    {
      t: 'table',
      head: ['Temuan', 'Arti', 'Tindakan'],
      rows: [
        ['`curl-auth-header` / `curl-auth-user` (gitleaks)', 'contoh perintah `curl` yang menyertakan kredensial literal; confidence rendah', 'sudah diganti memakai variabel di skrip dan docs, jadi tidak lagi terdeteksi'],
        ['`KSV-0125` (Trivy IaC)', 'image di manifest memakai registry yang tidak dikenal (dulu `registry.example.com`)', 'manifest sekarang memakai `docker.io/your-dockerhub-user/...`, sesuai tempat CI mendorong image; ganti `your-dockerhub-user` dengan username Docker Hub-mu. Bila memakai registry lain, daftarkan sebagai tepercaya di kebijakan Trivy atau tandai waiver'],
        ['`DS-0026` (Trivy IaC)', 'Dockerfile tanpa `HEALTHCHECK`', 'sudah ditambahkan memakai Node (distroless tidak punya shell/curl); Kubernetes tetap memakai probe'],
        ['CVE medium/low di `libc6`, `libgcc-s1`, `libstdc++6`, `zlib1g`', 'paket Debian dari base image distroless, kolom fixed version kosong', 'tidak bisa diperbaiki dari sisi app; kebijakan default hanya memblokir yang punya perbaikan dan berstatus critical. Pantau, build ulang saat base diperbarui, atau waiver'],
      ],
    },
    { t: 'h', text: 'SonarQube' },
    {
      t: 'code',
      code: 'npm run test:coverage\nsonar-scanner -Dsonar.host.url=<url> -Dsonar.token=<token>',
    },
    {
      t: 'p',
      text: '`sonar-project.properties` sudah mengarah ke `lcov.info`, mengecualikan komponen UI dan file lifecycle dari coverage, dan menandai file test. SonarQube **belum pernah dijalankan** terhadap repo ini, jadi temuan nyata mungkin muncul; perbaiki berdasarkan laporannya.',
    },
  ],
};
