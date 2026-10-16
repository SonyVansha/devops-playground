import type { Block } from './types.ts';

export interface Heading {
  id: string;
  text: string;
}

export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'bagian';
}

// Daftar heading (h2) dengan id unik; dipakai bersama oleh renderer (anchor) dan daftar isi.
export function headingsOf(blocks: Block[]): Heading[] {
  const seen = new Map<string, number>();
  const out: Heading[] = [];
  for (const block of blocks) {
    if (block.t !== 'h') continue;
    const base = slugify(block.text);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    out.push({ id: n === 1 ? base : `${base}-${n}`, text: block.text });
  }
  return out;
}
