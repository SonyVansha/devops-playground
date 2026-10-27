import type { Doc } from '../types.ts';

export const doc: Doc = {
  slug: 'jaringan-config',
  title: 'Network & config',
  summary: 'Test DNS and egress from inside the pod, received headers, routing paths, and verify that a ConfigMap/Secret is mounted.',
  blocks: [
    { t: 'h', text: 'Test DNS, TCP, and HTTP from inside the pod' },
    {
      t: 'p',
      text: '`/api/connect` checks connectivity **from the pod** to a given host. To prevent SSRF, only hosts listed in the `CONNECT_ALLOWLIST` env (comma-separated) can be reached. An empty list means everything is rejected (403). The manifest sets it to `kubernetes.default.svc,playground.playground.svc.cluster.local`.',
    },
    {
      t: 'table',
      head: ['type', 'target', 'Result'],
      rows: [
        ['`dns`', 'hostname', '`{"reachable":true,"addresses":[...]}`'],
        ['`tcp`', '`host:port`', '`reachable` + latency, 3 s timeout'],
        ['`http`', 'URL `http(s)://...`', '`reachable` + status code (redirects are not followed)'],
      ],
    },
    {
      t: 'check',
      title: 'DNS, TCP, and host rejection',
      command: 'curl -s "{{BASE}}/api/connect?type=dns&target=kubernetes.default.svc"\ncurl -s "{{BASE}}/api/connect?type=tcp&target=kubernetes.default.svc:443"\ncurl -s -o /dev/null -w "other host: %{http_code}\\n" "{{BASE}}/api/connect?type=dns&target=example.com"',
      expect: 'DNS and TCP: `"reachable":true`. Host outside the allowlist: `403` (`host not in allowlist`). If DNS fails, `"reachable":false` with a code such as `ENOTFOUND`.',
    },
    {
      t: 'check',
      title: 'NetworkPolicy blocks egress',
      command: 'kubectl -n playground apply -f - <<EOF\napiVersion: networking.k8s.io/v1\nkind: NetworkPolicy\nmetadata: {name: deny-egress, namespace: playground}\nspec:\n  podSelector: {matchLabels: {app: playground}}\n  policyTypes: [Egress]\nEOF\ncurl -s "{{BASE}}/api/connect?type=tcp&target=kubernetes.default.svc:443"',
      expect: 'once the deny-egress policy is active (needs a CNI that supports NetworkPolicy): `"reachable":false` with `"error":"TIMEOUT"`. Delete the policy to restore access: `kubectl -n playground delete networkpolicy deny-egress`.',
    },
    { t: 'h', text: 'Headers and paths received by the app' },
    {
      t: 'check',
      title: 'Ingress/gateway forwards headers correctly',
      command: 'curl -s -H "X-Forwarded-For: 1.2.3.4" {{BASE}}/api/headers\ncurl -s {{BASE}}/api/gateway',
      expect: '`/api/headers` shows all headers (credentials are `[REDACTED]`) along with the `path`. `/api/gateway` summarizes the gateway headers: `x-forwarded-*`, `x-consumer-*`, `x-correlation-id`, `traceparent`, and the `pod` that served the request.',
    },
    {
      t: 'check',
      title: 'Rewrite / prefix',
      command: 'curl -s -o /dev/null -w "%{http_code}\\n" {{BASE}}/path/a/b/c\ncurl -s {{BASE}}/path/a/b/c | grep -o "<code>/[^<]*</code>"',
      expect: '`200` and the page shows the exact path that reached the app. If the ingress uses rewrite/strip-path, the path on the page differs from the path you called. That difference is what you are checking.',
    },
    {
      t: 'note',
      kind: 'info',
      text: 'The Next.js `basePath` is **build-time**. To test an ingress with a sub-path, build the image with `--build-arg BASE_PATH=/playground`. One image cannot serve two different prefixes.',
    },
    { t: 'h', text: 'Verify a mounted ConfigMap and Secret' },
    {
      t: 'p',
      text: '`/api/config` shows the **file name, size, and checksum** (first 12 characters of the SHA-256) from the `CONFIG_DIR` directory (default `/etc/playground`), and never shows the contents. The manifest mounts the `playground-config` ConfigMap there.',
    },
    {
      t: 'check',
      title: 'New config reaches the pod without a restart',
      command: 'curl -s {{BASE}}/api/config\nkubectl -n playground patch configmap playground-config --type merge -p \'{"data":{"message":"hello v2"}}\'\nsleep 90\ncurl -s {{BASE}}/api/config',
      expect: 'the checksum of the `message` file **changes** after the kubelet syncs (about 1 minute) and `RESTARTS` stays 0. If `"mounted":false`, the volume is not mounted yet (check the ConfigMap name and `CONFIG_DIR`). Note: mounts using `subPath` are not updated.',
    },
  ],
};
