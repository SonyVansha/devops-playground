import { wrap } from '../../../lib/handler.ts';
import { liveness } from '../../../lib/probe.ts';

export const dynamic = 'force-dynamic';

export const GET = wrap('healthz', () => liveness());
