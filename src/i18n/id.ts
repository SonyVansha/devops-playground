import type { MsgKey } from './en.ts';
import { catalog } from './id/catalog.ts';
import { chaos } from './id/chaos.ts';
import { dashboard } from './id/dashboard.ts';
import { database } from './id/database.ts';
import { docs } from './id/docs.ts';
import { result } from './id/result.ts';
import { shell } from './id/shell.ts';

export const id: Record<MsgKey, string> = { ...shell, ...dashboard, ...result, ...chaos, ...catalog, ...database, ...docs };
