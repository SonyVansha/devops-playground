'use client';

import { useState } from 'react';
import { statusClass } from './api';

export function StatusBadge({ status }: Readonly<{ status: number }>) {
  return <span className={`badge ${statusClass(status)}`}>{status === 0 ? 'ERR' : status}</span>;
}

export function CopyButton({ text, label = 'Copy' }: Readonly<{ text: string | (() => string); label?: string }>) {
  const [done, setDone] = useState(false);
  const onClick = async () => {
    try {
      await navigator.clipboard.writeText(typeof text === 'function' ? text() : text);
      setDone(true);
      setTimeout(() => setDone(false), 1500);
    } catch {
      setDone(false);
    }
  };
  return (
    <button type="button" className="btn sm" onClick={onClick}>
      {done ? 'Tersalin' : label}
    </button>
  );
}
