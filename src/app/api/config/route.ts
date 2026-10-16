import { createHash } from 'node:crypto';
import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { wrap } from '../../../lib/handler.ts';
import { json } from '../../../lib/util.ts';

export const dynamic = 'force-dynamic';

interface FileInfo {
  name: string;
  bytes: number;
  sha256: string;
}

async function describe(dir: string, name: string): Promise<FileInfo | null> {
  const path = join(/* turbopackIgnore: true */ dir, name);
  const info = await stat(path);
  if (!info.isFile()) return null;
  const hash = createHash('sha256').update(await readFile(path)).digest('hex');
  return { name, bytes: info.size, sha256: hash.slice(0, 12) };
}

// Verifikasi ConfigMap/Secret ter-mount: tampilkan nama file, ukuran, dan checksum (BUKAN isinya).
// Berguna untuk memastikan rollout konfigurasi baru sudah sampai ke pod.
export const GET = wrap('config', async () => {
  const dir = process.env.CONFIG_DIR ?? '/etc/playground';
  let names: string[] = [];
  try {
    names = (await readdir(/* turbopackIgnore: true */ dir)).filter((n) => !n.startsWith('..')).sort();
  } catch {
    return json({ dir, mounted: false, files: [] });
  }
  const files = (await Promise.all(names.map((n) => describe(dir, n)))).filter((f): f is FileInfo => f !== null);
  return json({ dir, mounted: true, files });
});
