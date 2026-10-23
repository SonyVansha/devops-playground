import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCreate,
  buildInsert,
  coerce,
  dbGuard,
  envConfig,
  dialectOf,
  missingFields,
  parseConnHeader,
  requestConfig,
  parseColumns,
  quoteIdent,
  tableName,
} from '../src/lib/db.ts';
import { GET as dbStatus } from '../src/app/api/db/route.ts';
import { POST as dbTest } from '../src/app/api/db/test/route.ts';
import { GET as tablesGet, POST as tablesPost } from '../src/app/api/db/tables/route.ts';
import { GET as rowsGet, POST as rowsPost } from '../src/app/api/db/tables/[name]/route.ts';

const r = (path: string, init?: RequestInit) => new Request(`http://x${path}`, init);
const AUTH = { 'x-db-token': 'tok' };
const post = (body: unknown) => ({ method: 'POST', headers: { ...AUTH, 'content-type': 'application/json' }, body: JSON.stringify(body) });
const NO_DB = { DB_TYPE: undefined, DB_HOST: undefined, DB_PORT: undefined, DB_USER: undefined, DB_PASSWORD: undefined, DB_NAME: undefined };
const FULL_DB = { DB_TYPE: 'postgres', DB_HOST: 'h', DB_USER: 'u', DB_PASSWORD: 'secret', DB_NAME: 'd' };
const ctx = (name: string) => ({ params: Promise.resolve({ name }) });

