'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useI18n } from '../../i18n/client';
import type { Lang } from '../../i18n/core';
import Rich from '../Rich';
import { Icon } from '../shell/Icons';
import { call, toCurl, urlFor, type CallResult } from './api';
import { DEPLOY_SCENARIOS, ENDPOINTS, SCENARIO_GROUP, type Endpoint } from './catalog-data';
import { hasPlaceholder } from './outcome';
import { CopyButton, ResponseView } from './ui';

// Browser menolak/mengabaikan header ini di fetch; untuk tes yang sebenarnya pakai curl.
const BROWSER_BLOCKED = ['origin', 'accept-encoding', 'access-control-request-method', 'access-control-request-headers', 'cookie', 'host'];

const envText = (env: string) => env.replace(/\s*\(.*\)\s*$/, '').split(/\s{2,}/).join('\n');

function EndpointRow({ e, lang }: Readonly<{ e: Endpoint; lang: Lang }>) {
  const { t } = useI18n();
  const [vals, setVals] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(e.headers ?? {}).map(([k, v]) => [k, hasPlaceholder(v) ? '' : v])),
  );
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<CallResult | null>(null);
  const abort = useRef<AbortController | null>(null);

  const headerNames = Object.keys(e.headers ?? {});
  const missing = headerNames.filter((k) => hasPlaceholder(e.headers?.[k] ?? '') && !vals[k]?.trim());
  const blocked = headerNames.filter((k) => BROWSER_BLOCKED.includes(k.toLowerCase()));
  const effective = () => Object.fromEntries(Object.entries(vals).filter(([, v]) => v.trim() !== ''));
  const title = e.title[lang];
  const whyId = `why-${e.method}-${e.path}`;

  const run = async () => {
    abort.current = new AbortController();
    setBusy(true);
    setRes(null);
    setRes(await call(e.method, e.path, { headers: effective(), signal: abort.current.signal }));
    setBusy(false);
  };

  const curl = () => toCurl(e.method, e.path, effective(), '');
  const whyDisabled = missing.length > 0 ? t('cat.fill', { names: missing.join(', ') }) : '';

  return (
    <li className="item">
      <div className="item-main">
        <h3>{title}</h3>
        <p>{e.simulates[lang]}</p>
        <p className="verify-line">
          <b>{t('cat.verify')}</b> {e.verify[lang]}
        </p>
        {headerNames.length > 0 && (
          <details className="item-headers" open={missing.length > 0}>
            <summary>{t('cat.headers', { n: headerNames.length })}</summary>
            <div className="stack" style={{ gap: 8 }}>
              {headerNames.map((k) => (
                <label key={k}>
                  <span className="mono">{k}</span>
                  <input
                    value={vals[k] ?? ''}
                    placeholder={hasPlaceholder(e.headers?.[k] ?? '') ? (e.headers?.[k] ?? '') : ''}
                    onChange={(ev) => setVals({ ...vals, [k]: ev.target.value })}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </label>
              ))}
              {blocked.length > 0 && (
                <p className="hint">
                  <Rich text={t('cat.blocked', { names: blocked.join(', ') })} />
                </p>
              )}
            </div>
          </details>
        )}
      </div>
      <div className="item-side">
        <code className="req">
          {e.method} {e.path}
        </code>
        <div className="row">
          {busy ? (
            <button type="button" className="btn sm" onClick={() => abort.current?.abort()}>
              {t('common.cancel')}
            </button>
          ) : (
            <button type="button" className="btn sm" onClick={() => void run()} disabled={missing.length > 0} aria-describedby={whyDisabled ? whyId : undefined}>
              <Icon name="play" size={14} />
              {t('cat.run')}
            </button>
          )}
          <CopyButton label={t('cat.copyCurl')} text={curl} />
          {e.method === 'GET' && (
            <a className="btn sm" href={urlFor(e.path)} target="_blank" rel="noreferrer">
              {t('cat.open')}
            </a>
          )}
        </div>
        {whyDisabled && (
          <span className="hint" id={whyId}>
            {whyDisabled}
          </span>
        )}
        {busy && <span className="hint">{t('cat.running')}</span>}
      </div>
      {res && (
        <div className="item-result">
          <ResponseView res={res} method={e.method} path={e.path} />
        </div>
      )}
    </li>
  );
}

