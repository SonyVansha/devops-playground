import { wrap } from '../../../lib/handler.ts';
import { infoPayload } from '../../../lib/info.ts';
import { json } from '../../../lib/util.ts';

export const dynamic = 'force-dynamic';

export const GET = wrap('info', async () => json(await infoPayload()));
