import { gatewayHeaders } from '../../../lib/gateway.ts';
import { wrap } from '../../../lib/handler.ts';
import { json, selfName } from '../../../lib/util.ts';

export const dynamic = 'force-dynamic';

// Menampilkan apa yang ditambahkan API gateway (consumer, forwarded prefix, trace, dll) + pod yang melayani.
export const GET = wrap('gateway', (request) =>
  json({
    receivedPath: new URL(request.url).pathname,
    pod: selfName(),
    gateway: gatewayHeaders(request.headers),
  }),
);
