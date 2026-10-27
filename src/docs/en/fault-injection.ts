import type { Doc } from '../types.ts';

export const doc: Doc = {
  slug: 'fault-injection',
  title: 'Fault injection (chaos)',
  summary: 'Toggle probes, burn CPU, hold memory, and crash at runtime, protected by a token and able to target a single pod.',
  blocks: [
    {
      t: 'note',
      kind: 'warn',
      text: 'The chaos endpoints are off by default. Enable them **only** in a test namespace: they need `ENABLE_CHAOS=true` **and** `CHAOS_TOKEN`. Without either one, every action is rejected (403).',
    },
    { t: 'h', text: 'Enable' },
    {
      t: 'code',
      code: 'kubectl -n playground create secret generic playground-chaos --from-literal=token="$(openssl rand -hex 16)"\nkubectl -n playground set env deploy/playground ENABLE_CHAOS=true\nexport CHAOS_TOKEN=$(kubectl -n playground get secret playground-chaos -o jsonpath=\'{.data.token}\' | base64 -d)',
    },
    {
      t: 'check',
      title: 'Chaos status (no token)',
      command: 'curl -s {{BASE}}/api/chaos',
      expect: '`"enabled":true,"tokenConfigured":true`, plus `ready`, `healthy`, `cpuWorkers`, `heldMb`. Without a token: `curl -s -o /dev/null -w "%{http_code}" -X POST {{BASE}}/api/chaos/notready` → `401` (wrong/empty token) or `403` (chaos disabled).',
    },
    { t: 'h', text: 'Actions' },
    {
      t: 'table',
      head: ['Action', 'Command (POST + token header)', 'Limits'],
      rows: [
        ['Toggle readiness', '`/api/chaos/notready`', '-'],
        ['Toggle liveness', '`/api/chaos/unhealthy`', '-'],
        ['Burn CPU', '`/api/chaos/cpu?seconds=30&workers=2`', 'seconds ≤ 120, workers ≤ 4, replies `202` immediately'],
        ['Hold memory', '`/api/chaos/mem?mb=100` (POST); release with DELETE', '≤ 512 MB per call, total ≤ 1024 MB'],
        ['Crash the process', '`/api/chaos/crash`', 'exit 1 after 200 ms'],
      ],
    },
    {
      t: 'code',
      title: 'Examples',
      code: 'curl -s -X POST -H "X-Chaos-Token: $CHAOS_TOKEN" {{BASE}}/api/chaos/notready\ncurl -s -X POST -H "X-Chaos-Token: $CHAOS_TOKEN" "{{BASE}}/api/chaos/cpu?seconds=60&workers=2"\ncurl -s -X POST -H "X-Chaos-Token: $CHAOS_TOKEN" "{{BASE}}/api/chaos/mem?mb=100"\ncurl -s -X DELETE -H "X-Chaos-Token: $CHAOS_TOKEN" {{BASE}}/api/chaos/mem',
    },
    { t: 'h', text: 'Targeting a single pod' },
    {
      t: 'p',
      text: 'Chaos state lives only in the memory of **one pod**, and requests through the Service land on a random pod. Add `?pod=<pod-name>`: other pods reply `409` with a `self` field, so repeat until you hit the intended pod (or use `kubectl port-forward pod/<name>`).',
    },
    {
      t: 'check',
      title: 'Readiness of one pod turned off',
      command: 'POD=$(kubectl -n playground get pod -l app=playground -o name | head -1 | cut -d/ -f2)\nfor i in $(seq 1 10); do curl -s -o /dev/null -w "%{http_code} " -X POST -H "X-Chaos-Token: $CHAOS_TOKEN" "{{BASE}}/api/chaos/notready?pod=$POD"; done; echo\nkubectl -n playground get pods\nkubectl -n playground get endpoints playground',
      expect: 'several `409` (other pods) and one `200` `{"ready":false}`. The target pod becomes `0/1`, **disappears from the Endpoints list**, and is not restarted. Call it again to restore `ready:true`.',
    },
    { t: 'h', text: 'Ready-made scenarios' },
    {
      t: 'check',
      title: 'HPA adds replicas (needs metrics-server)',
      command: 'kubectl -n playground get hpa playground -w &\ncurl -s -X POST -H "X-Chaos-Token: $CHAOS_TOKEN" "{{BASE}}/api/chaos/cpu?seconds=120&workers=4"',
      expect: 'the TARGETS column rises above 70% and `REPLICAS` grows from 2 toward 5. CPU is burned in a worker thread, so probes stay `200` while the load runs.',
    },
    {
      t: 'check',
      title: 'OOMKilled',
      command: 'for i in 1 2 3; do curl -s -X POST -H "X-Chaos-Token: $CHAOS_TOKEN" "{{BASE}}/api/chaos/mem?mb=100"; done\nkubectl -n playground describe pod <pod-name> | grep -A4 "Last State"',
      expect: 'after the allocation passes the 256Mi limit: `Reason: OOMKilled`, `Exit Code: 137`, `RESTARTS` increases.',
    },
    {
      t: 'check',
      title: 'Liveness restart',
      command: 'curl -s -X POST -H "X-Chaos-Token: $CHAOS_TOKEN" "{{BASE}}/api/chaos/unhealthy?pod=$POD"\nsleep 40; kubectl -n playground get pod $POD',
      expect: 'liveness fails 3 times in a row (10 s period) → the container is restarted; `RESTARTS` goes up by 1 and the state is healthy again because process memory is reset.',
    },
    {
      t: 'check',
      title: 'Crash and restart',
      command: 'curl -s -X POST -H "X-Chaos-Token: $CHAOS_TOKEN" "{{BASE}}/api/chaos/crash?pod=$POD"\nkubectl -n playground get pod $POD -w',
      expect: 'response `{"crashing":true}`, then `RESTARTS` goes up by 1. Repeat a few times to see `CrashLoopBackOff`.',
    },
    {
      t: 'note',
      kind: 'info',
      text: 'The dashboard has a **Fault injection** tab that does the same thing with buttons. The token is only kept in browser memory and sent as the `X-Chaos-Token` header.',
    },
  ],
};
