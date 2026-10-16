// Konten docs ditulis sebagai data bertipe (bukan MDX/HTML) -> tanpa dependency baru dan tanpa dangerouslySetInnerHTML.
// Teks mendukung `kode` dan **tebal**. Di dalam blok kode, {{BASE}} diganti dengan Base URL yang dipilih pembaca.
export type Block =
  | { t: 'h'; text: string }
  | { t: 'p'; text: string }
  | { t: 'ul'; items: string[] }
  | { t: 'ol'; items: string[] }
  | { t: 'code'; code: string; title?: string }
  | { t: 'table'; head: string[]; rows: string[][] }
  | { t: 'note'; kind: 'info' | 'warn' | 'ok'; text: string }
  | { t: 'check'; title: string; command: string; expect: string };

export interface DocGroup {
  name: string;
  docs: Doc[];
}

export interface Doc {
  slug: string;
  title: string;
  summary: string;
  blocks: Block[];
}
