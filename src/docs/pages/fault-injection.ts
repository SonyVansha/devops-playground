import type { Doc } from '../types.ts';

export const doc: Doc = {
  slug: 'fault-injection',
  title: 'Fault injection (chaos)',
  summary: 'Toggle probe, bakar CPU, tahan memori, dan crash secara runtime, dilindungi token dan bisa menarget satu pod.',
  blocks: [
    {
      t: 'note',
      kind: 'warn',
      text: 'Endpoint chaos mati secara default. Aktifkan **hanya** di namespace tes: butuh `ENABLE_CHAOS=true` **dan** `CHAOS_TOKEN`. Tanpa salah satunya, semua aksi ditolak (403).',
    },
    { t: 'h', text: 'Aktifkan' },
    {
      t: 'code',
      code: 'kubectl -n playground create secret generic playground-chaos --from-literal=token="$(openssl rand -hex 16)"\nkubectl -n playground set env deploy/playground ENABLE_CHAOS=true\nexport CHAOS_TOKEN=$(kubectl -n playground get secret playground-chaos -o jsonpath=\'{.data.token}\' | base64 -d)',
    },
    {
      t: 'check',
      title: 'Status chaos (tanpa token)',
      command: 'curl -s {{BASE}}/api/chaos',
      expect: '`"enabled":true,"tokenConfigured":true`, plus `ready`, `healthy`, `cpuWorkers`, `heldMb`. Tanpa token: `curl -s -o /dev/null -w "%{http_code}" -X POST {{BASE}}/api/chaos/notready` → `401` (token salah/kosong) atau `403` (chaos nonaktif).',
    },
    { t: 'h', text: 'Aksi' },
    {
      t: 'table',
      head: ['Aksi', 'Perintah (POST + header token)', 'Batas'],
      rows: [
        ['Toggle readiness', '`/api/chaos/notready`', '-'],
        ['Toggle liveness', '`/api/chaos/unhealthy`', '-'],
        ['Bakar CPU', '`/api/chaos/cpu?seconds=30&workers=2`', 'seconds ≤ 120, workers ≤ 4, balas `202` segera'],
        ['Tahan memori', '`/api/chaos/mem?mb=100` (POST); lepas dengan DELETE', '≤ 512 MB per panggilan, total ≤ 1024 MB'],
        ['Crash proses', '`/api/chaos/crash`', 'exit 1 setelah 200 ms'],
      ],
    },
    {
      t: 'code',
      title: 'Contoh',
      code: 'curl -s -X POST -H "X-Chaos-Token: $CHAOS_TOKEN" {{BASE}}/api/chaos/notready\ncurl -s -X POST -H "X-Chaos-Token: $CHAOS_TOKEN" "{{BASE}}/api/chaos/cpu?seconds=60&workers=2"\ncurl -s -X POST -H "X-Chaos-Token: $CHAOS_TOKEN" "{{BASE}}/api/chaos/mem?mb=100"\ncurl -s -X DELETE -H "X-Chaos-Token: $CHAOS_TOKEN" {{BASE}}/api/chaos/mem',
    },
    { t: 'h', text: 'Menarget satu pod' },
    {
      t: 'p',
      text: 'State chaos hanya ada di memori **satu pod**, dan request lewat Service mendarat di pod acak. Tambahkan `?pod=<nama-pod>`: pod lain membalas `409` dengan field `self`, jadi ulangi sampai kena pod yang dimaksud (atau pakai `kubectl port-forward pod/<nama>`).',
    },
    {
      t: 'check',
      title: 'Readiness satu pod dimatikan',
      command: 'POD=$(kubectl -n playground get pod -l app=playground -o name | head -1 | cut -d/ -f2)\nfor i in $(seq 1 10); do curl -s -o /dev/null -w "%{http_code} " -X POST -H "X-Chaos-Token: $CHAOS_TOKEN" "{{BASE}}/api/chaos/notready?pod=$POD"; done; echo\nkubectl -n playground get pods\nkubectl -n playground get endpoints playground',
      expect: 'beberapa `409` (pod lain) dan satu `200` `{"ready":false}`. Pod target menjadi `0/1`, **hilang dari daftar Endpoints**, dan tidak di-restart. Panggil lagi untuk mengembalikan `ready:true`.',
    },
    { t: 'h', text: 'Skenario siap pakai' },
    {
      t: 'check',
      title: 'HPA menambah replika (butuh metrics-server)',
      command: 'kubectl -n playground get hpa playground -w &\ncurl -s -X POST -H "X-Chaos-Token: $CHAOS_TOKEN" "{{BASE}}/api/chaos/cpu?seconds=120&workers=4"',
      expect: 'kolom TARGETS naik di atas 70% dan `REPLICAS` bertambah dari 2 menuju 5. CPU dibakar di worker thread sehingga probe tetap `200` selama beban berjalan.',
    },
    {
      t: 'check',
      title: 'OOMKilled',
      command: 'for i in 1 2 3; do curl -s -X POST -H "X-Chaos-Token: $CHAOS_TOKEN" "{{BASE}}/api/chaos/mem?mb=100"; done\nkubectl -n playground describe pod <nama-pod> | grep -A4 "Last State"',
      expect: 'setelah alokasi menembus limit 256Mi: `Reason: OOMKilled`, `Exit Code: 137`, `RESTARTS` bertambah.',
    },
    {
      t: 'check',
      title: 'Liveness restart',
      command: 'curl -s -X POST -H "X-Chaos-Token: $CHAOS_TOKEN" "{{BASE}}/api/chaos/unhealthy?pod=$POD"\nsleep 40; kubectl -n playground get pod $POD',
      expect: 'liveness gagal 3 kali berturut-turut (periode 10 dtk) → container di-restart; `RESTARTS` naik 1 dan state kembali sehat karena memori proses di-reset.',
    },
    {
      t: 'check',
      title: 'Crash dan restart',
      command: 'curl -s -X POST -H "X-Chaos-Token: $CHAOS_TOKEN" "{{BASE}}/api/chaos/crash?pod=$POD"\nkubectl -n playground get pod $POD -w',
      expect: 'respons `{"crashing":true}`, lalu `RESTARTS` bertambah 1. Ulangi beberapa kali untuk melihat `CrashLoopBackOff`.',
    },
    {
      t: 'note',
      kind: 'info',
      text: 'Dashboard punya tab **Fault injection** yang melakukan hal yang sama lewat tombol; token hanya disimpan di memori browser dan dikirim sebagai header `X-Chaos-Token`.',
    },
  ],
};
