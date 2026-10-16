import { wrap } from '../../../lib/handler.ts';
import { probe } from '../../../lib/probe.ts';
import { state } from '../../../lib/state.ts';

export const dynamic = 'force-dynamic';

export const GET = wrap('startupz', () => probe(state.started, 'startup'));
