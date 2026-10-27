import { makeT, type Lang, type Translate } from './core.ts';
import { catalog as enCatalog } from './en/catalog.ts';
import { chaos as enChaos } from './en/chaos.ts';
import { dashboard as enDashboard } from './en/dashboard.ts';
import { database as enDatabase } from './en/database.ts';
import { docs as enDocs } from './en/docs.ts';
import { result as enResult } from './en/result.ts';
import { shell as enShell } from './en/shell.ts';
import { en } from './en.ts';
import { catalog as idCatalog } from './id/catalog.ts';
import { chaos as idChaos } from './id/chaos.ts';
import { dashboard as idDashboard } from './id/dashboard.ts';
import { database as idDatabase } from './id/database.ts';
import { docs as idDocs } from './id/docs.ts';
import { result as idResult } from './id/result.ts';
import { shell as idShell } from './id/shell.ts';
import { id } from './id.ts';

// Sisi server dan test: satu-satunya tempat yang mengimpor kamus.
export * from './core.ts';

export type Domain = 'shell' | 'dashboard' | 'result' | 'chaos' | 'catalog' | 'database' | 'docs';

const DOMAINS: Record<Lang, Record<Domain, Readonly<Record<string, string>>>> = {
  en: { shell: enShell, dashboard: enDashboard, result: enResult, chaos: enChaos, catalog: enCatalog, database: enDatabase, docs: enDocs },
  id: { shell: idShell, dashboard: idDashboard, result: idResult, chaos: idChaos, catalog: idCatalog, database: idDatabase, docs: idDocs },
};

// Bagian rute yang dikirim ke browser. Kerangka (shell) selalu ada; sisanya hanya yang dipakai rute itu.
export const HOME_DOMAINS: readonly Domain[] = ['dashboard', 'result', 'chaos', 'catalog', 'database'];
export const DOCS_DOMAINS: readonly Domain[] = ['docs'];

export function messagesFor(lang: Lang, domains: readonly Domain[]): Readonly<Record<string, string>> {
  return Object.assign({}, DOMAINS[lang].shell, ...domains.map((d) => DOMAINS[lang][d]));
}

// Seluruh kamus satu bahasa (test, dan terjemahan di sisi server).
export function dictionary(lang: Lang): Readonly<Record<string, string>> {
  return lang === 'id' ? id : en;
}

export function translator(lang: Lang): Translate {
  return makeT(dictionary(lang));
}
