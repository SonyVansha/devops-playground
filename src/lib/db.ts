import { tokenMatches } from './chaos.ts';
import { json } from './util.ts';

export type Dialect = 'postgres' | 'mysql';
export type ColumnType = 'text' | 'integer' | 'boolean' | 'timestamp';

export interface ColumnSpec {
  name: string;
  type: ColumnType;
}

export const TABLE_PREFIX = 'playground_';
export const MAX_COLUMNS = 20;
export const MAX_ROWS = 50;
const CONNECT_TIMEOUT_MS = 5000;
const IDENT = /^[a-z][a-z0-9_]{0,40}$/;

const SQL_TYPES: Record<Dialect, Record<ColumnType, string>> = {
  postgres: { text: 'TEXT', integer: 'INTEGER', boolean: 'BOOLEAN', timestamp: 'TIMESTAMPTZ' },
  mysql: { text: 'TEXT', integer: 'INT', boolean: 'TINYINT(1)', timestamp: 'DATETIME' },
};

export function dbEnabled(): boolean {
  return process.env.ENABLE_DB === 'true';
}

// Endpoint DB menulis ke database sungguhan, jadi dijaga seperti chaos:
// 1) ENABLE_DB=true  2) DB_TOKEN terpasang & cocok (header X-DB-Token).
export function dbGuard(request: Request): Response | null {
  if (!dbEnabled()) return json({ error: 'db endpoints disabled, set ENABLE_DB=true' }, 403);
  const expected = process.env.DB_TOKEN;
  if (!expected) return json({ error: 'DB_TOKEN is not configured' }, 403);
  if (!tokenMatches(request.headers.get('x-db-token') ?? '', expected)) {
    return json({ error: 'invalid db token' }, 401);
  }
  return null;
}

export function dialectOf(type: string | undefined = process.env.DB_TYPE): Dialect | null {
  const t = type?.trim().toLowerCase();
  if (t === 'postgres' || t === 'postgresql') return 'postgres';
  if (t === 'mysql') return 'mysql';
  return null;
}

export interface DbConfig {
  dialect: Dialect | null;
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

function validPort(raw: unknown, dialect: Dialect | null): number {
  const port = typeof raw === 'number' ? raw : Number.parseInt(String(raw ?? ''), 10);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : dialect === 'mysql' ? 3306 : 5432;
}

// Default opsional dari env DB_* (dipakai bila request tidak membawa header X-DB-Conn).
export function envConfig(): DbConfig {
  const e = process.env;
  const dialect = dialectOf();
  return {
    dialect,
    host: e.DB_HOST?.trim() ?? '',
    port: validPort(e.DB_PORT, dialect),
    user: e.DB_USER?.trim() ?? '',
    password: e.DB_PASSWORD ?? '',
    database: e.DB_NAME?.trim() ?? '',
  };
}

// Field wajib yang masih kosong. Port dan password opsional.
export function missingFields(c: DbConfig): string[] {
  const missing: string[] = [];
  if (!c.dialect) missing.push('type');
  if (!c.host) missing.push('host');
  if (!c.user) missing.push('user');
  if (!c.database) missing.push('database');
  return missing;
}

const HOST = /^[A-Za-z0-9._:\-\[\]]{1,253}$/;

// Koneksi dikirim UI per request lewat header X-DB-Conn = base64(JSON {type,host,port,user,password,database}).
// Server stateless (cocok untuk Vercel), dan header tidak ikut di-log oleh wrap().
export function parseConnHeader(value: string): DbConfig | null {
  try {
    const raw = JSON.parse(Buffer.from(value, 'base64').toString('utf8')) as Record<string, unknown>;
    const str = (k: string, max: number): string | null => {
      const v = raw[k] ?? '';
      return typeof v === 'string' && v.length <= max && !/[\u0000-\u001f]/.test(v) ? v : null;
    };
    const dialect = dialectOf(str('type', 20) ?? '');
    const host = str('host', 253)?.trim();
    const user = str('user', 128)?.trim();
    const password = str('password', 256);
    const database = str('database', 128)?.trim();
    if (host === undefined || user === undefined || password === null || database === undefined) return null;
    if (host && !HOST.test(host)) return null;
    return { dialect, host: host ?? '', port: validPort(raw.port, dialect), user: user ?? '', password, database: database ?? '' };
  } catch {
    return null;
  }
}

// Konfigurasi untuk satu request: header X-DB-Conn bila ada, kalau tidak env DB_*. Mengembalikan Response bila tidak valid.
export function requestConfig(request: Request): DbConfig | Response {
  const header = request.headers.get('x-db-conn');
  const cfg = header ? parseConnHeader(header) : envConfig();
  if (!cfg) return json({ error: 'invalid X-DB-Conn header' }, 400);
  const missing = missingFields(cfg);
  if (missing.length > 0) return json({ error: 'connection incomplete', missing }, 412);
  return cfg;
}

export function quoteIdent(dialect: Dialect, name: string): string {
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(name)) throw new Error('invalid identifier');
  return dialect === 'postgres' ? `"${name}"` : `\`${name}\``;
}

