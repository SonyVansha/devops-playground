import {
  buildInsert,
  coerce,
  dbGuard,
  errorCode,
  listTables,
  MAX_ROWS,
  quoteIdent,
  requestConfig,
  tableColumns,
  tableName,
  withConnection,
} from '../../../../../lib/db.ts';
import { wrap } from '../../../../../lib/handler.ts';
import { json } from '../../../../../lib/util.ts';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ name: string }> };

const MAX_BODY = 16 * 1024;

function failure(error: unknown): Response {
  const code = errorCode(error);
  return json({ error: code }, code === 'NOT_CONFIGURED' ? 412 : 502);
}

// GET /api/db/tables/<name> -> 50 baris terbaru.
export const GET = wrap<Ctx>('db_rows', async (request, ctx) => {
  const denied = dbGuard(request);
  if (denied) return denied;
  const table = tableName((await ctx.params).name);
  if (!table) return json({ error: 'invalid table name' }, 400);
  const cfg = requestConfig(request);
  if (cfg instanceof Response) return cfg;
  try {
    const result = await withConnection(cfg, async (conn) => {
      if (!(await listTables(conn)).includes(table)) return null;
      const columns = await tableColumns(conn, table);
      const rows = await conn.query(`SELECT * FROM ${quoteIdent(conn.dialect, table)} ORDER BY id DESC LIMIT ${MAX_ROWS}`);
      return { table, columns, rows };
    });
    return result ? json(result) : json({ error: 'table not found' }, 404);
  } catch (error) {
    return failure(error);
  }
});

// POST /api/db/tables/<name>  {"values":{"title":"halo"}} -> insert satu baris (nilai selalu lewat parameter bind).
export const POST = wrap<Ctx>('db_insert', async (request, ctx) => {
  const denied = dbGuard(request);
  if (denied) return denied;
  const table = tableName((await ctx.params).name);
  if (!table) return json({ error: 'invalid table name' }, 400);
  const text = await request.text();
  if (text.length > MAX_BODY) return json({ error: 'body too large' }, 413);
  let values: Record<string, unknown>;
  try {
    const parsed = (JSON.parse(text) as { values?: unknown }).values;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('values');
    values = parsed as Record<string, unknown>;
  } catch {
    return json({ error: 'body must be {"values":{...}}' }, 400);
  }
  const cfg = requestConfig(request);
  if (cfg instanceof Response) return cfg;
  try {
    const result = await withConnection(cfg, async (conn) => {
      if (!(await listTables(conn)).includes(table)) return { status: 404, body: { error: 'table not found' } };
      const known = new Map((await tableColumns(conn, table)).filter((c) => c.name !== 'id').map((c) => [c.name, c.type]));
      const names = Object.keys(values);
      if (names.length === 0) return { status: 400, body: { error: 'values must not be empty' } };
      const unknown = names.find((n) => !known.has(n));
      if (unknown) return { status: 400, body: { error: `unknown column: ${unknown}` } };
      let params: unknown[];
      try {
        params = names.map((n) => coerce(known.get(n) ?? 'text', values[n]));
      } catch (error) {
        return { status: 400, body: { error: (error as Error).message } };
      }
      await conn.query(buildInsert(conn.dialect, table, names), params);
      return { status: 201, body: { inserted: 1, table } };
    });
    return json(result.body, result.status);
  } catch (error) {
    return failure(error);
  }
});
