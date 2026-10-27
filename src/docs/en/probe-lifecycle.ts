import type { Doc } from '../types.ts';

export const doc: Doc = {
  slug: 'probe-lifecycle',
  title: 'Probes & lifecycle',
  summary: 'Liveness, readiness, startup, graceful shutdown, and readiness that depends on a dependency.',
  blocks: [
    { t: 'h', text: 'The three probes' },
    {
      t: 'table',
      head: ['Endpoint', '200 when', '503 when', 'Used for'],
      rows: [
        ['`/api/healthz` (`/api/livez`)', 'the process is healthy', 'the chaos `unhealthy` toggle', 'livenessProbe (kubelet restarts the container)'],
        [
          '`/api/readyz`',
          'ready, healthy, not draining, dependency healthy',
          'the `notready` or `unhealthy` toggle, **draining**, or `DEPENDENCY_URL` fails',
          'readinessProbe (the pod leaves Endpoints, **not** restarted)',
        ],
        ['`/api/startupz`', 'startup is done', 'during `STARTUP_DELAY_SECONDS`', 'startupProbe (holds off liveness during a slow start)'],
      ],
    },
    {
      t: 'note',
      kind: 'info',
      text: 'In `k8s/app.yaml`: startup every 2 s × 30 times (max 60 s), liveness every 10 s, readiness every 5 s. Liveness **deliberately does not** depend on the dependency: a dead dependency must not restart the pod.',
    },
    {
      t: 'check',
      title: 'All three probes healthy',
      command: 'for p in healthz readyz startupz; do echo "$p $(curl -s -o /dev/null -w \'%{http_code}\' {{BASE}}/api/$p)"; done',
      expect: 'three lines, each ending in `200`.',
    },
    { t: 'h', text: 'Slow start' },
    {
      t: 'code',
      code: 'kubectl -n playground set env deploy/playground STARTUP_DELAY_SECONDS=40\nkubectl -n playground get pods -w',
    },
    {
      t: 'p',
      text: 'The new pod shows `Running` but `0/1` (not Ready) until 40 seconds pass, and is **not** restarted because the startupProbe holds off liveness. Meanwhile the old pod keeps serving traffic.',
    },
    {
      t: 'check',
      title: 'Startup holds off readiness',
      command: 'kubectl -n playground get pods\ncurl -s -o /dev/null -w "%{http_code}\\n" {{BASE}}/api/startupz',
      expect: 'during the delay: new pod `0/1`, `RESTARTS` stays `0`. After the delay: `1/1` and `/api/startupz` answers `200`.',
    },
    { t: 'h', text: 'Graceful shutdown (drain)' },
    {
      t: 'p',
      text: 'Sequence when a pod is stopped: `preStop` (sleep 5 s) → SIGTERM → the app marks `ready=false` and `draining=true` → keeps serving requests for `DRAIN_SECONDS` (default 10) → exit 0. `terminationGracePeriodSeconds: 30` is larger than 5 + 10, so it does not get SIGKILL. It needs `NEXT_MANUAL_SIG_HANDLE=true` (already in the Dockerfile and manifest).',
    },
    {
      t: 'check',
      title: 'Drain in Docker (exit code 0)',
      command: 'docker run -d --name dp -p 3000:3000 devops-playground:1.0.0\nsleep 5\ndocker stop -t 20 dp\ndocker inspect -f "exit={{.State.ExitCode}}" dp\ndocker rm dp',
      expect: '`exit=0`. If `exit=137`, the process was SIGKILLed (check `NEXT_MANUAL_SIG_HANDLE` and that `DRAIN_SECONDS` is smaller than the grace period).',
    },
    {
      t: 'check',
      title: 'Drain in Kubernetes without errors',
      command: 'kubectl -n playground rollout restart deploy/playground\n# in another terminal, while the rollout runs:\nk6 run -e BASE_URL={{BASE}} -e DURATION=1m loadtest/hello.js',
      expect: 'the k6 threshold `http_req_failed` passes (less than 1% failed): a rolling update with no downtime.',
    },
    {
      t: 'check',
      title: 'Drain log',
      command: 'kubectl -n playground logs <pod-name> | grep draining',
      expect: 'a JSON line `{"level":"info","msg":"signal received, draining","drainSeconds":10,...}`.',
    },
    { t: 'h', text: 'Readiness depends on a dependency' },
    {
      t: 'code',
      code: 'kubectl -n playground set env deploy/playground \\\n  DEPENDENCY_URL=http://tier-b.playground.svc.cluster.local/api/readyz',
    },
    {
      t: 'p',
      text: 'Each readiness check calls `DEPENDENCY_URL` (1.5 s timeout, result cached for 2 s). If it fails, `/api/readyz` replies 503 with a `dependency` field. The URL is only read from env, never from the request.',
    },
    {
      t: 'check',
      title: 'Dependency down → readiness drops, liveness stays',
      command: 'kubectl -n playground scale deploy/tier-b --replicas=0\nsleep 5\ncurl -s -o /dev/null -w "readyz=%{http_code}\\n" {{BASE}}/api/readyz\ncurl -s -o /dev/null -w "healthz=%{http_code}\\n" {{BASE}}/api/healthz',
      expect: '`readyz=503` and `healthz=200`; `kubectl get pods` shows `RESTARTS` does not increase. After tier-b is back, readyz returns to `200`.',
    },
  ],
};
