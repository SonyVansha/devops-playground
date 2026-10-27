import { catalog } from './en/catalog.ts';
import { chaos } from './en/chaos.ts';
import { dashboard } from './en/dashboard.ts';
import { database } from './en/database.ts';
import { docs } from './en/docs.ts';
import { result } from './en/result.ts';
import { shell } from './en/shell.ts';

// Kamus Inggris (bahasa bawaan). Kunci menjadi tipe MsgKey; kamus Indonesia wajib punya kunci yang sama.
export const en = { ...shell, ...dashboard, ...result, ...chaos, ...catalog, ...database, ...docs } as const;
export type MsgKey = keyof typeof en;
