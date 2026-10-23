import type { CallResult } from './api';

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

// Pesan untuk kode error umum dari driver (server hanya mengirim kodenya, bukan pesan mentah).
export const HINTS: Record<string, string> = {
  ECONNREFUSED: 'Server menolak koneksi. Periksa host dan port.',
  ENOTFOUND: 'Host tidak ditemukan. Periksa penulisan host.',
  EAI_AGAIN: 'Host tidak ditemukan (DNS gagal). Periksa host dan koneksi internet server.',
  ETIMEDOUT: 'Waktu habis. Periksa firewall atau daftar IP yang diizinkan di penyedia database.',
  ECONNRESET: 'Koneksi diputus server. Periksa pengaturan SSL/akses database.',
  '28P01': 'User atau password salah.',
  '28000': 'User atau password salah.',
  ER_ACCESS_DENIED_ERROR: 'User atau password salah.',
  '3D000': 'Nama database tidak ditemukan.',
  ER_BAD_DB_ERROR: 'Nama database tidak ditemukan.',
  '42P07': 'Tabel sudah ada.',
  ER_TABLE_EXISTS_ERROR: 'Tabel sudah ada.',
  '42501': 'User tidak punya izin untuk aksi ini.',
  ER_DBACCESS_DENIED_ERROR: 'User tidak punya izin untuk aksi ini.',
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
export function summarize(label: string, res: CallResult, opts: SummaryOptions = {}): Outcome {
  const body = parseJson<Record<string, unknown>>(res) ?? {};
  const err = typeof body.error === 'string' ? body.error : '';
  const make = (tone: Outcome['tone'], text: string): Outcome => ({ tone, text, label, res });
  const token = opts.token ?? 'Token';

  if (res.status === 0) return make('err', 'Tidak bisa menghubungi server aplikasi.');
  if (res.status === 401) return make('err', `${token} salah.`);
  if (res.status === 403) return make('err', `Fitur nonaktif atau ${token} belum di-set di server.`);
  if (res.status === 409) return make('err', 'Pod ini bukan target. Ulangi sampai kena pod yang dituju.');
  if (res.status === 412) {
    const missing = Array.isArray(body.missing) ? (body.missing as string[]).join(', ') : '';
    return make('err', `Koneksi belum lengkap${missing ? `: isi ${missing}` : ''}.`);
  }
  if (res.status === 413) return make('err', 'Data terlalu besar.');
  if (res.status >= 400 && res.status < 500) return make('err', err || 'Permintaan tidak valid.');
  if (res.status >= 500) return make('err', HINTS[err] ?? `Gagal (${err || res.status}).`);

  if (body.connected === true) {
    return make('ok', `Terhubung ke ${body.dialect === 'mysql' ? 'MySQL' : 'PostgreSQL'} ${cell(body.version)} dalam ${cell(body.ms)} ms.`);
  }
  if (typeof body.created === 'string') return make('ok', `Tabel ${body.created} siap dipakai.`);
  if (body.inserted === 1) return make('ok', `1 baris ditambahkan ke ${cell(body.table)}.`);
  if (Array.isArray(body.tables)) return make('ok', `${body.tables.length} tabel playground ditemukan.`);
  if (Array.isArray(body.rows)) return make('ok', `${body.rows.length} baris ditampilkan.`);
  return make('ok', opts.ok ?? 'Berhasil.');
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