// Nama dari user hanya sufiks; prefix playground_ dipaksa agar tabel milik aplikasi lain tidak tersentuh.
export function tableName(suffix: unknown): string | null {
  if (typeof suffix !== 'string') return null;
  const clean = suffix.startsWith(TABLE_PREFIX) ? suffix.slice(TABLE_PREFIX.length) : suffix;
  return IDENT.test(clean) ? `${TABLE_PREFIX}${clean}` : null;
}

export function parseColumns(raw: unknown): ColumnSpec[] | string {
  if (!Array.isArray(raw) || raw.length === 0) return 'columns must be a non-empty array';
  if (raw.length > MAX_COLUMNS) return `at most ${MAX_COLUMNS} columns`;
  const seen = new Set<string>(['id']);
  const out: ColumnSpec[] = [];
  for (const item of raw) {
    const { name, type } = (item ?? {}) as { name?: unknown; type?: unknown };
    if (typeof name !== 'string' || !IDENT.test(name)) return 'invalid column name';
    if (seen.has(name)) return `duplicate or reserved column name: ${name}`;
    if (typeof type !== 'string' || !(type in SQL_TYPES.postgres)) return 'type must be text, integer, boolean, or timestamp';
    seen.add(name);
    out.push({ name, type: type as ColumnType });
  }
  return out;
}

export function buildCreate(dialect: Dialect, table: string, columns: ColumnSpec[]): string {
  const idCol = dialect === 'postgres' ? 'id SERIAL PRIMARY KEY' : 'id INT AUTO_INCREMENT PRIMARY KEY';
  const cols = columns.map((c) => `${quoteIdent(dialect, c.name)} ${SQL_TYPES[dialect][c.type]}`);
  return `CREATE TABLE IF NOT EXISTS ${quoteIdent(dialect, table)} (${[idCol, ...cols].join(', ')})`;
}

export function buildInsert(dialect: Dialect, table: string, names: string[]): string {
  const cols = names.map((n) => quoteIdent(dialect, n)).join(', ');
  const marks = names.map((_, i) => (dialect === 'postgres' ? `$${i + 1}` : '?')).join(', ');
  return `INSERT INTO ${quoteIdent(dialect, table)} (${cols}) VALUES (${marks})`;
}

export function coerce(type: string, value: unknown): unknown {
  if (value === null || value === undefined || value === '') return null;
  // tinyint = boolean di MySQL; harus dicek sebelum "int".
  if (/bool|tinyint/i.test(type)) return value === true || value === 'true' || value === 1 || value === '1';
  if (/int/i.test(type)) {
    const n = Number(value);
    if (!Number.isInteger(n)) throw new Error('integer expected');
    return n;
  }
  if (/time|date/i.test(type)) {
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) throw new Error('timestamp expected');
    return d;
  }
  return String(value).slice(0, 1000);
}

export interface Conn {
  dialect: Dialect;
  query(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
  close(): Promise<void>;
}

// Koneksi pendek per request (cocok untuk serverless seperti Vercel; tidak menyisakan pool).
export async function openConnection(config: DbConfig): Promise<Conn> {
  const { dialect, ...cfg } = config;
  if (!dialect) throw Object.assign(new Error('type not set'), { code: 'NOT_CONFIGURED' });

  if (dialect === 'postgres') {
    const { Client } = await import('pg');
    const client = new Client({ ...cfg, connectionTimeoutMillis: CONNECT_TIMEOUT_MS, query_timeout: 10_000 });
    await client.connect();
    return {
      dialect,
      query: async (sql, params) => (await client.query(sql, params)).rows as Record<string, unknown>[],
      close: () => client.end(),
    };
  }

  const mysql = await import('mysql2/promise');
  const conn = await mysql.createConnection({ ...cfg, connectTimeout: CONNECT_TIMEOUT_MS });
  return {
    dialect,
    query: async (sql, params) => {
      const [rows] = await conn.query(sql, params);
      return Array.isArray(rows) ? (rows as Record<string, unknown>[]) : [];
    },
    close: () => conn.end(),
  };
}

// Jangan bocorkan pesan driver (bisa memuat host/user); cukup kode.
export function errorCode(error: unknown): string {
  const code = (error as { code?: unknown } | null)?.code;
  return typeof code === 'string' ? code : 'ERROR';
}

export async function withConnection<T>(config: DbConfig, fn: (conn: Conn) => Promise<T>): Promise<T> {
  const conn = await openConnection(config);
  try {
    return await fn(conn);
  } finally {
    await conn.close().catch(() => undefined);
  }
}

export async function listTables(conn: Conn): Promise<string[]> {
  const sql =
    conn.dialect === 'postgres'
      ? `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name LIKE 'playground\\_%' ORDER BY 1`
      : `SELECT table_name AS name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name LIKE 'playground\\_%' ORDER BY 1`;
  return (await conn.query(sql)).map((r) => String(r.name ?? r.NAME ?? r.TABLE_NAME));
}

export async function tableColumns(conn: Conn, table: string): Promise<Array<{ name: string; type: string }>> {
  const sql =
    conn.dialect === 'postgres'
      ? `SELECT column_name AS name, data_type AS type FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 ORDER BY ordinal_position`
      : `SELECT column_name AS name, data_type AS type FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? ORDER BY ordinal_position`;
  return (await conn.query(sql, [table])).map((r) => ({
    name: String(r.name ?? r.COLUMN_NAME),
    type: String(r.type ?? r.DATA_TYPE),
  }));
}
