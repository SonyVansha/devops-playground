'use client';

import { useCallback, useEffect, useState } from 'react';
import { call } from './api';

interface PollState<T> {
  data: T | null;
  status: number;
  updatedAt: number | null;
}

export function usePoll<T>(path: string, intervalMs: number, active: boolean) {
  const [state, setState] = useState<PollState<T>>({ data: null, status: 0, updatedAt: null });

  const refresh = useCallback(async () => {
    const res = await call('GET', path);
    let data: T | null = null;
    try {
      data = JSON.parse(res.body) as T;
    } catch {
      data = null;
    }
    setState({ data, status: res.status, updatedAt: Date.now() });
  }, [path]);

  useEffect(() => {
    if (!active) return undefined;
    void refresh();
    const id = setInterval(() => void refresh(), intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs, refresh]);

  return { ...state, refresh };
}
