import type { Doc } from '../types.ts';

export const doc: Doc = {
  slug: 'api-gateway-kong',
  title: 'API gateway: Kong (alternative)',
  summary: 'For clusters that use Kong: one Service, two pages (blue/green), and the rate-limit, key-auth, strip-path, CORS, and gateway header plugins.',
  blocks: [
    {
      t: 'note',
      kind: 'info',
      text: 'This page is for clusters that use **Kong**. If your infra uses Envoy Gateway, follow the page *API gateway (Envoy Gateway)*; the scenarios and expected results are parallel.',
    },
    {
      t: 'p',
      text: 'One image serves two different pages, `/blue` and `/green`. Kong sits in front of it with different plugins per route so you can check routing, authentication, rate limit, and header transformation.',
    },
    { t: 'h', text: 'Install' },
    {
      t: 'code',
      code: 'kubectl apply -f k8s/app.yaml\nkubectl apply -f k8s/kong/kong.yaml\n# get the Kong proxy address, then:\nexport PROXY=http://<kong-proxy-ip>',
    },
    {
      t: 'note',
      kind: 'warn',
      text: 'Needs the Kong Ingress Controller (`ingressClassName: kong`). The key value in the `demo-user-apikey` Secret is only a placeholder; change it before using it outside a lab. Every request must carry the header `Host: gateway.local`.',
    },
    {
      t: 'table',
      head: ['Route', 'Kong plugin', 'What it tests'],
      rows: [
        ['`/blue`', 'rate-limiting (5/minute), request-transformer, correlation-id', '200 then 429, `X-Gateway` and `X-Correlation-Id` headers'],
        ['`/green`', 'key-auth, cors, request-transformer, correlation-id', '401 without a key, 200 with an `apikey` header'],
        ['`/gw/*`', 'strip-path', '`/gw/api/healthz` reaches the app as `/api/healthz`'],
        ['`/api/secure/whoami`', 'key-auth, request-transformer, correlation-id', 'consumer identity is forwarded to the app'],
      ],
    },
    { t: 'h', text: 'Run the automated test' },
    {
      t: 'check',
      title: 'Kong test script',
      command: 'PROXY=$PROXY API_KEY=$(kubectl -n playground get secret demo-user-apikey -o jsonpath=\'{.data.key}\' | base64 -d) \\\n  bash k8s/kong/test.sh',
      expect: '`PASS` lines for: public blue 200, green without a key 401, green with a wrong key 401, green with a key 200, strip-path 200, and the 7th+ request to `/blue` gets 429.',
    },
    { t: 'h', text: 'Manual checks one by one' },
    {
      t: 'check',
      title: 'Rate limit (/blue)',
      command: 'for i in $(seq 1 7); do curl -s -o /dev/null -w "%{http_code} " -H "Host: gateway.local" $PROXY/blue; done; echo',
      expect: '`200 200 200 200 200 429 429` (limit 5 per minute; wait 1 minute for the quota to recover).',
    },
    {
      t: 'check',
      title: 'Authentication (/green)',
      command: 'curl -s -o /dev/null -w "without key: %{http_code}\\n" -H "Host: gateway.local" $PROXY/green\ncurl -s -o /dev/null -w "with key: %{http_code}\\n" -H "Host: gateway.local" -H "apikey: <key>" $PROXY/green',
      expect: '`without key: 401` and `with key: 200`.',
    },
    {
      t: 'check',
      title: 'Headers added by the gateway',
      command: 'curl -s -H "Host: gateway.local" -H "apikey: <key>" $PROXY/api/secure/whoami?require=1',
      expect: '`"authenticated":true` with `consumer.username` = `demo-user`. The headers `X-Gateway: kong` and `X-Correlation-Id` show up in `/api/gateway`.',
    },
    {
      t: 'check',
      title: 'Strip-path (/gw)',
      command: 'curl -s -H "Host: gateway.local" $PROXY/gw/api/gateway | grep -o \'"receivedPath":"[^"]*"\'',
      expect: '`"receivedPath":"/api/gateway"` (the `/gw` prefix is removed by the gateway), not `/gw/api/gateway`.',
    },
    {
      t: 'check',
      title: 'CORS preflight (/green)',
      command: 'curl -si -X OPTIONS -H "Host: gateway.local" -H "Origin: https://example.com" \\\n  -H "Access-Control-Request-Method: GET" $PROXY/green | grep -i access-control',
      expect: '`access-control-allow-origin: https://example.com`. The CORS plugin answers the preflight **before** key-auth, so no key is needed. For comparison, `/api/cors?mode=app` makes the app add that header.',
    },
    { t: 'h', text: 'Gateway cache (example)' },
    {
      t: 'p',
      text: 'To test the gateway cache, attach the `proxy-cache` plugin to the `/api/cache` route, then look at the `X-Cache-Status` header (`Miss` then `Hit`). The example configuration is **untested** in this repo:',
    },
    {
      t: 'code',
      title: 'KongPlugin proxy-cache (example)',
      code: 'apiVersion: configuration.konghq.com/v1\nkind: KongPlugin\nmetadata:\n  name: proxy-cache\n  namespace: playground\nplugin: proxy-cache\nconfig:\n  response_code: [200]\n  request_method: [GET]\n  content_type: ["application/json"]\n  cache_ttl: 30\n  strategy: memory',
    },
    {
      t: 'note',
      kind: 'warn',
      text: '`X-Consumer-*` is trusted by the app as it is. If pods can be reached directly (without the gateway), clients can forge it. Restrict this with a NetworkPolicy so only the Kong namespace can get in.',
    },
  ],
};
