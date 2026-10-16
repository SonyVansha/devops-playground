import {
  MAX_DEPTH,
  callDownstream,
  nextTrace,
  outgoingHeaders,
  requestIdOf,
  upstreamBase,
} from '../../../lib/chain.ts';
import { wrap } from '../../../lib/handler.ts';
import { clampInt, json, podInfo, selfName } from '../../../lib/util.ts';

export const dynamic = 'force-dynamic';

// /api/chain?depth=3 -> app memanggil app berikutnya (UPSTREAM_URL) sebanyak `depth` hop.
// Untuk tes service-to-service, service mesh, propagasi trace (traceparent/b3/x-request-id),
// dan kegagalan berantai: bila hop di bawah gagal, hop ini membalas 502 dengan detailnya.
export const GET = wrap('chain', async (request) => {
  const depth = clampInt(new URL(request.url).searchParams.get('depth'), 0, MAX_DEPTH, 1);
  const trace = nextTrace(request.headers.get('traceparent'));
  const requestId = requestIdOf(request.headers);
  const self = {
    pod: selfName(),
    version: podInfo().appVersion,
    depth,
    traceId: trace.traceId,
    spanId: trace.spanId,
    parentSpanId: trace.parentSpanId,
    requestId,
  };

  const base = upstreamBase();
  if (depth === 0 || base === null) {
    return json({ ...self, leaf: true, upstream: base === null ? 'not configured' : 'reached depth 0' });
  }

  const result = await callDownstream(base, depth, outgoingHeaders(request.headers, trace, requestId));
  if (!result.ok) return json({ ...self, error: 'downstream failed', downstream: result.detail }, 502);
  return json({ ...self, downstream: result.body });
});