function withEnv(env: Record<string, string | undefined>, fn: () => Promise<void> | void) {
  return async () => {
    const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
    for (const [k, v] of Object.entries(env)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    try {
      await fn();
    } finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  };
}

test('dialectOf reads DB_TYPE', () => {
  assert.equal(dialectOf('postgres'), 'postgres');
  assert.equal(dialectOf(' PostgreSQL '), 'postgres');
  assert.equal(dialectOf('mysql'), 'mysql');
  assert.equal(dialectOf('sqlite'), null);
  assert.equal(dialectOf(''), null);
  assert.equal(dialectOf(undefined), null);
});

test('envConfig applies default ports and missingFields lists required fields', withEnv({ ...NO_DB, DB_TYPE: 'mysql' }, () => {
  assert.equal(envConfig().port, 3306);
  assert.deepEqual(missingFields(envConfig()), ['host', 'user', 'database']);
  process.env.DB_TYPE = 'postgres';
  assert.equal(envConfig().port, 5432);
  process.env.DB_PORT = '6543';
  assert.equal(envConfig().port, 6543);
  process.env.DB_PORT = 'abc';
  assert.equal(envConfig().port, 5432);
  Object.assign(process.env, { DB_HOST: 'h', DB_USER: 'u', DB_NAME: 'd' });
  assert.deepEqual(missingFields(envConfig()), []);
}));

const conn = (o: Record<string, unknown>) => Buffer.from(JSON.stringify(o)).toString('base64');
const GOOD = { type: 'mysql', host: 'db.example.com', port: 3307, user: 'u', password: 'pä ss', database: 'app' };

test('parseConnHeader decodes a valid connection and rejects malformed ones', () => {
  assert.deepEqual(parseConnHeader(conn(GOOD)), { dialect: 'mysql', host: 'db.example.com', port: 3307, user: 'u', password: 'pä ss', database: 'app' });
  assert.equal(parseConnHeader(conn({ ...GOOD, port: '' }))?.port, 3306);
  assert.equal(parseConnHeader('not base64 json'), null);
  assert.equal(parseConnHeader(conn({ ...GOOD, host: 'a b;rm -rf' })), null);
  assert.equal(parseConnHeader(conn({ ...GOOD, host: 'x'.repeat(300) })), null);
  assert.equal(parseConnHeader(conn({ ...GOOD, user: 5 })), null);
  assert.equal(parseConnHeader(conn({ ...GOOD, database: 'a\nb' })), null);
  assert.equal(parseConnHeader(conn({ ...GOOD, type: 'sqlite' }))?.dialect, null);
});

test('requestConfig prefers the X-DB-Conn header, falls back to env, and reports gaps', withEnv({ ...NO_DB }, async () => {
  const header = (o: Record<string, unknown>) => r('/x', { headers: { 'x-db-conn': conn(o) } });
  const ok = requestConfig(header(GOOD));
  assert.equal(ok instanceof Response, false);
  assert.equal((ok as { host: string }).host, 'db.example.com');

  const bad = requestConfig(r('/x', { headers: { 'x-db-conn': '%%%' } })) as Response;
  assert.equal(bad.status, 400);

  const incomplete = requestConfig(header({ ...GOOD, database: '' })) as Response;
  assert.equal(incomplete.status, 412);
  assert.deepEqual((await incomplete.json()).missing, ['database']);

  assert.equal((requestConfig(r('/x')) as Response).status, 412); // tanpa header dan tanpa env
  Object.assign(process.env, FULL_DB);
  assert.equal((requestConfig(r('/x')) as { host: string }).host, 'h');
}));

test('tableName forces the playground_ prefix and rejects bad names', () => {
  assert.equal(tableName('notes'), 'playground_notes');
  assert.equal(tableName('playground_notes'), 'playground_notes');
  for (const bad of ['', 'Notes', '1abc', 'a-b', 'a b', 'users; DROP TABLE x', 'a'.repeat(42), 42, null]) {
    assert.equal(tableName(bad), null, String(bad));
  }
});

test('quoteIdent quotes per dialect and refuses injection', () => {
  assert.equal(quoteIdent('postgres', 'playground_a'), '"playground_a"');
  assert.equal(quoteIdent('mysql', 'playground_a'), '`playground_a`');
  assert.throws(() => quoteIdent('postgres', 'a"; drop table x; --'));
  assert.throws(() => quoteIdent('mysql', 'a`b'));
});

test('parseColumns validates names, types, duplicates and limits', () => {
  assert.deepEqual(parseColumns([{ name: 'title', type: 'text' }]), [{ name: 'title', type: 'text' }]);
  assert.equal(typeof parseColumns([]), 'string');
  assert.equal(typeof parseColumns('x'), 'string');
  assert.equal(typeof parseColumns([{ name: 'id', type: 'text' }]), 'string');
  assert.equal(typeof parseColumns([{ name: 'a', type: 'text' }, { name: 'a', type: 'integer' }]), 'string');
  assert.equal(typeof parseColumns([{ name: 'a', type: 'blob' }]), 'string');
  assert.equal(typeof parseColumns([{ name: 'A b', type: 'text' }]), 'string');
  assert.equal(typeof parseColumns(Array.from({ length: 21 }, (_, i) => ({ name: `c${i}`, type: 'text' }))), 'string');
});

test('buildCreate and buildInsert produce dialect-specific parameterised SQL', () => {
  const cols = [
    { name: 'title', type: 'text' as const },
    { name: 'done', type: 'boolean' as const },
    { name: 'at', type: 'timestamp' as const },
  ];
  assert.equal(
    buildCreate('postgres', 'playground_t', cols),
    'CREATE TABLE IF NOT EXISTS "playground_t" (id SERIAL PRIMARY KEY, "title" TEXT, "done" BOOLEAN, "at" TIMESTAMPTZ)',
  );
  assert.equal(
    buildCreate('mysql', 'playground_t', cols),
    'CREATE TABLE IF NOT EXISTS `playground_t` (id INT AUTO_INCREMENT PRIMARY KEY, `title` TEXT, `done` TINYINT(1), `at` DATETIME)',
  );
  assert.equal(buildInsert('postgres', 'playground_t', ['title', 'done']), 'INSERT INTO "playground_t" ("title", "done") VALUES ($1, $2)');
  assert.equal(buildInsert('mysql', 'playground_t', ['title', 'done']), 'INSERT INTO `playground_t` (`title`, `done`) VALUES (?, ?)');
});

test('coerce converts values by column type', () => {
  assert.equal(coerce('integer', '42'), 42);
  assert.throws(() => coerce('int', 'abc'));
  assert.throws(() => coerce('integer', '1.5'));
  assert.equal(coerce('boolean', 'true'), true);
  assert.equal(coerce('tinyint', '0'), false);
  assert.equal(coerce('text', 123), '123');
  assert.equal(coerce('text', ''), null);
  assert.ok(coerce('timestamp with time zone', '2026-01-02T03:04:05Z') instanceof Date);
  assert.throws(() => coerce('datetime', 'not a date'));
  assert.equal((coerce('text', 'x'.repeat(5000)) as string).length, 1000);
});

test('dbGuard enforces enable flag and token', withEnv({ ENABLE_DB: undefined, DB_TOKEN: undefined }, async () => {
  const req = (headers?: HeadersInit) => r('/db', { headers });
  assert.equal(dbGuard(req())?.status, 403);
  process.env.ENABLE_DB = 'true';
  assert.equal(dbGuard(req())?.status, 403); // token belum di-set
  process.env.DB_TOKEN = 'tok';
  assert.equal(dbGuard(req())?.status, 401);
  assert.equal(dbGuard(req({ 'x-db-token': 'bad' }))?.status, 401);
  assert.equal(dbGuard(req(AUTH)), null);
}));

test('db status never exposes the password', withEnv({ ENABLE_DB: 'true', DB_TOKEN: 'tok', ...FULL_DB }, async () => {
  const res = await dbStatus(r('/api/db'), undefined);
  const text = await res.text();
  assert.equal(res.status, 200);
  assert.equal(text.includes('secret'), false);
  assert.deepEqual(JSON.parse(text), { enabled: true, tokenConfigured: true, envDefaults: true });
}));

test('db routes are blocked while disabled', withEnv({ ENABLE_DB: undefined, DB_TOKEN: undefined, ...NO_DB }, async () => {
  assert.equal((await dbTest(r('/api/db/test', post({})), undefined)).status, 403);
  assert.equal((await tablesGet(r('/api/db/tables', { headers: AUTH }), undefined)).status, 403);
  assert.equal((await tablesPost(r('/api/db/tables', post({})), undefined)).status, 403);
  assert.equal((await rowsGet(r('/x', { headers: AUTH }), ctx('notes'))).status, 403);
  assert.equal((await rowsPost(r('/x', post({})), ctx('notes'))).status, 403);
}));

test('db routes validate input before touching the database', withEnv({ ENABLE_DB: 'true', DB_TOKEN: 'tok', ...NO_DB }, async () => {
  assert.equal((await tablesPost(r('/api/db/tables', post({ name: 'Bad Name', columns: [{ name: 'a', type: 'text' }] })), undefined)).status, 400);
  assert.equal((await tablesPost(r('/api/db/tables', post({ name: 'ok', columns: [] })), undefined)).status, 400);
  assert.equal((await tablesPost(r('/api/db/tables', { method: 'POST', headers: AUTH, body: 'not json' }), undefined)).status, 400);
  assert.equal((await tablesPost(r('/api/db/tables', { method: 'POST', headers: AUTH, body: '[]' }), undefined)).status, 400);
  assert.equal((await rowsGet(r('/x', { headers: AUTH }), ctx('Bad-Name'))).status, 400);
  assert.equal((await rowsPost(r('/x', post({ nope: 1 })), ctx('notes'))).status, 400);
  assert.equal((await rowsPost(r('/x', { method: 'POST', headers: AUTH, body: 'x'.repeat(20_000) }), ctx('notes'))).status, 413);
}));

test('db routes answer 412 when no connection is given', withEnv({ ENABLE_DB: 'true', DB_TOKEN: 'tok', ...NO_DB }, async () => {
  const test412 = await dbTest(r('/api/db/test', post({})), undefined);
  assert.equal(test412.status, 412);
  assert.deepEqual((await test412.json()).missing, ['type', 'host', 'user', 'database']);
  assert.equal((await tablesGet(r('/api/db/tables', { headers: AUTH }), undefined)).status, 412);
  assert.equal((await tablesPost(r('/api/db/tables', post({ name: 'ok', columns: [{ name: 'a', type: 'text' }] })), undefined)).status, 412);
}));
