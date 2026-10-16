import { wrap } from '../../../lib/handler.ts';
import { readiness } from '../../../lib/probe.ts';

export const dynamic = 'force-dynamic';

export const GET = wrap('readyz', () => readiness());