const matches = (q: string, ...parts: string[]) => parts.some((p) => p.toLowerCase().includes(q));

export default function Catalog() {
  const { t, lang } = useI18n();
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState<string | null>(null);
  const search = useRef<HTMLInputElement>(null);
  const q = query.trim().toLowerCase();

  // Tekan "/" untuk langsung mencari (hanya bila tampilan ini sedang terlihat).
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const target = ev.target as HTMLElement | null;
      const typing = target !== null && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT');
      const el = search.current;
      if (ev.key === '/' && !typing && el && el.offsetParent !== null) {
        ev.preventDefault();
        el.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const SCENARIOS = 'scenarios';
  const scenarios = useMemo(
    () => (group === null || group === SCENARIOS ? DEPLOY_SCENARIOS.filter((s) => !q || matches(q, s.title[lang], s.env, s.expect[lang])) : []),
    [q, group, lang],
  );
  const groups = useMemo(
    () =>
      ENDPOINTS.filter((g) => group === null || group === g.id)
        .map((g) => ({ ...g, items: g.items.filter((e) => !q || matches(q, e.title[lang], e.path, e.simulates[lang], e.verify[lang])) }))
        .filter((g) => g.items.length > 0),
    [q, group, lang],
  );
  const total = scenarios.length + groups.reduce((n, g) => n + g.items.length, 0);
  const chips = [{ id: SCENARIOS, name: SCENARIO_GROUP[lang] }, ...ENDPOINTS.map((g) => ({ id: g.id, name: g.name[lang] }))];

  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="filter-bar">
        <label className="field-grow">
          {t('cat.search')}
          <input ref={search} type="search" value={query} onChange={(ev) => setQuery(ev.target.value)} placeholder={t('cat.ph')} autoComplete="off" spellCheck={false} />
        </label>
        <span className="muted" aria-live="polite">
          {q || group ? t(total === 1 ? 'cat.results.1' : 'cat.results', { n: total }) : ''}
        </span>
      </div>
      <div className="chips" role="group" aria-label={t('cat.filterAria')}>
        <button type="button" className="chip" aria-pressed={group === null} onClick={() => setGroup(null)}>
          {t('cat.all')}
        </button>
        {chips.map((c) => (
          <button key={c.id} type="button" className="chip" aria-pressed={group === c.id} onClick={() => setGroup(group === c.id ? null : c.id)}>
            {c.name}
          </button>
        ))}
      </div>

      {total === 0 && <p className="empty-frame">{t('cat.empty', { q: query })}</p>}

      {scenarios.length > 0 && (
        <section>
          <h2 className="section-title">{SCENARIO_GROUP[lang]}</h2>
          <p className="muted" style={{ marginBottom: 10 }}>
            {t('cat.scenarioSub')}
          </p>
          <div className="scroll-x" tabIndex={0} role="region" aria-label={t('cat.tableAria')}>
            <table className="kv stack-sm">
              <thead>
                <tr>
                  <th scope="col">{t('cat.col.scenario')}</th>
                  <th scope="col">{t('cat.col.env')}</th>
                  <th scope="col">{t('cat.col.expect')}</th>
                  <th scope="col">
                    <span className="sr-only">{t('cat.col.action')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map((s) => (
                  <tr key={s.env}>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{s.title[lang]}</td>
                    <td>
                      <code>{s.env}</code>
                    </td>
                    <td>{s.expect[lang]}</td>
                    <td>
                      <CopyButton label={t('cat.copyEnv')} text={envText(s.env)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {groups.map((g) => (
        <section key={g.id}>
          <h2 className="section-title">{g.name[lang]}</h2>
          <ul className="items">
            {g.items.map((e) => (
              <EndpointRow key={`${e.method} ${e.path} ${e.title.en}`} e={e} lang={lang} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
