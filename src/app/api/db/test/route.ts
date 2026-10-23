import { dbGuard, errorCode, requestConfig, withConnection } from '../../../../lib/db.ts';
import { wrap } from '../../../../lib/handler.ts';
import { json } from '../../../../lib/util.ts';

export const dynamic = 'force-dynamic';

// POST /api/db/test -> buka koneksi ke database (header X-DB-Conn atau env DB_*), jalankan SELECT 1 dan baca versi server.
export const POST = wrap('db_test', async (request) => {
  const denied = dbGuard(request);
  if (denied) return denied;
  const cfg = requestConfig(request);
  if (cfg instanceof Response) return cfg;
  const start = performance.now();
  try {
    return json(
      await withConnection(cfg, async (conn) => {
        await conn.query('SELECT 1');
        const versionSql = conn.dialect === 'postgres' ? 'SHOW server_version' : 'SELECT VERSION() AS server_version';
        const [row] = await conn.query(versionSql);
        return {
          connected: true,
          dialect: conn.dialect,
          version: String(Object.values(row ?? {})[0] ?? ''),
          ms: Math.round(performance.now() - start),
        };
      }),
    );
  } catch (error) {
    const code = errorCode(error);
    return json({ connected: false, error: code, ms: Math.round(performance.now() - start) }, code === 'NOT_CONFIGURED' ? 412 : 502);
  }
});
