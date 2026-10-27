'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { call } from './api';

interface PollState<T> {
  data: T | null;
  status: number;
  updatedAt: number | null;
  lastOkAt: number | null;
}

/** Keadaan awal yang sudah diketahui (mis. dirender server), supaya tidak ada tahap "memuat" dan request pertama bisa dilewati. */
export interface PollInitial<T> {
  data: T | null;
  status?: number;
  at: number;
}

export function usePoll<T>(path: string, intervalMs: number, active: boolean, initial?: PollInitial<T>) {
  const [state, setState] = useState<PollState<T>>(() =>
    initial
      ? { data: initial.data, status: initial.status ?? 200, updatedAt: initial.at, lastOkAt: (initial.status ?? 200) === 200 ? initial.at : null }
      : { data: null, status: 0, updatedAt: null, lastOkAt: null },
  );
  const skipFirst = useRef(Boolean(initial));

  const refresh = useCallback(async () => {
    const res = await call('GET', path);
    let data: T | null = null;
    try {
      data = JSON.parse(res.body) as T;
    } catch {
      data = null;
    }
    const now = Date.now();
    // Refresh yang gagal tidak menghapus data terakhir: nilai lama tetap tampil bersama stempel waktunya.
    setState((prev) => ({
      data: data ?? prev.data,
      status: res.status,
      updatedAt: now,
      lastOkAt: res.status === 200 ? now : prev.lastOkAt,
    }));
  }, [path]);

  useEffect(() => {
    if (!active) return undefined;
    // Dengan data awal, pembacaan pertama sudah ada: cukup mulai interval.
    if (skipFirst.current) skipFirst.current = false;
    else void refresh();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [active, intervalMs, refresh]);

  return { ...state, refresh };
}

// Mengingat isian NON-RAHASIA di browser (localStorage). Token dan password tidak boleh masuk ke sini.
// Dibaca setelah mount agar hasil render server dan klien sama; tetap berfungsi bila storage diblokir.
export function useRemembered<T extends Record<string, string>>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        const next = { ...initial };
        for (const k of Object.keys(initial)) {
          if (typeof parsed[k] === 'string') (next as Record<string, string>)[k] = parsed[k] as string;
        }
        setValue(next);
      }
    } catch {
      // storage diblokir atau isinya rusak: pakai nilai awal
    }
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- nilai awal hanya dipakai sekali
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // abaikan
    }
  }, [key, value, ready]);

  return [value, setValue] as const;
}
