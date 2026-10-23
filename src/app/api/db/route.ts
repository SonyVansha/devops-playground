import { dbEnabled, envConfig, missingFields } from '../../../lib/db.ts';
import { wrap } from '../../../lib/handler.ts';
import { json } from '../../../lib/util.ts';

export const dynamic = 'force-dynamic';

// Status DB (tanpa rahasia): dipakai UI untuk tahu apakah fitur aktif dan apakah ada default koneksi dari env DB_*.
export const GET = wrap('db_status', () =>
  json({
    enabled: dbEnabled(),
    tokenConfigured: Boolean(process.env.DB_TOKEN),
    envDefaults: missingFields(envConfig()).length === 0,
  }),
);
