// Header yang lazim ditambahkan oleh Kong / reverse proxy lain (allowlist, bukan echo semua).
const GATEWAY_HEADERS = [
  'host',
  'via',
  'x-forwarded-for',
  'x-forwarded-host',
  'x-forwarded-proto',
  'x-forwarded-prefix',
  'x-forwarded-path',
  'x-real-ip',
  'x-request-id',
  'x-correlation-id',
  'x-kong-request-id',
  'x-consumer-id',
  'x-consumer-username',
  'x-consumer-custom-id',
  'x-credential-identifier',
  'x-anonymous-consumer',
  'x-gateway',
  'traceparent',
  'tracestate',
  'b3',
] as const;

export function gatewayHeaders(h: { get(name: string): string | null }): Record<string, string | null> {
  return Object.fromEntries(GATEWAY_HEADERS.map((name) => [name, h.get(name)]));
}
