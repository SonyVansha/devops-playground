import { wrap } from '../../../lib/handler.ts';
import { state, uptimeSeconds } from '../../../lib/state.ts';

export const dynamic = 'force-dynamic';

function routeMetrics(): string[] {
  const lines = ['# TYPE app_http_requests_total counter'];
  const sums = ['# TYPE app_http_request_duration_ms_sum counter', '# TYPE app_http_request_duration_ms_count counter'];
  for (const [route, stat] of Object.entries(state.routes)) {
    for (const [status, n] of Object.entries(stat.byStatus)) {
      lines.push(`app_http_requests_total{route="${route}",status="${status}"} ${n}`);
    }
    sums.push(`app_http_request_duration_ms_sum{route="${route}"} ${Math.round(stat.durationMs)}`);
    sums.push(`app_http_request_duration_ms_count{route="${route}"} ${stat.count}`);
  }
  return [...lines, ...sums];
}

// Format Prometheus text exposition.
export const GET = wrap('metrics', () => {
  const lines = [
    '# TYPE app_uptime_seconds gauge',
    `app_uptime_seconds ${uptimeSeconds()}`,
    '# TYPE app_ready gauge',
    `app_ready ${state.ready ? 1 : 0}`,
    '# TYPE app_healthy gauge',
    `app_healthy ${state.healthy ? 1 : 0}`,
    '# TYPE app_draining gauge',
    `app_draining ${state.draining ? 1 : 0}`,
    ...(state.dependencyOk === null ? [] : ['# TYPE app_dependency_up gauge', `app_dependency_up ${state.dependencyOk ? 1 : 0}`]),
    '# TYPE app_memory_rss_bytes gauge',
    `app_memory_rss_bytes ${process.memoryUsage.rss()}`,
    ...routeMetrics(),
    '',
  ];
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/plain; version=0.0.4', 'Cache-Control': 'no-store' },
  });
});
