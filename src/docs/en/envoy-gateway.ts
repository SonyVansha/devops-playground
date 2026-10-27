import type { Doc } from '../types.ts';

export const doc: Doc = {
  slug: 'api-gateway-envoy',
  title: 'API gateway (Envoy Gateway)',
  summary: 'Routing, auth, rate limit, retry, timeout, and compression through Gateway API and Envoy Gateway policies, plus default behaviors that often surprise people.',
  blocks: [
    {
      t: 'p',
      text: 'Envoy Gateway is an Envoy-based implementation of the **Gateway API**. Routing uses standard objects (`Gateway`, `HTTPRoute`). Extra features (rate limit, auth, retry, compression) are attached through the policies `BackendTrafficPolicy`, `SecurityPolicy`, and `ClientTrafficPolicy`, which point to a Gateway or a route.',
    },
    {
      t: 'note',
      kind: 'warn',
      text: 'The manifests in `k8s/envoy-gateway/` **have not been run on an Envoy Gateway cluster yet**. What has been done: validation against the CRD schemas (18 valid resources, wrong fields rejected) and a run of the `test.sh` script as a negative control. `apiKeyAuth` and `rateLimit.local` need a fairly recent Envoy Gateway (about 1.4 or newer). Check with `kubectl explain securitypolicy.spec` and `kubectl apply --dry-run=server`.',
    },
    { t: 'h', text: 'Default behaviors to know' },
    {
      t: 'table',
      head: ['Behavior', 'Effect on this app', 'How to change it'],
      rows: [
        [
          'Envoy default route timeout is **15 seconds**',
          '`/api/delay?ms=16000` returns 504 at second 15, and an `/api/sse` stream longer than 15 seconds is cut off without a `done` event',
          '`timeouts.request` on the `HTTPRoute` rule (`0s` = no limit, good for streaming)',
        ],
        ['`x-envoy-*` headers are not forwarded to the app', '`/api/gateway` does not show `x-envoy-attempt-count` and similar headers', '`ClientTrafficPolicy` → `headers.enableEnvoyHeaders: true`'],
        ['`x-request-id` is created by Envoy if missing', 'shown in `/api/gateway` and passed on by `/api/chain` to the next hop', 'no setup needed'],
        ['`x-forwarded-port` holds the Envoy listener port (e.g. `8080`), not the public port', 'visible in `/api/gateway`', 'do not use it to build public URLs; use `x-forwarded-host` and `x-forwarded-proto`'],
        ['Client IP is taken from `x-forwarded-for`', 'the IP is correct only if the number of trusted proxies in front of Envoy (CDN, load balancer) is set', '`ClientTrafficPolicy` → `clientIPDetection.xForwardedFor.numTrustedHops`'],
        ['`Local` rate limit is counted **per Envoy replica**', 'with 2 Envoy replicas, the effective limit can be doubled', '`rateLimit.type: Global` (needs Redis) for a shared limit'],
      ],
    },
    {
      t: 'check',
      title: 'Default 15-second route timeout',
      command: 'for ms in 8000 14000 16000; do\n  curl -s -o /dev/null -w "delay ${ms}ms -> HTTP %{http_code} setelah %{time_total}s\\n" "{{BASE}}/api/delay?ms=$ms"\ndone',
      expect: '8000 and 14000 → `200`; 16000 → `504` after about 15 seconds. If `504` shows up at second 15 while the app is healthy, it is the route timeout, not an app bug. After you apply `routes.yaml` (35-second timeout on `/api/delay`), 16000 ms becomes `200`.',
    },
    {
      t: 'check',
      title: 'Headers added by the proxy',
      command: 'curl -s {{BASE}}/api/gateway',
      expect: 'the `gateway` field contains `x-request-id` (created by Envoy), `x-forwarded-for`, `x-forwarded-host`, `x-forwarded-proto`, and `x-forwarded-port`. `x-envoy-*` headers only appear after you enable `enableEnvoyHeaders`.',
    },
    { t: 'h', text: 'Install' },
    {
      t: 'code',
      code: 'kubectl apply -f k8s/app.yaml\n# optional, only if the cluster has no Gateway yet:\nkubectl apply -f k8s/envoy-gateway/gateway.yaml\nkubectl apply -f k8s/envoy-gateway/routes.yaml\n\n# Gateway address\nkubectl -n playground get gateway playground-gateway\nexport PROXY=http://<gateway-address>',
    },
    {
      t: 'note',
      kind: 'info',
      text: 'On a platform that already provides a Gateway, skip `gateway.yaml` and change `parentRefs.name` in `routes.yaml` to point to the platform Gateway. All routes use the host `gateway.local`; adjust `hostnames`. The API key values in the `demo-apikeys` Secret are only placeholders.',
    },
    {
      t: 'table',
      head: ['Route', 'Resource', 'What it tests'],
      rows: [
        ['`/blue`', 'HTTPRoute + BackendTrafficPolicy (rate limit 5/minute) + `X-Gateway` header', '200 then 429; `x-gateway` header shown on the page'],
        ['`/green`', 'HTTPRoute + SecurityPolicy (apiKeyAuth + CORS)', '401 without a key, 200 with an `apikey` header, CORS preflight'],
        ['`/gw/*`', 'HTTPRoute + `URLRewrite` filter', 'the `/gw` prefix is removed before the request reaches the app'],
        ['`/api/secure/whoami`', 'HTTPRoute + SecurityPolicy (apiKeyAuth)', 'client identity is forwarded through `x-client-id`'],
        ['`/api/flaky`', 'HTTPRoute + BackendTrafficPolicy (retry)', 'failures drop from about 30% to close to 0'],
        ['`/api/delay`', 'HTTPRoute (`timeouts.request: 35s`)', 'a 20-second request goes through'],
        ['`/api/sse`', 'HTTPRoute (`timeouts.request: 0s`)', 'an 18-second stream is not cut off'],
        ['`/api/cache`', 'HTTPRoute + BackendTrafficPolicy (compression)', '`Content-Encoding: gzip` from the gateway'],
        ['`/api/cookie`', 'HTTPRoute + BackendTrafficPolicy (consistent hash cookie)', 'sticky session (needs ≥ 2 replicas)'],
      ],
    },
    {
      t: 'check',
      title: 'Automated test script',
      command: 'PROXY=$PROXY API_KEY=$(kubectl -n playground get secret demo-apikeys -o jsonpath=\'{.data.demo-user}\' | base64 -d) \\\n  bash k8s/envoy-gateway/test.sh\n# add SLOW=1 to test timeouts and streaming (about 40 seconds)',
      expect: '`PASS` lines for gateway headers, rate limit (429 after 5 requests), wrong/right key, CORS, strip-path, identity, retry, compression, and sticky session. The script exits with a non-zero code if anything is `FAIL`. Run against infra without these routes, the script reports FAIL for retry (about 28% failed), timeout (504), and streaming (15 events), so it really tells the two cases apart.',
    },
    { t: 'h', text: 'Manual checks one by one' },
    {
      t: 'check',
      title: 'Rate limit (/blue)',
      command: 'for i in $(seq 1 7); do curl -s -o /dev/null -w "%{http_code} " -H "Host: gateway.local" $PROXY/blue; done; echo',
      expect: '`200 200 200 200 200 429 429`. The quota is 5 per minute; wait 60 seconds for it to recover.',
    },
    {
      t: 'check',
      title: 'Retry hides random failures (/api/flaky)',
      command: 'for i in $(seq 1 60); do curl -s -o /dev/null -w "%{http_code}\\n" -H "Host: gateway.local" "$PROXY/api/flaky?rate=30&status=503"; done | sort | uniq -c',
      expect: 'almost all `200` (failure chance 0.3⁴ ≈ 0.8% per request). Without the retry policy, about 18 of 60 fail.',
    },
    {
      t: 'check',
      title: 'Long stream is not cut off (/api/sse)',
      command: 'curl -sN -H "Host: gateway.local" "$PROXY/api/sse?events=18&interval=1000" | grep -c "^id:"',
      expect: '`18`, and at the end `event: done` appears. Without `timeouts.request: 0s`, only 15 events arrive.',
    },
    {
      t: 'check',
      title: 'Compression from the gateway (/api/cache)',
      command: 'curl -s -D - -o /dev/null -H "Host: gateway.local" -H "Accept-Encoding: gzip" "$PROXY/api/cache?kb=200" | grep -i content-encoding',
      expect: '`content-encoding: gzip`. The app itself does not compress unless `gzip=1`, so this header comes from the gateway (or a CDN in front of it, if there is one).',
    },
    { t: 'h', text: 'Identity to the app' },
    {
      t: 'p',
      text: 'The identity header name is set by the policy, so `/api/secure/whoami` watches several default names: `x-consumer-username` (Kong), `x-client-id` (`apiKeyAuth.forwardClientIDHeader`), `x-user` (`basicAuth.forwardUsernameHeader`), and `x-forwarded-user`. For other names, e.g. JWT claims through `claimToHeaders`, set the env `IDENTITY_HEADERS` (comma-separated, order = priority).',
    },
    {
      t: 'check',
      title: 'Identity from an API key',
      command: 'curl -s -H "Host: gateway.local" -H "apikey: <key>" "$PROXY/api/secure/whoami?require=1"',
      expect: '`"authenticated":true`, `"identityHeader":"x-client-id"`, and `consumer.username` holds the client ID from the Secret (`demo-user`). Without a key, the gateway replies 401 before the request reaches the app.',
    },
    {
      t: 'note',
      kind: 'warn',
      text: 'The app trusts identity headers as they are. If pods can be reached directly without going through Envoy, clients can forge them. Restrict this with a NetworkPolicy that only allows the proxy namespace (e.g. `envoy-gateway-system`), and make sure the gateway strips the same headers from client requests.',
    },
    { t: 'h', text: 'Other policy examples (untested)' },
    {
      t: 'p',
      text: 'The snippets below follow the Envoy Gateway documentation but are **untested** in this repo. Adjust the fields to the version in your cluster.',
    },
    {
      t: 'code',
      title: 'SecurityPolicy basic auth and JWT (example)',
      code: 'apiVersion: gateway.envoyproxy.io/v1alpha1\nkind: SecurityPolicy\nmetadata:\n  name: playground-secure-example\n  namespace: playground\nspec:\n  targetRefs:\n    - group: gateway.networking.k8s.io\n      kind: HTTPRoute\n      name: playground-whoami\n  basicAuth:\n    users:\n      name: basic-auth-users        # Secret containing the .htpasswd file\n    forwardUsernameHeader: x-user\n  # or JWT:\n  # jwt:\n  #   providers:\n  #     - name: demo\n  #       remoteJWKS:\n  #         uri: https://issuer.example.com/.well-known/jwks.json\n  #       claimToHeaders:\n  #         - claim: sub\n  #           header: x-jwt-sub     # then set IDENTITY_HEADERS=x-jwt-sub',
    },
    {
      t: 'code',
      title: 'BackendTrafficPolicy fault injection (example)',
      code: 'apiVersion: gateway.envoyproxy.io/v1alpha1\nkind: BackendTrafficPolicy\nmetadata:\n  name: playground-fault-example\n  namespace: playground\nspec:\n  targetRefs:\n    - group: gateway.networking.k8s.io\n      kind: HTTPRoute\n      name: playground-flaky\n  faultInjection:\n    delay:\n      fixedDelay: 2s\n      percentage: 20\n    abort:\n      httpStatus: 503\n      percentage: 10',
    },
    {
      t: 'code',
      title: 'NetworkPolicy: only the proxy may reach the pods (example)',
      code: 'apiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata:\n  name: allow-envoy-only\n  namespace: playground\nspec:\n  podSelector:\n    matchLabels: {app: playground}\n  policyTypes: [Ingress]\n  ingress:\n    - from:\n        - namespaceSelector:\n            matchLabels:\n              kubernetes.io/metadata.name: envoy-gateway-system\n      ports:\n        - port: 3000',
    },
  ],
};
