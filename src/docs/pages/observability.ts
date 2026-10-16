import type { Doc } from '../types.ts';

export const doc: Doc = {
  slug: 'observability',
  title: 'Metrics & log',
  summary: 'Metric Prometheus, contoh query PromQL, dan log JSON terstruktur untuk alerting dan pipeline log.',
  blocks: [
    { t: 'h', text: 'Metrics (Prometheus)' },
    {
      t: 'p',
      text: '`/api/metrics` memakai format teks Prometheus. Nama route di label selalu string tetap dari kode (bukan input pengguna), jadi kardinalitas terbatas.',
    },
    {
      t: 'table',
      head: ['Metric', 'Jenis', 'Arti'],
      rows: [
        ['`app_uptime_seconds`', 'gauge', 'umur proses'],
        ['`app_ready`, `app_healthy`, `app_draining`', 'gauge', 'status 1/0'],
        ['`app_dependency_up`', 'gauge', '1/0; hanya ada bila `DEPENDENCY_URL` dikonfigurasi'],
        ['`app_memory_rss_bytes`', 'gauge', 'RSS proses (naik pada skenario leak)'],
        ['`app_http_requests_total{route,status}`', 'counter', 'request per route dan status'],
        ['`app_http_request_duration_ms_sum` / `_count`', 'counter', 'total durasi dan jumlah per route'],
      ],
    },
    {
      t: 'check',
      title: 'Metric terbentuk',
      command: 'curl -s {{BASE}}/api/hello > /dev/null\ncurl -s {{BASE}}/api/metrics | grep -E \'app_http_requests_total\\{route="hello"|app_memory_rss\'',
      expect: 'baris `app_http_requests_total{route="hello",status="200"} N` dengan N bertambah tiap kali kamu memanggil `/api/hello`, serta `app_memory_rss_bytes`.',
    },
    {
      t: 'code',
      title: 'Contoh PromQL (setelah Prometheus men-scrape pod)',
      code: '# error rate /api/hello (5 menit)\nsum(rate(app_http_requests_total{route="hello",status=~"5.."}[5m]))\n  / sum(rate(app_http_requests_total{route="hello"}[5m]))\n\n# latensi rata-rata /api/hello (ms)\nrate(app_http_request_duration_ms_sum{route="hello"}[5m])\n  / rate(app_http_request_duration_ms_count{route="hello"}[5m])\n\n# pod yang tidak ready atau sedang draining\napp_ready == 0 or app_draining == 1',
    },
    {
      t: 'note',
      kind: 'warn',
      text: 'Repo ini **belum** menyertakan `ServiceMonitor` atau `PrometheusRule`. Tambahkan sendiri sesuai setup Prometheus-mu: scrape `/api/metrics` pada port `http`. Metric ini menjadi dasar alert untuk skenario error rate, crash, dan OOM.',
    },
    { t: 'h', text: 'Log JSON' },
    {
      t: 'p',
      text: 'Setiap request (kecuali probe dan metrics, supaya log tidak banjir) menulis satu baris JSON ke stdout. Log hanya berisi nama route tetap, method, status, dan durasi, **tanpa input pengguna**, sehingga aman dari log injection.',
    },
    {
      t: 'check',
      title: 'Format log',
      command: 'curl -s {{BASE}}/api/hello > /dev/null\nkubectl -n playground logs -l app=playground --tail=3',
      expect: 'baris seperti `{"ts":"2026-...","level":"info","route":"hello","method":"GET","status":200,"ms":0}`. Event siklus hidup (`signal received, draining`, `BOOT_FAIL=true, exiting`) tercatat dengan `level` `info`/`warn`.',
    },
    {
      t: 'check',
      title: 'Ikuti log selama skenario',
      command: 'kubectl -n playground logs -f deploy/playground | grep -E \'"status":5|draining|exiting\'',
      expect: 'baris `status:500` muncul saat `ERROR_RATE` aktif; `draining` saat pod dihentikan; `exiting` saat `BOOT_FAIL`/`CRASH_AFTER_SECONDS`.',
    },
  ],
};
