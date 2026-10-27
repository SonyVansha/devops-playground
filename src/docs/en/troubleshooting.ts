import type { Doc } from '../types.ts';

export const doc: Doc = {
  slug: 'troubleshooting',
  title: 'Troubleshooting',
  summary: 'Common symptoms, their causes, and how to fix them.',
  blocks: [
    {
      t: 'table',
      head: ['Symptom', 'Likely cause', 'Fix'],
      rows: [
        [
          'Namespace, Node, or pod IP is empty ("not available") in the dashboard',
          'the platform does not inject the downward API env vars (`POD_NAMESPACE`, `NODE_NAME`, `POD_IP`); the app uses the platform\'s own manifest, not `k8s/app.yaml`',
          'the pod name and IP are now detected automatically; the namespace comes from the service account file if it is mounted. For the node name, add the env `NODE_NAME` from `spec.nodeName` (downward API) if the platform allows it',
        ],
        [
          'Slow requests get `504` at exactly ±15 seconds even though the app is healthy',
          'the default Envoy route timeout (15 seconds); this is a proxy timeout, not an app bug',
          'raise `timeouts.request` on the HTTPRoute rule (Envoy Gateway API gateway page); verify with `curl {{BASE}}/api/delay?ms=16000`',
        ],
        [
          'Stream (SSE) is cut at ±15 seconds without a `done` event',
          'the Envoy route timeout applies to the whole response, including streaming',
          '`timeouts.request: 0s` on the route that serves the stream',
        ],
        [
          '`/api/secure/whoami` does not recognize the identity from the gateway',
          'the identity header name from the gateway differs from the one the app watches',
          'check `watchedHeaders` in the response; set the env `IDENTITY_HEADERS` to match `forwardClientIDHeader`/`forwardUsernameHeader`/`claimToHeaders`',
        ],
        [
          'Envoy Gateway rate limit: 429 appears later than the configured limit',
          '`Local` rate limit is counted per Envoy replica, so the effective limit = limit × number of replicas',
          'lower the per-replica limit or use `rateLimit.type: Global` (needs Redis)',
        ],
        ['All pods call themselves `0.0.0.0`', 'an old version used the env `HOSTNAME` (the bind address) as the pod name', 'use the latest version: the pod name is taken from the OS hostname. Check `curl {{BASE}}/api/info` and look at `podName` and `identitySource`'],
        ['Pod is in `CrashLoopBackOff` from the start', '`BOOT_FAIL=true` or `CRASH_AFTER_SECONDS` was left in the env', '`kubectl -n playground get deploy playground -o yaml | grep -A1 -E "BOOT_FAIL|CRASH_AFTER"`; remove with `set env ... BOOT_FAIL-`'],
        ['`Cannot find module ...` when the container starts', 'a Next file was dropped from the standalone output (e.g. `@swc/helpers` was excluded)', 'do not exclude `@swc/helpers`; rebuild and check `docker logs`'],
        ['Container is unreachable from outside / probes fail on K8s', '`HOSTNAME` from Kubernetes (the pod name) is used by Next as the bind address', 'set the env `HOSTNAME=0.0.0.0` (already in the manifest)'],
        ['`readyz` returns 503 even though the app is healthy', '`draining`, the `notready` toggle, or `DEPENDENCY_URL` is failing', '`curl {{BASE}}/api/readyz` and look at the fields `dependency` and `draining`'],
        ['Pod stays `0/1` for a long time at start', '`STARTUP_DELAY_SECONDS` is active or the startupProbe has not passed yet', 'check `curl {{BASE}}/api/startupz` and the behavior env in the Overview tab'],
        ['Chaos always returns `403`', '`ENABLE_CHAOS` is not `true` or `CHAOS_TOKEN` is empty', '`curl {{BASE}}/api/chaos` and look at `enabled` and `tokenConfigured`'],
        ['Chaos returns `401`', 'the `X-Chaos-Token` header is wrong or empty', 'fetch the token again from the Secret `playground-chaos`'],
        ['Chaos returns `409`', '`?pod=` points to another pod', 'repeat the request or `port-forward` directly to the pod'],
        ['`/api/connect` always returns `403`', '`CONNECT_ALLOWLIST` is empty or the host is not listed', 'add the host to the env (comma separated)'],
        ['`/api/secure/jwt` always returns `verified:null`', '`JWT_SECRET` is not set in the pod', 'create the Secret `playground-auth` then `rollout restart`'],
        ['`/api/secure/basic` returns `503`', '`BASIC_USER`/`BASIC_PASSWORD` are not set', 'fill in the Secret `playground-auth`'],
        ['`/api/config` shows `"mounted":false`', 'the ConfigMap does not exist or `CONFIG_DIR` is wrong', '`kubectl -n playground get cm playground-config`'],
        ['`/api/chain` returns `502` even though the lower tier is healthy', '`UPSTREAM_URL` is wrong / the Service has no Endpoints / timeout < latency', 'check the `downstream.error` field: `ECONNREFUSED`, `ENOTFOUND`, or `TIMEOUT` (raise `CHAIN_TIMEOUT_MS`)'],
        ['Kong rate limit is not visible (no 429)', 'the request does not carry `Host: gateway.local` or goes through another route', 'add the Host header; check `kubectl get ingress -n playground`'],
        ['Rate limit quota "does not reset"', 'the limit is 5 per **minute** and the previous test still counts', 'wait 60 seconds before running `test.sh` again'],
        ['Argo rollout does not run after `set env`', 'the change was made on the Rollout, not the Deployment (`workloadRef`)', 'change the Deployment `playground`; the Rollout reads its template'],
        ['`docker run` fails: `invalid mount path: C`', 'Git Bash converts `/tmp` into a Windows path', '`export MSYS_NO_PATHCONV=1`'],
        ['`curl -w "%{size_download}"` returns 0 on Windows', '`-o /dev/null` is not valid for Windows curl', 'use `-o NUL`'],
        ['Gateway cache hit does not happen', 'the response is `no-store`/`private`, or `Vary` makes a different key per client', 'check `Cache-Control` and `Vary` on `/api/cache`; keep the request headers the same between calls'],
      ],
    },
    {
      t: 'check',
      title: 'Quick diagnosis on Kubernetes',
      command: 'kubectl -n playground get pods -o wide\nkubectl -n playground describe pod <pod-name> | sed -n \'/Events:/,$p\'\nkubectl -n playground logs <pod-name> --previous\nkubectl -n playground get endpoints playground',
      expect: 'Events explain the reason (probe failed, OOMKilled, ImagePullBackOff). `--previous` shows the container log from before the restart. Empty `endpoints` means there is no Ready pod behind the Service.',
    },
    {
      t: 'note',
      kind: 'info',
      text: 'Still stuck? Open the **Overview** tab in the dashboard: pod identity, probe status, dependency, and active behavior all show in one place, and that most often answers "why is this pod acting like this".',
    },
  ],
};
