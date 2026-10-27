import type { Doc } from '../types.ts';

export const doc: Doc = {
  slug: 'multi-hop',
  title: 'Multi-hop & dependencies',
  summary: 'The tier-a → tier-b → tier-c chain: trace propagation, cascading failures, and dependency-based readiness.',
  blocks: [
    {
      t: 'p',
      text: '`/api/chain?depth=N` makes the app call the next app (from the `UPSTREAM_URL` env) for N hops. Good for testing service-to-service calls, service mesh, trace propagation, timeouts, and cascading failures.',
    },
    { t: 'h', text: 'Deploy the three tiers' },
    {
      t: 'code',
      code: 'kubectl apply -f k8s/chain/chain.yaml\nkubectl -n playground get pods -l "app in (tier-a,tier-b,tier-c)"\nkubectl -n playground port-forward svc/tier-a 3000:80',
    },
    {
      t: 'table',
      head: ['Tier', 'UPSTREAM_URL', 'DEPENDENCY_URL (readiness)'],
      rows: [
        ['tier-a', 'tier-b', 'tier-b `/api/readyz`'],
        ['tier-b', 'tier-c', 'tier-c `/api/readyz`'],
        ['tier-c', '(none, leaf)', '(none)'],
      ],
    },
    { t: 'h', text: 'Check the healthy chain' },
    {
      t: 'check',
      title: 'Three hops with the same trace',
      command: 'curl -s -H "traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01" \\\n  -H "x-request-id: req-42" "{{BASE}}/api/chain?depth=2" | grep -oE \'"(pod|traceId|requestId)":"[^"]*"\'',
      expect: 'three pods in order (`tier-a`, `tier-b`, `tier-c`), an identical `traceId` `0af7651916cd43dd8448eb211c80319c` on every hop, and `requestId` = `req-42`. Each hop has a different `spanId`, and the `parentSpanId` of the next hop = the `spanId` of the hop above it.',
    },
    {
      t: 'note',
      kind: 'info',
      text: 'Without a `traceparent` header, the first hop creates a new `traceId`. Other headers that are forwarded: `tracestate`, `b3`, `x-b3-*`, `x-correlation-id`. Depth is limited to 5 hops.',
    },
    { t: 'h', text: 'Cascading failure' },
    { t: 'code', code: 'kubectl -n playground scale deploy/tier-c --replicas=0' },
    {
      t: 'check',
      title: '502 propagates upward, readiness drops, no restarts',
      command: 'curl -s -o /dev/null -w "chain=%{http_code}\\n" "{{BASE}}/api/chain?depth=2"\ncurl -s -o /dev/null -w "readyz=%{http_code}\\n" {{BASE}}/api/readyz\ncurl -s -o /dev/null -w "healthz=%{http_code}\\n" {{BASE}}/api/healthz\nkubectl -n playground get pods',
      expect: '`chain=502`, `readyz=503`, `healthz=200`, and the `RESTARTS` column is `0` everywhere. The 502 body contains `"error":"downstream failed"` with details in `downstream`. The dependent tiers (b, then a) show `0/1` but are not restarted.',
    },
    { t: 'code', code: 'kubectl -n playground scale deploy/tier-c --replicas=1' },
    {
      t: 'check',
      title: 'Automatic recovery',
      command: 'sleep 15; curl -s -o /dev/null -w "chain=%{http_code} readyz=%{http_code}\\n" "{{BASE}}/api/chain?depth=2"',
      expect: '`chain=200` and all pods return to `1/1` with no intervention.',
    },
    { t: 'h', text: 'Timeouts and latency' },
    {
      t: 'code',
      code: 'kubectl -n playground set env deploy/tier-c LATENCY_MS=5000\n# default CHAIN_TIMEOUT_MS=3000 -> the hop above it times out',
    },
    {
      t: 'check',
      title: 'Slow hop is detected',
      command: 'curl -s -w "\\nHTTP %{http_code} in %{time_total}s\\n" "{{BASE}}/api/chain?depth=2"',
      expect: 'HTTP `502` with `"downstream":{"error":"TIMEOUT"}` in about 3 seconds (not 5), matching `CHAIN_TIMEOUT_MS`. Raise its value (max 30000) to test a more relaxed timeout.',
    },
    {
      t: 'note',
      kind: 'ok',
      text: 'Security: `UPSTREAM_URL` and `DEPENDENCY_URL` are read only from env, never from request parameters, so this endpoint cannot be used for SSRF. To test connectivity to other hosts, use `/api/connect` (see Network & config).',
    },
  ],
};
