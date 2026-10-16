// Header yang lazim ditambahkan oleh gateway/proxy (Envoy Gateway, Kong, dll). Allowlist, bukan echo semua.
const GATEWAY_HEADERS = [
  'host',
  'via',
  'forwarded',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-forwarded-port',
  'x-forwarded-prefix',
  'x-forwarded-path',
  'x-real-ip',
  'x-request-id',
  'x-correlation-id',
  'x-kong-request-id',
  'x-envoy-external-address',
  'x-envoy-original-path',
  'x-envoy-attempt-count',
  'x-envoy-expected-rq-timeout-ms',
  'x-envoy-decorator-operation',
  'x-consumer-id',
  'x-consumer-username',
  'x-consumer-custom-id',
  'x-credential-identifier',
  'x-anonymous-consumer',
  'x-client-id',
  'x-user',
  'x-gateway',
  'traceparent',
  'tracestate',
  'b3',
] as const;

export function gatewayHeaders(h: { get(name: string): string | null }): Record<string, string | null> {
  return Object.fromEntries(GATEWAY_HEADERS.map((name) => [name, h.get(name)]));
}
