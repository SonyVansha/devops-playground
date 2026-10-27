import type { shell as en } from '../en/shell.ts';

export const shell: Record<keyof typeof en, string> = {
  'meta.title': 'DevOps Playground',
  'meta.description': 'Workload dummy untuk menguji Kubernetes, ingress, API gateway, dan rollout',
  'meta.docs.title': 'Dokumentasi | DevOps Playground',
  'meta.docs.description': 'Panduan memakai dan memeriksa workload dummy untuk skenario Kubernetes, gateway, dan rollout',
  'shell.skip': 'Lewati ke konten',
  'shell.openMenu': 'Buka menu',
  'shell.closeMenu': 'Tutup menu',
  'shell.mainNav': 'Navigasi utama',
  'shell.brandAria': 'DevOps Playground, ke dashboard',
  'theme.label': 'Tema gelap',
  'theme.toLight': 'Pakai tema terang',
  'theme.toDark': 'Pakai tema gelap',
  'lang.label': 'Bahasa',
  'lang.en': 'English',
  'lang.id': 'Bahasa Indonesia',
  'common.copy': 'Salin',
  'common.copied': 'Tersalin',
  'common.cancel': 'Batal',
};
