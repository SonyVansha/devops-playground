import {
  buildCreate,
  dbGuard,
  errorCode,
  listTables,
  parseColumns,
  requestConfig,
  tableName,
  withConnection,
} from '../../../../lib/db.ts';
import { wrap } from '../../../../lib/handler.ts';
import { json } from '../../../../lib/util.ts';

export const dynamic = 'force-dynamic';

const MAX_BODY = 16 * 1024;

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const text = await request.text();
  if (text.length > MAX_BODY) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function failure(error: unknown): Response {
  const code = errorCode(error);
  return json({ error: code }, code === 'NOT_CONFIGURED' ? 412 : 502);
}

// GET /api/db/tables -> tabel milik playground (prefix playground_) saja.
export const GET = wrap('db_tables', async (request) => {
  const denied = dbGuard(request);
  if (denied) return denied;
  const cfg = requestConfig(request);
  if (cfg instanceof Response) return cfg;
  try {
    return json({ tables: await withConnection(cfg, listTables) });
  } catch (error) {
    return failure(error);
  }
});

// POST /api/db/tables  {"name":"notes","columns":[{"name":"title","type":"text"}]}
// Kolom id (auto increment, primary key) ditambahkan otomatis. Nama tabel dipaksa berawalan playground_.
export const POST = wrap('db_create_table', async (request) => {
  const denied = dbGuard(request);
  if (denied) return denied;
  const body = await readJson(request);
  if (!body) return json({ error: 'body must be a JSON object (max 16 KB)' }, 400);
  const table = tableName(body.name);
  if (!table) return json({ error: 'name must match [a-z][a-z0-9_]{0,40}' }, 400);
  const columns = parseColumns(body.columns);
  if (typeof columns === 'string') return json({ error: columns }, 400);
  const cfg = requestConfig(request);
  if (cfg instanceof Response) return cfg;
  try {
    await withConnection(cfg, (conn) => conn.query(buildCreate(conn.dialect, table, columns)));
    return json({ created: table, columns }, 201);
  } catch (error) {
    return failure(error);
  }
});
