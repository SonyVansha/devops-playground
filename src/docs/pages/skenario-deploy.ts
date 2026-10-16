import type { Doc } from '../types.ts';

export const doc: Doc = {
  slug: 'skenario-deploy',
  title: 'Skenario deploy (env)',
  summary: 'Satu image, banyak peran: boot gagal, start lambat, crash, error rate, latency, dan memory leak lewat env.',
  blocks: [
    {
      t: 'p',
      text: 'Perilaku workload diatur lewat env di Deployment, jadi satu image bisa memerankan versi yang sehat maupun rusak. Semua angka di-clamp ke batas aman. Setelah mengubah env, Deployment melakukan rolling update otomatis.',
    },
    {
      t: 'table',
      head: ['Env', 'Efek', 'Batas'],
      rows: [
        ['`BOOT_FAIL=true`', 'proses exit 1 saat start → CrashLoopBackOff', '-'],
        ['`STARTUP_DELAY_SECONDS=N`', 'startup dan readiness 503 selama N detik', '0–600'],
        ['`CRASH_AFTER_SECONDS=N`', 'proses exit 1 setelah N detik', '0–86400'],
        ['`ERROR_RATE=N`', 'N% request `/api/hello` membalas 500', '0–100'],
        ['`LATENCY_MS=N`', '`/api/hello` menunggu N ms', '0–30000'],
        ['`LEAK_MB_PER_MINUTE=N`', 'memori bertambah N MB tiap menit', '0–256'],
        ['`APP_VERSION=vX`', 'label versi di `/api/hello`, `/api/info`', 'teks bebas'],
      ],
    },
    {
      t: 'check',
      title: 'Lihat perilaku aktif',
      command: 'curl -s {{BASE}}/api/info | grep -o \'"behavior":{[^}]*}\'',
      expect: 'semua `0`/`false` berarti workload sehat. Dashboard (tab Overview) menampilkan hal yang sama.',
    },
    { t: 'h', text: 'Skenario 1: rollout gagal lalu rollback' },
    {
      t: 'code',
      code: 'kubectl -n playground set env deploy/playground BOOT_FAIL=true\nkubectl -n playground rollout status deploy/playground --timeout=60s   # gagal / timeout\nkubectl -n playground get pods                                          # pod baru CrashLoopBackOff\nkubectl -n playground rollout undo deploy/playground                    # rollback',
    },
    {
      t: 'check',
      title: 'Rollout tertahan, traffic aman, rollback pulih',
      command: 'curl -s -o /dev/null -w "%{http_code}\\n" {{BASE}}/api/hello     # tetap 200 saat rollout gagal\nkubectl -n playground rollout history deploy/playground',
      expect: 'selama pod baru crash, request tetap `200` karena pod lama belum diganti (rolling update). Setelah `undo` semua pod `1/1 Running`.',
    },
    {
      t: 'note',
      kind: 'warn',
      text: '`rollout undo` mengembalikan template lama. Jika kamu memakai `set env`, env baru bisa tersisa di spec; hapus dengan `kubectl set env deploy/playground BOOT_FAIL-` (tanda minus di akhir).',
    },
    { t: 'h', text: 'Skenario 2: crash berkala' },
    {
      t: 'code',
      code: 'kubectl -n playground set env deploy/playground CRASH_AFTER_SECONDS=90\nkubectl -n playground get pods -w',
    },
    {
      t: 'check',
      title: 'Restart dan backoff',
      command: 'kubectl -n playground get pods\nkubectl -n playground describe pod <nama-pod> | grep -E "Restart Count|Last State|Reason|Exit Code"',
      expect: '`RESTARTS` naik tiap ±90 dtk, `Exit Code: 1`, dan status akhirnya `CrashLoopBackOff` dengan jeda yang makin panjang.',
    },
    { t: 'h', text: 'Skenario 3: error rate dan latency' },
    {
      t: 'code',
      code: 'kubectl -n playground set env deploy/playground ERROR_RATE=30\n# atau\nkubectl -n playground set env deploy/playground LATENCY_MS=800',
    },
    {
      t: 'check',
      title: 'Ukur error rate dari luar',
      command: 'ok=0; for i in $(seq 1 100); do c=$(curl -s -o /dev/null -w "%{http_code}" {{BASE}}/api/hello); [ "$c" = 200 ] && ok=$((ok+1)); done; echo "sukses=$ok/100"',
      expect: 'dengan `ERROR_RATE=30`, sukses kira-kira 70/100 (acak, bukan persis). Dengan `LATENCY_MS=800`, tiap request ≥ 0,8 dtk (`curl -w "%{time_total}"`).',
    },
    { t: 'h', text: 'Skenario 4: memory leak sampai OOMKilled' },
    {
      t: 'code',
      code: 'kubectl -n playground set env deploy/playground LEAK_MB_PER_MINUTE=40\nkubectl -n playground top pod -l app=playground   # butuh metrics-server',
    },
    {
      t: 'check',
      title: 'OOMKilled',
      command: 'kubectl -n playground describe pod <nama-pod> | grep -A4 "Last State"',
      expect: '`Reason: OOMKilled`, `Exit Code: 137` setelah memori menembus limit 256Mi (±5 menit pada 40 MB/menit). Metric `app_memory_rss_bytes` naik terus sebelum itu.',
    },
    {
      t: 'note',
      kind: 'ok',
      text: 'Selesai bereksperimen? Bersihkan semua env perilaku sekaligus: `kubectl -n playground set env deploy/playground BOOT_FAIL- STARTUP_DELAY_SECONDS- CRASH_AFTER_SECONDS- ERROR_RATE- LATENCY_MS- LEAK_MB_PER_MINUTE-`.',
    },
  ],
};
