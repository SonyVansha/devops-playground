import type { Doc } from '../types.ts';

export const doc: Doc = {
  slug: 'observability',
  title: 'Metrics & logs',
  summary: 'Prometheus metrics, example PromQL queries, and structured JSON logs for alerting and log pipelines.',
  blocks: [
    { t: 'h', text: 'Metrics (Prometheus)' },
    {
      t: 'p',
      text: '`/api/metrics` uses the Prometheus text format. Route names in labels are always fixed strings from the code (not user input), so cardinality is bounded.',
    },
    {
      t: 'table',
      head: ['Metric', 'Type', 'Meaning'],
      rows: [
        ['`app_uptime_seconds`', 'gauge', 'process age'],
        ['`app_ready`, `app_healthy`, `app_draining`', 'gauge', 'status 1/0'],
        ['`app_dependency_up`', 'gauge', '1/0; only present when `DEPENDENCY_URL` is configured'],
        ['`app_memory_rss_bytes`', 'gauge', 'process RSS (rises in the leak scenario)'],
        ['`app_http_requests_total{route,status}`', 'counter', 'requests per route and status'],
        ['`app_http_request_duration_ms_sum` / `_count`', 'counter', 'total duration and count per route'],
      ],
    },
    {
      t: 'check',
      title: 'Metrics are produced',
      command: 'curl -s {{BASE}}/api/hello > /dev/null\ncurl -s {{BASE}}/api/metrics | grep -E \'app_http_requests_total\\{route="hello"|app_memory_rss\'',
      expect: 'the line `app_http_requests_total{route="hello",status="200"} N` with N increasing each time you call `/api/hello`, plus `app_memory_rss_bytes`.',
    },
    {
      t: 'code',
      title: 'PromQL examples (after Prometheus scrapes the pod)',
      code: '# error rate of /api/hello (5 minutes)\nsum(rate(app_http_requests_total{route="hello",status=~"5.."}[5m]))\n  / sum(rate(app_http_requests_total{route="hello"}[5m]))\n\n# average latency of /api/hello (ms)\nrate(app_http_request_duration_ms_sum{route="hello"}[5m])\n  / rate(app_http_request_duration_ms_count{route="hello"}[5m])\n\n# pods that are not ready or are draining\napp_ready == 0 or app_draining == 1',
    },
    {
      t: 'note',
      kind: 'warn',
      text: 'This repo does **not** include a `ServiceMonitor` or `PrometheusRule` yet. Add them yourself to match your Prometheus setup: scrape `/api/metrics` on the `http` port. These metrics are the basis for alerts on the error rate, crash, and OOM scenarios.',
    },
    { t: 'h', text: 'JSON logs' },
    {
      t: 'p',
      text: 'Every request (except probes and metrics, so logs do not flood) writes one JSON line to stdout. Logs only contain the fixed route name, method, status, and duration, **with no user input**, so they are safe from log injection.',
    },
    {
      t: 'check',
      title: 'Log format',
      command: 'curl -s {{BASE}}/api/hello > /dev/null\nkubectl -n playground logs -l app=playground --tail=3',
      expect: 'a line like `{"ts":"2026-...","level":"info","route":"hello","method":"GET","status":200,"ms":0}`. Lifecycle events (`signal received, draining`, `BOOT_FAIL=true, exiting`) are recorded with `level` `info`/`warn`.',
    },
    {
      t: 'check',
      title: 'Follow the logs during a scenario',
      command: 'kubectl -n playground logs -f deploy/playground | grep -E \'"status":5|draining|exiting\'',
      expect: '`status:500` lines appear while `ERROR_RATE` is active; `draining` when the pod is stopped; `exiting` on `BOOT_FAIL`/`CRASH_AFTER_SECONDS`.',
    },
  ],
};
