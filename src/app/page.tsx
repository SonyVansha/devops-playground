import Dashboard from '../components/dashboard/Dashboard';
import { I18nExtra } from '../i18n/client';
import { HOME_DOMAINS, messagesFor } from '../i18n/index';
import { getLang } from '../i18n/server';
import { infoPayload } from '../lib/info.ts';

export const dynamic = 'force-dynamic';

// Data awal diambil di server (sama dengan /api/info): cetakan pertama langsung menampilkan keadaan sebenarnya,
// tanpa tahap "memuat" yang berganti teks, dan browser tidak perlu request pertama.
export default async function Home() {
  const lang = await getLang();
  return (
    <I18nExtra messages={messagesFor(lang, HOME_DOMAINS)}>
      <Dashboard initialInfo={await infoPayload()} />
    </I18nExtra>
  );
}
