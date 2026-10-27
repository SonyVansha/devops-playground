import type { Translate } from '../../i18n/core.ts';
import type { InfoData } from './api.ts';

export interface Status {
  tone: 'ok' | 'warn' | 'err' | 'pending';
  headline: string;
  detail: string;
}

export function clock(ms: number | null, locale = 'en-GB'): string {
  return ms === null ? '' : new Date(ms).toLocaleTimeString(locale, { hour12: false });
}

// Pernyataan satu kalimat tentang pod ini sekarang: yang paling perlu dibaca lebih dulu.
export function describe(info: InfoData | null, reachable: boolean, lastOkAt: number | null, t: Translate, locale = 'en-GB'): Status {
  if (!info) return { tone: 'pending', headline: t(reachable ? 'st.loading' : 'st.connecting'), detail: '' };
  if (!reachable) {
    return {
      tone: 'err',
      headline: t('st.unreachable'),
      detail: lastOkAt ? t('st.unreachable.last', { time: clock(lastOkAt, locale) }) : t('st.unreachable.none'),
    };
  }
  if (info.draining) return { tone: 'warn', headline: t('st.draining'), detail: t('st.draining.d') };
  if (!info.started) return { tone: 'warn', headline: t('st.starting'), detail: t('st.starting.d') };
  if (!info.healthy) return { tone: 'err', headline: t('st.unhealthy'), detail: t('st.unhealthy.d') };
  if (!info.ready) return { tone: 'err', headline: t('st.notReady'), detail: t('st.notReady.d') };
  return { tone: 'ok', headline: t('st.ok'), detail: '' };
}
