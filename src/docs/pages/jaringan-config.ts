import type { Doc } from '../types.ts';

export const doc: Doc = {
  slug: 'jaringan-config',
  title: 'Jaringan & config',
  summary: 'Tes DNS dan egress dari dalam pod, header yang diterima, path routing, dan verifikasi ConfigMap/Secret ter-mount.',
  blocks: [
    { t: 'h', text: 'Tes DNS, TCP, dan HTTP dari dalam pod' },
    {
      t: 'p',
      text: '`/api/connect` memeriksa konektivitas **dari pod** ke host tertentu. Untuk mencegah SSRF, hanya host yang terdaftar di env `CONNECT_ALLOWLIST` (dipisah koma) yang boleh dituju; kosong berarti semua ditolak (403). Manifest mengisinya dengan `kubernetes.default.svc,playground.playground.svc.cluster.local`.',
    },
    {
      t: 'table',
      head: ['type', 'target', 'Hasil'],
      rows: [
        ['`dns`', 'hostname', '`{"reachable":true,"addresses":[...]}`'],
        ['`tcp`', '`host:port`', '`reachable` + latensi, timeout 3 dtk'],
        ['`http`', 'URL `http(s)://...`', '`reachable` + status code (redirect tidak diikuti)'],
      ],
    },
    {
      t: 'check',
      title: 'DNS, TCP, dan penolakan host',
      command: 'curl -s "{{BASE}}/api/connect?type=dns&target=kubernetes.default.svc"\ncurl -s "{{BASE}}/api/connect?type=tcp&target=kubernetes.default.svc:443"\ncurl -s -o /dev/null -w "host asing: %{http_code}\\n" "{{BASE}}/api/connect?type=dns&target=example.com"',
      expect: 'DNS dan TCP: `"reachable":true`. Host di luar allowlist: `403` (`host not in allowlist`). Jika DNS gagal, `"reachable":false` dengan kode seperti `ENOTFOUND`.',
    },
    {
      t: 'check',
      title: 'NetworkPolicy egress memblokir',
      command: 'kubectl -n playground apply -f - <<EOF\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata: {name: deny-egress, namespace: playground}\nspec:\n  podSelector: {matchLabels: {app: playground}}\n  policyTypes: [Egress]\nEOF\ncurl -s "{{BASE}}/api/connect?type=tcp&target=kubernetes.default.svc:443"',
      expect: 'setelah policy deny-egress aktif (butuh CNI yang mendukung NetworkPolicy): `"reachable":false` dengan `"error":"TIMEOUT"`. Hapus policy untuk memulihkan: `kubectl -n playground delete networkpolicy deny-egress`.',
    },
    { t: 'h', text: 'Header dan path yang diterima app' },
    {
      t: 'check',
      title: 'Ingress/gateway meneruskan header dengan benar',
      command: 'curl -s -H "X-Forwarded-For: 1.2.3.4" {{BASE}}/api/headers\ncurl -s {{BASE}}/api/gateway',
      expect: '`/api/headers` menampilkan semua header (kredensial `[REDACTED]`) beserta `path`. `/api/gateway` merangkum header gateway: `x-forwarded-*`, `x-consumer-*`, `x-correlation-id`, `traceparent`, dan `pod` yang melayani.',
    },
    {
      t: 'check',
      title: 'Rewrite / prefix',
      command: 'curl -s -o /dev/null -w "%{http_code}\\n" {{BASE}}/path/a/b/c\ncurl -s {{BASE}}/path/a/b/c | grep -o "Path diterima app[^<]*<code>[^<]*"',
      expect: '`200` dan halaman menampilkan path persis yang sampai ke app. Jika ingress memakai rewrite/strip-path, path di halaman berbeda dari path yang kamu panggil, itulah yang diperiksa.',
    },
    {
      t: 'note',
      kind: 'info',
      text: '`basePath` Next.js bersifat **build-time**. Untuk menguji ingress dengan sub-path, build image dengan `--build-arg BASE_PATH=/playground`. Satu image tidak bisa melayani dua prefix berbeda.',
    },
    { t: 'h', text: 'Verifikasi ConfigMap dan Secret ter-mount' },
    {
      t: 'p',
      text: '`/api/config` menampilkan **nama file, ukuran, dan checksum** (12 karakter pertama SHA-256) dari direktori `CONFIG_DIR` (default `/etc/playground`), tanpa pernah menampilkan isinya. Manifest memasang ConfigMap `playground-config` ke sana.',
    },
    {
      t: 'check',
      title: 'Config baru sampai ke pod tanpa restart',
      command: 'curl -s {{BASE}}/api/config\nkubectl -n playground patch configmap playground-config --type merge -p \'{"data":{"message":"hello v2"}}\'\nsleep 90\ncurl -s {{BASE}}/api/config',
      expect: 'checksum file `message` **berubah** setelah sinkronisasi kubelet (±1 menit) dan `RESTARTS` tetap 0. Jika `"mounted":false`, volume belum terpasang (cek nama ConfigMap dan `CONFIG_DIR`). Catatan: mount dengan `subPath` tidak ikut diperbarui.',
    },
  ],
};
