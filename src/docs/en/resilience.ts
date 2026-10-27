import type { Doc } from '../types.ts';

export const doc: Doc = {
  slug: 'resilience',
  title: 'Resilience & proxy limits',
  summary: 'Status codes, delay, random failures, SSE streaming, large payloads, redirects, CORS, and cookies.',
  blocks: [
    { t: 'h', text: 'Status codes and delay' },
    {
      t: 'check',
      title: 'Any status code (200–599)',
      command: 'for c in 200 404 429 500 503 504; do echo "$c -> $(curl -s -o /dev/null -w \'%{http_code}\' {{BASE}}/api/status/$c)"; done',
      expect: 'each code is returned exactly as requested. A code outside 200–599, or a non-number, gets `400`. Useful for testing retries, error pages, alerts, and outlier detection.',
    },
    {
      t: 'check',
      title: 'Controlled delay',
      command: 'curl -s -o /dev/null -w "%{time_total}s\\n" "{{BASE}}/api/delay?ms=2000"',
      expect: '≈ `2.0s`. Maximum 30000 ms. To test a timeout, set the delay slightly above the gateway/ingress timeout and confirm the response is 504/timeout. Behind Envoy/Envoy Gateway, the default route timeout is 15 seconds: `ms=16000` gets `504` at second 15 even though the app is healthy (see the Envoy Gateway API gateway page to change it).',
    },
    { t: 'h', text: 'Random failures (retry, circuit breaker)' },
    {
      t: 'check',
      title: 'Flaky 30%',
      command: 'for i in $(seq 1 50); do curl -s -o /dev/null -w "%{http_code}\\n" "{{BASE}}/api/flaky?rate=30&status=503"; done | sort | uniq -c',
      expect: 'a mix of `200` and `503`, with 503 around 30% (random). `rate=0` is always 200, `rate=100` always fails with the requested status (400–599).',
    },
    { t: 'h', text: 'Streaming (SSE)' },
    {
      t: 'check',
      title: 'Events arrive one by one',
      command: 'curl -N "{{BASE}}/api/sse?events=5&interval=1000"',
      expect: 'five `id: 1..5` events appear **one per second** (not all at once at the end), closed by `event: done`. If they all appear together, a proxy is buffering the response (turn off buffering or check `X-Accel-Buffering`). A stream longer than the proxy route timeout is cut off without `event: done` (Envoy: 15 seconds by default; try `events=20&interval=1000`).',
    },
    { t: 'h', text: 'Large payloads' },
    {
      t: 'check',
      title: 'Large response and upload',
      command: 'curl -s "{{BASE}}/api/payload?kb=1024" | wc -c\nhead -c 3000000 /dev/zero | curl -s -X POST --data-binary @- {{BASE}}/api/payload',
      expect: 'the first line is `1048576`. A 3 MB upload returns `{"receivedBytes":3000000}`. If the gateway/ingress has a body size limit (e.g. `client_max_body_size`), a request larger than that limit gets `413` from the proxy, not from the app (the app own limit is 20 MB).',
    },
    { t: 'h', text: 'Redirects' },
    {
      t: 'check',
      title: 'Relative redirect chain',
      command: 'curl -si "{{BASE}}/api/redirect?n=3&code=302" | grep -iE "^(HTTP|location)"\ncurl -sL -o /dev/null -w "final: %{http_code}, redirect: %{num_redirects}\\n" "{{BASE}}/api/redirect?n=3"\ncurl -sL --max-redirs 5 -o /dev/null -w "loop: %{http_code}\\n" "{{BASE}}/api/redirect?loop=1"',
      expect: '`HTTP/1.1 302` with `location: redirect?n=2&code=302` (relative, no internal host). Following redirects: `final: 200, redirect: 3`. Loop: curl stops with the error "Maximum redirects followed".',
    },
    { t: 'h', text: 'CORS' },
    {
      t: 'check',
      title: 'The app does not add CORS (the gateway must)',
      command: 'curl -si -X OPTIONS -H "Origin: https://example.com" -H "Access-Control-Request-Method: GET" {{BASE}}/api/cors | grep -iE "^HTTP|access-control"\ncurl -si -X OPTIONS -H "Origin: https://example.com" "{{BASE}}/api/cors?mode=app" | grep -i access-control',
      expect: 'without `mode=app`: `HTTP 204` and **no** `access-control-*` headers (if they appear, the gateway added them). With `mode=app`: `access-control-allow-origin: *`.',
    },
    { t: 'h', text: 'Cookies and sticky sessions' },
    {
      t: 'check',
      title: 'Cookie jar',
      command: 'curl -s -c jar.txt "{{BASE}}/api/cookie?name=sid&value=abc123"\ncurl -s -b jar.txt {{BASE}}/api/cookie\ncurl -si "{{BASE}}/api/cookie?name=sid&value=x" -H "x-forwarded-proto: https" | grep -i set-cookie',
      expect: 'the second request shows `"cookieNames":["sid"]` along with the `pod` name. For sticky sessions, repeat it with `-b jar.txt` and confirm the `pod` is always the same. `Set-Cookie` contains `HttpOnly; SameSite=Lax`, plus `Secure` when `x-forwarded-proto: https`. Cookie names and values are limited to `[A-Za-z0-9_-]{1,32}`.',
    },
  ],
};
