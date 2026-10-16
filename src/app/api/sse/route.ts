import { wrap } from '../../../lib/handler.ts';
import { clampInt, selfName } from '../../../lib/util.ts';

export const dynamic = 'force-dynamic';

const MAX_EVENTS = 120;
const encoder = new TextEncoder();

// /api/sse?events=10&interval=1000 -> Server-Sent Events (tes buffering & idle timeout gateway).
export const GET = wrap('sse', (request) => {
  const params = new URL(request.url).searchParams;
  const total = clampInt(params.get('events'), 1, MAX_EVENTS, 10);
  const interval = clampInt(params.get('interval'), 100, 10_000, 1000);
  const pod = selfName();
  let timer: ReturnType<typeof setInterval> | undefined;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let n = 0;
      const send = (): void => {
        n += 1;
        const data = JSON.stringify({ n, total, pod, time: new Date().toISOString() });
        controller.enqueue(encoder.encode(`id: ${n}\ndata: ${data}\n\n`));
        if (n >= total) {
          clearInterval(timer);
          controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'));
          controller.close();
        }
      };
      send();
      if (n < total) timer = setInterval(send, interval);
    },
    cancel() {
      clearInterval(timer);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'X-Accel-Buffering': 'no',
    },
  });
});
