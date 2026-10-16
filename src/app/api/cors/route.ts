import { wrap } from '../../../lib/handler.ts';
import { json, selfName } from '../../../lib/util.ts';

export const dynamic = 'force-dynamic';

// Default: app TIDAK menambah header CORS -> gateway (plugin cors) yang harus menambahkannya.
// ?mode=app: app menambahkan sendiri (untuk membandingkan perilaku).
function corsHeaders(request: Request): Record<string, string> {
  if (new URL(request.url).searchParams.get('mode') !== 'app') return {};
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, apikey',
  };
}

export const OPTIONS = wrap('cors', (request) => new Response(null, { status: 204, headers: corsHeaders(request) }));

export const GET = wrap('cors', (request) =>
  json(
    {
      pod: selfName(),
      origin: request.headers.get('origin'),
      appAddsCors: Object.keys(corsHeaders(request)).length > 0,
    },
    200,
    corsHeaders(request),
  ),
);
