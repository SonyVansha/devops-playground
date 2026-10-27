import type { Translate } from '../../i18n/core.ts';
import type { MsgKey } from '../../i18n/en.ts';
import type { CallResult } from './api.ts';

export interface Outcome {
  tone: 'ok' | 'err';
  text: string;
  label: string;
  res: CallResult;
}

export interface SummaryOptions {
  /** Nama token yang ditampilkan di pesan 401, mis. "DB token". */
  token?: string;
  /** Teks saat sukses tanpa pesan khusus. */
  ok?: string;
}

// Kode error umum dari driver -> kunci pesan (server hanya mengirim kodenya, bukan pesan mentah).
export const HINT_KEYS: Readonly<Record<string, MsgKey>> = {
  ECONNREFUSED: 'hint.refused',
  ENOTFOUND: 'hint.noHost',
  EAI_AGAIN: 'hint.dns',
  ETIMEDOUT: 'hint.timeout',
  ECONNRESET: 'hint.reset',
  '28P01': 'hint.badLogin',
  '28000': 'hint.badLogin',
  ER_ACCESS_DENIED_ERROR: 'hint.badLogin',
  '3D000': 'hint.noDb',
  ER_BAD_DB_ERROR: 'hint.noDb',
  '42P07': 'hint.tableExists',
  ER_TABLE_EXISTS_ERROR: 'hint.tableExists',
  '42501': 'hint.noPermission',
  ER_DBACCESS_DENIED_ERROR: 'hint.noPermission',
};

export function parseJson<T>(res: CallResult): T | null {
  try {
    return JSON.parse(res.body) as T;
  } catch {
    return null;
  }
}

export function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  return typeof value === 'object' ? JSON.stringify(value) : String(value);
}

// Ringkasan hasil dalam bahasa manusia; respons mentah tetap tersedia di komponen yang menampilkannya.
export function summarize(label: string, res: CallResult, t: Translate, opts: SummaryOptions = {}): Outcome {
  const body = parseJson<Record<string, unknown>>(res) ?? {};
  const err = typeof body.error === 'string' ? body.error : '';
  const make = (tone: Outcome['tone'], text: string): Outcome => ({ tone, text, label, res });
  const token = opts.token ?? 'Token';

  if (res.status === 0) return make('err', t('res.noServer'));
  if (res.status === 401) return make('err', t('res.tokenBad', { token }));
  if (res.status === 403) return make('err', t('res.forbidden', { token }));
  if (res.status === 409) return make('err', t('res.conflict'));
  if (res.status === 412) {
    const missing = Array.isArray(body.missing) ? (body.missing as string[]).join(', ') : '';
    return make('err', missing ? t('res.incomplete.fill', { fields: missing }) : t('res.incomplete'));
  }
  if (res.status === 413) return make('err', t('res.tooLarge'));
  if (res.status >= 400 && res.status < 500) return make('err', err || t('res.badRequest'));
  if (res.status >= 500) return make('err', HINT_KEYS[err] ? t(HINT_KEYS[err]) : t('res.failed', { code: err || res.status }));

  if (body.connected === true) {
    return make('ok', t('res.connected', { db: body.dialect === 'mysql' ? 'MySQL' : 'PostgreSQL', version: cell(body.version), ms: cell(body.ms) }));
  }
  if (typeof body.created === 'string') return make('ok', t('res.tableReady', { name: body.created }));
  if (body.inserted === 1) return make('ok', t('res.inserted', { table: cell(body.table) }));
  if (Array.isArray(body.tables)) return make('ok', t(body.tables.length === 1 ? 'res.tables.1' : 'res.tables', { n: body.tables.length }));
  if (Array.isArray(body.rows)) return make('ok', t(body.rows.length === 1 ? 'res.rows.1' : 'res.rows', { n: body.rows.length }));
  return make('ok', opts.ok ?? t('res.done'));
}

// Ukuran body yang ramah dibaca: 812 B, 3.4 KB, 1.2 MB.
export function fmtBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// Potong body panjang agar halaman tetap ringan; sisanya bisa ditampilkan atas permintaan.
export function clip(text: string, max = 4096): { text: string; clipped: boolean } {
  return text.length > max ? { text: text.slice(0, max), clipped: true } : { text, clipped: false };
}

// Nilai placeholder seperti "<jwt>" atau "Bearer <token>" yang harus diisi pengguna sebelum request dijalankan.
export function hasPlaceholder(value: string): boolean {
  return /<[^<>]+>/.test(value);
}

const REASONS: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  413: 'Payload Too Large',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
};

// "200 OK", "503 Service Unavailable" (nama status HTTP baku, sama di semua bahasa); status 0 = request tidak sampai ke server.
export function statusLine(status: number, t: Translate): string {
  if (status === 0) return t('res.noResponse');
  return REASONS[status] ? `${status} ${REASONS[status]}` : String(status);
}

// Seluruh respons sebagai teks (untuk tombol salin): perintah, status, header, lalu body.
export function transcript(res: CallResult, t: Translate, method?: string, path?: string): string {
  const lines: string[] = [];
  if (method && path) lines.push(`$ ${method} ${path}`);
  lines.push(statusLine(res.status, t));
  for (const [k, v] of res.headers) lines.push(`${k}: ${v}`);
  if (res.body) lines.push('', res.body);
  return lines.join('\n');
}

// Body JSON ditampilkan rapi (seperti "curl | jq"); selain JSON object/array dibiarkan apa adanya.
export function prettyBody(body: string): string {
  const trimmed = body.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return body;
  try {
    return JSON.stringify(JSON.parse(trimmed), null, 2);
  } catch {
    return body;
  }
}
