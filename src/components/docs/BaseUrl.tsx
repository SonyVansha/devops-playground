'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

const DEFAULT_BASE = 'http://localhost:3000';
const STORAGE_KEY = 'docs.baseUrl';

interface BaseUrlValue {
  base: string;
  setBase: (value: string) => void;
  reset: () => void;
}

const BaseUrlContext = createContext<BaseUrlValue>({ base: DEFAULT_BASE, setBase: () => undefined, reset: () => undefined });

export function useBaseUrl(): BaseUrlValue {
  return useContext(BaseUrlContext);
}

function originGuess(): string {
  return window.location.origin + (process.env.NEXT_PUBLIC_BASE_PATH ?? '');
}

// Base URL dipakai mengisi {{BASE}} di semua contoh perintah. Disimpan di localStorage (bila tersedia).
export function BaseUrlProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [base, setBaseState] = useState(DEFAULT_BASE);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      saved = null;
    }
    setBaseState(saved || originGuess());
  }, []);

  const setBase = useCallback((value: string) => {
    setBaseState(value);
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      // penyimpanan diblokir: nilai tetap berlaku untuk sesi ini
    }
  }, []);

  const reset = useCallback(() => {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // diabaikan
    }
    setBaseState(originGuess());
  }, []);

  const value = useMemo(() => ({ base, setBase, reset }), [base, setBase, reset]);
  return <BaseUrlContext.Provider value={value}>{children}</BaseUrlContext.Provider>;
}

export function BaseUrlBar() {
  const { base, setBase, reset } = useBaseUrl();
  return (
    <div className="baseurl">
      <label>
        <span>Base URL</span>
        <input value={base} onChange={(e) => setBase(e.target.value.trim())} spellCheck={false} aria-describedby="baseurl-help" />
      </label>
      <button type="button" className="btn sm" onClick={reset}>
        Reset
      </button>
      <p id="baseurl-help" className="hint">
        Dipakai di semua contoh perintah di halaman ini.
      </p>
    </div>
  );
}
