import type { Doc } from '../types.ts';

export const doc: Doc = {
  slug: 'skenario-deploy',
  title: 'Deploy scenarios (env)',
  summary: 'One image, many roles: boot failure, slow start, crash, error rate, latency, and memory leak through env vars.',
  blocks: [
    {
      t: 'p',
      text: 'The workload behavior is controlled through env vars on the Deployment, so one image can play both a healthy and a broken version. All numbers are clamped to safe limits. After you change an env var, the Deployment does a rolling update automatically.',
    },
    {
      t: 'table',
      head: ['Env', 'Effect', 'Range'],
      rows: [
        ['`BOOT_FAIL=true`', 'the process exits 1 on start, giving CrashLoopBackOff', '-'],
        ['`STARTUP_DELAY_SECONDS=N`', 'startup and readiness return 503 for N seconds', '0–600'],
        ['`CRASH_AFTER_SECONDS=N`', 'the process exits 1 after N seconds', '0–86400'],
        ['`ERROR_RATE=N`', 'N% of `/api/hello` requests reply 500', '0–100'],
        ['`LATENCY_MS=N`', '`/api/hello` waits N ms', '0–30000'],
        ['`LEAK_MB_PER_MINUTE=N`', 'memory grows by N MB every minute', '0–256'],
        ['`APP_VERSION=vX`', 'version label in `/api/hello`, `/api/info`', 'free text'],
      ],
    },
    {
      t: 'check',
      title: 'See the active behavior',
      command: 'curl -s {{BASE}}/api/info | grep -o \'"behavior":{[^}]*}\'',
      expect: 'all `0`/`false` means the workload is healthy. The dashboard (Overview tab) shows the same thing.',
    },
    { t: 'h', text: 'Scenario 1: failed rollout then rollback' },
    {
      t: 'code',
      code: 'kubectl -n playground set env deploy/playground BOOT_FAIL=true\nkubectl -n playground rollout status deploy/playground --timeout=60s   # fails / times out\nkubectl -n playground get pods                                          # new pod is CrashLoopBackOff\nkubectl -n playground rollout undo deploy/playground                    # rollback',
    },
    {
      t: 'check',
      title: 'Rollout stalls, traffic is safe, rollback recovers',
      command: 'curl -s -o /dev/null -w "%{http_code}\\n" {{BASE}}/api/hello     # stays 200 while the rollout fails\nkubectl -n playground rollout history deploy/playground',
      expect: 'while the new pod crashes, requests still return `200` because the old pods have not been replaced (rolling update). After `undo`, all pods are `1/1 Running`.',
    },
    {
      t: 'note',
      kind: 'warn',
      text: '`rollout undo` restores the old template. If you used `set env`, the new env var may remain in the spec; remove it with `kubectl set env deploy/playground BOOT_FAIL-` (note the minus sign at the end).',
    },
    { t: 'h', text: 'Scenario 2: periodic crash' },
    {
      t: 'code',
      code: 'kubectl -n playground set env deploy/playground CRASH_AFTER_SECONDS=90\nkubectl -n playground get pods -w',
    },
    {
      t: 'check',
      title: 'Restart and backoff',
      command: 'kubectl -n playground get pods\nkubectl -n playground describe pod <pod-name> | grep -E "Restart Count|Last State|Reason|Exit Code"',
      expect: '`RESTARTS` goes up every ±90 sec, `Exit Code: 1`, and the final status is `CrashLoopBackOff` with ever longer delays.',
    },
    { t: 'h', text: 'Scenario 3: error rate and latency' },
    {
      t: 'code',
      code: 'kubectl -n playground set env deploy/playground ERROR_RATE=30\n# or\nkubectl -n playground set env deploy/playground LATENCY_MS=800',
    },
    {
      t: 'check',
      title: 'Measure the error rate from outside',
      command: 'ok=0; for i in $(seq 1 100); do c=$(curl -s -o /dev/null -w "%{http_code}" {{BASE}}/api/hello); [ "$c" = 200 ] && ok=$((ok+1)); done; echo "success=$ok/100"',
      expect: 'with `ERROR_RATE=30`, success is roughly 70/100 (random, not exact). With `LATENCY_MS=800`, each request takes ≥ 0.8 sec (`curl -w "%{time_total}"`).',
    },
    { t: 'h', text: 'Scenario 4: memory leak until OOMKilled' },
    {
      t: 'code',
      code: 'kubectl -n playground set env deploy/playground LEAK_MB_PER_MINUTE=40\nkubectl -n playground top pod -l app=playground   # needs metrics-server',
    },
    {
      t: 'check',
      title: 'OOMKilled',
      command: 'kubectl -n playground describe pod <pod-name> | grep -A4 "Last State"',
      expect: '`Reason: OOMKilled`, `Exit Code: 137` after memory passes the 256Mi limit (±5 minutes at 40 MB/minute). The `app_memory_rss_bytes` metric keeps rising before that.',
    },
    {
      t: 'note',
      kind: 'ok',
      text: 'Done experimenting? Clear all behavior env vars at once: `kubectl -n playground set env deploy/playground BOOT_FAIL- STARTUP_DELAY_SECONDS- CRASH_AFTER_SECONDS- ERROR_RATE- LATENCY_MS- LEAK_MB_PER_MINUTE-`.',
    },
  ],
};
