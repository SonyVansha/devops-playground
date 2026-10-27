'use client';

import { useCallback, useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { useI18n } from '../../i18n/client';
import Rich from '../Rich';
import { Icon } from '../shell/Icons';
import { call, type CallResult } from './api';
import { usePoll, useRemembered } from './hooks';
import { cell, parseJson, summarize, type Outcome } from './outcome';
import { ResultNote } from './ui';

interface DbStatus {
  enabled: boolean;
  tokenConfigured: boolean;
  envDefaults: boolean;
}

interface Remembered extends Record<string, string> {
  type: 'postgres' | 'mysql';
  host: string;
  port: string;
  user: string;
  database: string;
}

interface Connected {
  dialect: 'postgres' | 'mysql';
  version: string;
  ms: number;
}

interface RowsData {
  table: string;
  columns: Array<{ name: string; type: string }>;
  rows: Array<Record<string, unknown>>;
}

interface NewColumn {
  name: string;
  type: string;
}

type Kind = 'bool' | 'int' | 'time' | 'text';
// Penanda aksi yang sedang berjalan (stabil, bukan teks yang diterjemahkan).
type Busy = 'connect' | 'create' | 'save' | 'tables' | 'rows';

const TYPES = ['text', 'integer', 'boolean', 'timestamp'];
const MAX_COLUMNS = 20;
const IDENT = '[a-z][a-z0-9_]{0,40}';

// Contoh siap pakai: satu klik mengisi form, pengguna tetap menekan "Buat tabel".
const PRESETS: ReadonlyArray<{ name: string; cols: NewColumn[] }> = [
  { name: 'notes', cols: [{ name: 'title', type: 'text' }, { name: 'done', type: 'boolean' }] },
  { name: 'todos', cols: [{ name: 'task', type: 'text' }, { name: 'done', type: 'boolean' }, { name: 'due', type: 'timestamp' }] },
  { name: 'events', cols: [{ name: 'kind', type: 'text' }, { name: 'count', type: 'integer' }, { name: 'at', type: 'timestamp' }] },
];

function kindOf(type: string): Kind {
  if (/bool|tinyint/i.test(type)) return 'bool';
  if (/int/i.test(type)) return 'int';
  if (/time|date/i.test(type)) return 'time';
  return 'text';
}

// Header X-DB-Conn = base64(JSON). Password hanya ada di memori browser, tidak disimpan.
function encodeConn(c: Record<string, string>): string {
  const bytes = new TextEncoder().encode(JSON.stringify(c));
  return btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
}

export default function Database({ active }: Readonly<{ active: boolean }>) {
  const { t } = useI18n();
  const { data } = usePoll<DbStatus>('/api/db', 10_000, active);
  // Yang diingat hanya isian non-rahasia. Password dan token tidak pernah disimpan.
  const [conn, setConn] = useRemembered<Remembered>('db', { type: 'postgres', host: '', port: '', user: '', database: '' });
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [connected, setConnected] = useState<Connected | null>(null);
  const [editing, setEditing] = useState(true);
  const [tables, setTables] = useState<string[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [mode, setMode] = useState<'rows' | 'new'>('rows');
  const [rows, setRows] = useState<RowsData | null>(null);
  const [newRow, setNewRow] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState('');
  const [newCols, setNewCols] = useState<NewColumn[]>([{ name: 'title', type: 'text' }]);
  const [focusCol, setFocusCol] = useState<number | null>(null);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [connNote, setConnNote] = useState<Outcome | null>(null);
  const [tableNote, setTableNote] = useState<Outcome | null>(null);

  useEffect(() => {
    if (focusCol === null) return;
    document.getElementById(`db-col-${focusCol}`)?.focus();
    setFocusCol(null);
  }, [focusCol, newCols.length]);

  const set = (patch: Partial<Remembered>) => {
    setConn({ ...conn, ...patch } as Remembered);
    setConnected(null); // koneksi yang diubah harus diuji ulang
  };

  const headers = useCallback(
    (json: boolean): Record<string, string> => ({
      'X-DB-Token': token,
      // Form kosong -> server memakai default env DB_* bila ada.
      ...(conn.host.trim() ? { 'X-DB-Conn': encodeConn({ ...conn, password }) } : {}),
      ...(json ? { 'Content-Type': 'application/json' } : {}),
    }),
    [token, conn, password],
  );

  const api = useCallback(
    async (kind: Busy, method: string, path: string, body?: unknown): Promise<CallResult> => {
      setBusy(kind);
      const res = await call(method, path, { headers: headers(body !== undefined), body: body !== undefined ? JSON.stringify(body) : undefined });
      setBusy(null);
      return res;
    },
    [headers],
  );

  const note = (label: string, res: CallResult) => summarize(label, res, t, { token: 'DB token' });

  const loadTables = async (): Promise<string[] | null> => {
    const res = await api('tables', 'GET', '/api/db/tables');
    if (!res.ok) {
      setTableNote(note(t('db.l.tables'), res));
      return null;
    }
    const list = parseJson<{ tables: string[] }>(res)?.tables ?? [];
    setTables(list);
    return list;
  };

  const loadRows = async (table: string) => {
    const res = await api('rows', 'GET', `/api/db/tables/${encodeURIComponent(table)}`);
    if (res.ok) setRows(parseJson<RowsData>(res));
    else {
      setRows(null);
      setTableNote(note(t('db.l.rows'), res));
    }
  };

  const openTable = async (name: string) => {
    setMode('rows');
    setSelected(name);
    setNewRow({});
    setTableNote(null);
    await loadRows(name);
  };

  const connect = async (e: FormEvent) => {
    e.preventDefault();
    const res = await api('connect', 'POST', '/api/db/test');
    setConnNote(note(t('db.l.connect'), res));
    if (res.ok) {
      const body = parseJson<{ dialect: 'postgres' | 'mysql'; version: string; ms: number }>(res);
      if (body) setConnected({ dialect: body.dialect, version: body.version, ms: body.ms });
      setEditing(false);
      await loadTables();
    }
  };

  const createTable = async (e: FormEvent) => {
    e.preventDefault();
    const res = await api('create', 'POST', '/api/db/tables', { name: newName.trim(), columns: newCols.filter((c) => c.name.trim()) });
    const outcome = note(t('db.l.create'), res);
    setTableNote(outcome);
    if (!res.ok) return;
    const created = parseJson<{ created: string }>(res)?.created ?? '';
    setNewName('');
    setNewCols([{ name: 'title', type: 'text' }]);
    await loadTables();
    setTableNote(outcome);
    if (created) await openTable(created);
    setTableNote(outcome);
  };

  const saveRow = async () => {
    if (!selected) return;
    const filled = Object.fromEntries(Object.entries(newRow).filter(([, v]) => v !== ''));
    const res = await api('save', 'POST', `/api/db/tables/${encodeURIComponent(selected)}`, { values: filled });
    const outcome = note(t('db.l.save'), res);
    if (res.ok) {
      setNewRow({});
      await loadRows(selected);
      document.getElementById('db-new-0')?.focus();
    }
    setTableNote(outcome);
  };

  const onRowKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (hasNewValues && !busy) void saveRow();
    } else if (e.key === 'Escape') {
      setNewRow({});
    }
  };

  const onColKey = (e: KeyboardEvent<HTMLInputElement>, i: number) => {
    if (e.key !== 'Enter' || !e.currentTarget.value.trim()) return;
    e.preventDefault();
    if (i === newCols.length - 1 && newCols.length < MAX_COLUMNS) setNewCols([...newCols, { name: '', type: 'text' }]);
    setFocusCol(i + 1);
  };

  const setCol = (i: number, patch: Partial<NewColumn>) => setNewCols(newCols.map((c, j) => (j === i ? { ...c, ...patch } : c)));

  const formReady = Boolean(conn.host.trim() && conn.user.trim() && conn.database.trim());
  let why = '';
  if (!data) why = t('db.why.checking');
  else if (!data.enabled || !data.tokenConfigured) why = t('db.why.inactive');
  else if (!token) why = t('db.why.token');
  else if (!formReady && !data.envDefaults) why = t('db.why.fill');
  const blocked = why !== '' || busy !== null;
  const hasNewValues = Object.values(newRow).some((v) => v !== '');
  const editable = rows?.columns.filter((c) => c.name !== 'id') ?? [];
  const dialectName = connected?.dialect === 'mysql' ? 'MySQL' : 'PostgreSQL';

  return (
    <div className="stack">
      {data && !data.enabled && (
        <div className="banner warn" role="status">
          <Rich text={t('db.off')} />
        </div>
      )}
      {data?.enabled && !data.tokenConfigured && (
        <div className="banner err" role="status">
          <Rich text={t('db.noToken')} />
        </div>
      )}

      <div className="db-grid">
        <div className="stack">
          <section className="card stack" aria-labelledby="db-h-conn" aria-busy={busy !== null}>
            <div className="row between">
              <h2 id="db-h-conn">{t('db.connection')}</h2>
              {connected && !editing && (
                <button type="button" className="btn sm" onClick={() => setEditing(true)}>
                  {t('db.edit')}
                </button>
              )}
            </div>

            {connected && !editing ? (
              <div className="conn-chip" role="status">
                <span className="pill ok">{t('db.connectedPill')}</span>
                <span>
                  {dialectName} {connected.version}, {connected.ms} ms
                </span>
                <span className="muted mono">{conn.host ? `${conn.user}@${conn.host}/${conn.database}` : t('db.envDefault')}</span>
              </div>
            ) : (
              <form className="stack" onSubmit={connect}>
                <div className="field-grid">
                  <label>
                    {t('db.type')}
                    <select value={conn.type} onChange={(e) => set({ type: e.target.value as Remembered['type'] })}>
                      <option value="postgres">PostgreSQL</option>
                      <option value="mysql">MySQL</option>
                    </select>
                  </label>
                  <label>
                    {t('db.port')}
                    <input
                      value={conn.port}
                      onChange={(e) => set({ port: e.target.value })}
                      placeholder={conn.type === 'mysql' ? '3306' : '5432'}
                      inputMode="numeric"
                      autoComplete="off"
                    />
                  </label>
                  <label className="span-2">
                    {t('db.host')}
                    <input value={conn.host} onChange={(e) => set({ host: e.target.value })} placeholder="localhost" autoComplete="off" spellCheck={false} />
                  </label>
                  <label>
                    {t('db.user')}
                    <input value={conn.user} onChange={(e) => set({ user: e.target.value })} autoComplete="off" spellCheck={false} />
                  </label>
                  <label>
                    {t('db.password')}
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        setConnected(null);
                      }}
                      autoComplete="new-password"
                    />
                  </label>
                  <label className="span-2">
                    {t('db.name')}
                    <input value={conn.database} onChange={(e) => set({ database: e.target.value })} autoComplete="off" spellCheck={false} />
                  </label>
                  <label className="span-2">
                    {t('db.token')}
                    <input type="password" autoComplete="new-password" value={token} onChange={(e) => setToken(e.target.value)} aria-describedby="db-token-hint" />
                    <span className="hint" id="db-token-hint">
                      <Rich text={t('db.tokenHint')} />
                    </span>
                  </label>
                </div>
                <div className="form-actions">
                  <button type="submit" className="btn primary" disabled={blocked} aria-describedby="db-why">
                    {busy === 'connect' ? t('db.connecting') : t('db.connect')}
                  </button>
                  {connected && (
                    <button type="button" className="btn" onClick={() => setEditing(false)}>
                      {t('common.cancel')}
                    </button>
                  )}
                  <span className="hint" id="db-why">
                    {why}
                  </span>
                </div>
              </form>
            )}
            {connNote && <ResultNote outcome={connNote} />}
          </section>

          <section className="card stack" aria-labelledby="db-h-tables">
            <div className="row between">
              <h2 id="db-h-tables">{t('db.tables')}</h2>
              <div className="row">
                <button
                  type="button"
                  className="btn sm icon-btn"
                  aria-label={t('db.reloadTables')}
                  title={t('db.reloadTables')}
                  disabled={blocked || !connected}
                  onClick={() => void loadTables()}
                >
                  <Icon name="refresh" size={14} />
                </button>
                <button
                  type="button"
                  className="btn sm"
                  disabled={blocked || !connected}
                  onClick={() => {
                    setMode('new');
                    setSelected(null);
                    setTableNote(null);
                  }}
                >
                  <Icon name="plus" size={14} />
                  {t('db.newTable')}
                </button>
              </div>
            </div>
            {!connected && <p className="muted">{t('db.connectFirst')}</p>}
            {connected && tables === null && <p className="muted">{t('db.loadingTables')}</p>}
            {connected && tables?.length === 0 && (
              <div className="empty-frame">
                <p>{t('db.noTables')}</p>
                <button
                  type="button"
                  className="btn sm"
                  onClick={() => {
                    setMode('new');
                    setSelected(null);
                  }}
                >
                  {t('db.firstTable')}
                </button>
              </div>
            )}
            {tables && tables.length > 0 && (
              <ul className="table-list" aria-label={t('db.tableListAria')}>
                {tables.map((name) => (
                  <li key={name}>
                    <button
                      type="button"
                      className="table-item"
                      aria-current={mode === 'rows' && selected === name ? 'true' : undefined}
                      onClick={() => void openTable(name)}
                      disabled={busy !== null}
                    >
                      <Icon name="database" size={14} />
                      <span className="mono">{name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <section className="card stack db-main" aria-live="polite">
          {tableNote && <ResultNote outcome={tableNote} raw={false} />}

          {mode === 'new' && (
            <form className="stack" onSubmit={createTable} aria-labelledby="db-h-new">
              <div>
                <h2 id="db-h-new">{t('db.newTable')}</h2>
                <p className="sub">
                  <Rich text={t('db.newSub')} />
                </p>
              </div>
              <div className="chips" aria-label={t('db.examplesAria')}>
                <span className="muted">{t('db.examples')}</span>
                {PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    className="chip"
                    onClick={() => {
                      setNewName(p.name);
                      setNewCols(p.cols);
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <label>
                {t('db.tableName')}
                <span className="input-prefix">
                  <span aria-hidden="true">playground_</span>
                  <input
                    value={newName}
                    onChange={(e) => setNewName(e.target.value.toLowerCase())}
                    placeholder="notes"
                    pattern={IDENT}
                    title={t('db.identTitle')}
                    autoComplete="off"
                    spellCheck={false}
                    aria-label={t('db.tableNameAria')}
                  />
                </span>
              </label>
              <fieldset className="cols-set">
                <legend>{t('db.columns')}</legend>
                {newCols.map((col, i) => (
                  // eslint-disable-next-line react/no-array-index-key -- daftar kolom pendek, tanpa id stabil
                  <div className="row nowrap" key={i}>
                    <input
                      id={`db-col-${i}`}
                      className="field-grow"
                      aria-label={t('db.colName', { n: i + 1 })}
                      value={col.name}
                      placeholder={t('db.colNamePh')}
                      pattern={IDENT}
                      title={t('db.identTitle')}
                      autoComplete="off"
                      spellCheck={false}
                      onChange={(e) => setCol(i, { name: e.target.value.toLowerCase() })}
                      onKeyDown={(e) => onColKey(e, i)}
                    />
                    <select className="select-type" aria-label={t('db.colType', { n: i + 1 })} value={col.type} onChange={(e) => setCol(i, { type: e.target.value })}>
                      {TYPES.map((type) => (
                        <option key={type}>{type}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn sm icon-btn"
                      aria-label={t('db.delCol', { n: i + 1 })}
                      disabled={newCols.length === 1}
                      onClick={() => setNewCols(newCols.filter((_, j) => j !== i))}
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="btn sm"
                  disabled={newCols.length >= MAX_COLUMNS}
                  onClick={() => {
                    setNewCols([...newCols, { name: '', type: 'text' }]);
                    setFocusCol(newCols.length);
                  }}
                >
                  <Icon name="plus" size={14} />
                  {t('db.addCol')}
                </button>
                <span className="hint">{t('db.colHint')}</span>
              </fieldset>
              <div className="form-actions">
                <button type="submit" className="btn primary" disabled={blocked || !newName.trim() || !newCols.some((c) => c.name.trim())}>
                  {busy === 'create' ? t('db.creating') : t('db.create')}
                </button>
                {tables && tables.length > 0 && (
                  <button type="button" className="btn" onClick={() => setMode('rows')}>
                    {t('common.cancel')}
                  </button>
                )}
              </div>
            </form>
          )}

          {mode === 'rows' && rows && selected && (
            <>
              <div className="row between">
                <div>
                  <h2>
                    <code>{rows.table}</code>
                  </h2>
                  <p className="sub">{t(rows.rows.length === 1 ? 'db.rowsSub.1' : 'db.rowsSub', { n: rows.rows.length })}</p>
                </div>
                <button type="button" className="btn sm" disabled={blocked} onClick={() => void loadRows(selected)}>
                  <Icon name="refresh" size={14} />
                  {t('db.reload')}
                </button>
              </div>
              <div className="scroll-x" tabIndex={0} role="region" aria-label={t('db.gridAria', { table: rows.table })}>
                <table className="kv data-grid">
                  <thead>
                    <tr>
                      {rows.columns.map((c) => (
                        <th key={c.name} scope="col" className={kindOf(c.type) === 'int' ? 'num' : undefined}>
                          {c.name}
                          <span className="col-type"> {c.type}</span>
                        </th>
                      ))}
                      <th scope="col">
                        <span className="sr-only">{t('db.actions')}</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="new-row" onKeyDown={onRowKey}>
                      {rows.columns.map((c, i) => {
                        if (c.name === 'id') {
                          return (
                            <td key={c.name} className="muted">
                              {t('db.newRow')}
                            </td>
                          );
                        }
                        const kind = kindOf(c.type);
                        const common = {
                          id: `db-new-${i - 1}`,
                          'aria-label': t('db.cellAria', { col: c.name }),
                          value: newRow[c.name] ?? '',
                        };
                        return (
                          <td key={c.name}>
                            {kind === 'bool' ? (
                              <select {...common} onChange={(e) => setNewRow({ ...newRow, [c.name]: e.target.value })}>
                                <option value="">{t('db.blank')}</option>
                                <option value="true">true</option>
                                <option value="false">false</option>
                              </select>
                            ) : (
                              <input
                                {...common}
                                type={kind === 'time' ? 'datetime-local' : 'text'}
                                inputMode={kind === 'int' ? 'numeric' : undefined}
                                autoComplete="off"
                                spellCheck={false}
                                onChange={(e) => setNewRow({ ...newRow, [c.name]: e.target.value })}
                              />
                            )}
                          </td>
                        );
                      })}
                      <td>
                        <button type="button" className="btn sm primary" disabled={blocked || !hasNewValues || editable.length === 0} onClick={() => void saveRow()}>
                          {busy === 'save' ? t('db.saving') : t('db.save')}
                        </button>
                      </td>
                    </tr>
                    {rows.rows.map((r, i) => (
                      <tr key={cell(r.id) || i}>
                        {rows.columns.map((c) => (
                          <td key={c.name} className={kindOf(c.type) === 'int' ? 'num' : undefined}>
                            {cell(r[c.name]) || <span className="muted">—</span>}
                          </td>
                        ))}
                        <td />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.rows.length === 0 && <p className="muted empty">{t('db.emptyTable')}</p>}
            </>
          )}

          {mode === 'rows' && !rows && (
            connected ? (
              <div className="empty-frame">
                <p>{t('db.pick')}</p>
              </div>
            ) : (
              <div className="stack guide">
                <div>
                  <h2>{t('db.guideTitle')}</h2>
                  <p className="sub">{t('db.guideSub')}</p>
                </div>
                <ol>
                  <li>
                    <Rich text={t('db.step1')} />
                  </li>
                  <li>
                    <Rich text={t('db.step2')} />
                  </li>
                  <li>
                    <Rich text={t('db.step3')} />
                  </li>
                </ol>
                <p className="hint">
                  <Rich text={t('db.guideNote')} />
                </p>
              </div>
            )
          )}
        </section>
      </div>
    </div>
  );
}
