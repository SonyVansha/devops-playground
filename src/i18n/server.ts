import { cookies } from 'next/headers';
import { LANG_COOKIE, parseLang, type Lang } from './core.ts';

// Bahasa untuk request ini: cookie "lang" (diatur tombol bahasa), bawaan Inggris.
export async function getLang(): Promise<Lang> {
  return parseLang((await cookies()).get(LANG_COOKIE)?.value);
}
