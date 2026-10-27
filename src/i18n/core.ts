import type { MsgKey } from './en.ts';

// Inti terjemahan tanpa kamus: aman diimpor dari komponen klien tanpa ikut membawa kedua bahasa.
export type Lang = 'en' | 'id';
export const LANGS: readonly Lang[] = ['en', 'id'];
export const DEFAULT_LANG: Lang = 'en';
export const LANG_COOKIE = 'lang';

export type Vars = Record<string, string | number>;
export type Translate = (key: MsgKey, vars?: Vars) => string;

// Selain "id", semuanya Inggris (bahasa bawaan).
export function parseLang(value: string | null | undefined): Lang {
  return value === 'id' ? 'id' : DEFAULT_LANG;
}

// "{nama}" diganti dengan nilai dari vars; placeholder tanpa nilai dibiarkan apa adanya.
export function format(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match));
}

export function makeT(messages: Readonly<Record<string, string>>): Translate {
  return (key, vars) => format(messages[key] ?? key, vars);
}

export function localeOf(lang: Lang): string {
  return lang === 'id' ? 'id-ID' : 'en-GB';
}
