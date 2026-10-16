import { headingsOf } from '../../docs/headings';
import type { Block } from '../../docs/types';
import CodeBlock, { InlineCode } from './CodeBlock';

// Parser inline sederhana: `kode` dan **tebal**. Selalu dirender sebagai node React (tidak ada HTML mentah).
function Inline({ text }: Readonly<{ text: string }>) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('`')) return <InlineCode key={i} text={part.slice(1, -1)} />;
        if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

const CALLOUT_LABEL = { info: 'Catatan', warn: 'Perhatian', ok: 'Tips' } as const;

function BlockView({ block, headingId }: Readonly<{ block: Block; headingId?: string }>) {
  switch (block.t) {
    case 'h':
      return (
        <h2 className="doc-h" id={headingId}>
          {block.text}
          <a className="anchor" href={`#${headingId}`} aria-label={`Tautan ke bagian ${block.text}`}>
            #
          </a>
        </h2>
      );
    case 'p':
      return (
        <p>
          <Inline text={block.text} />
        </p>
      );
    case 'ul':
      return (
        <ul>
          {block.items.map((item) => (
            <li key={item}>
              <Inline text={item} />
            </li>
          ))}
        </ul>
      );
    case 'ol':
      return (
        <ol>
          {block.items.map((item) => (
            <li key={item}>
              <Inline text={item} />
            </li>
          ))}
        </ol>
      );
    case 'code':
      return <CodeBlock code={block.code} title={block.title} />;
    case 'table':
      return (
        <div className="table-wrap">
          <table className="kv doc-table">
            <thead>
              <tr>
                {block.head.map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row.join('|')}>
                  {row.map((cell, i) => (
                    <td key={`${i}-${cell}`}>
                      <Inline text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case 'note':
      return (
        <aside className={`callout ${block.kind}`} role="note">
          <span className="callout-label">{CALLOUT_LABEL[block.kind]}</span>
          <Inline text={block.text} />
        </aside>
      );
    case 'check':
      return (
        <section className="verify" aria-label={`Verifikasi: ${block.title}`}>
          <div className="verify-head">
            <span className="verify-label">Verifikasi</span>
            <h3>{block.title}</h3>
          </div>
          <CodeBlock code={block.command} />
          <div className="expect">
            <span className="expect-label">Hasil yang diharapkan</span>
            <p>
              <Inline text={block.expect} />
            </p>
          </div>
        </section>
      );
  }
}

export default function DocBlocks({ blocks }: Readonly<{ blocks: Block[] }>) {
  const ids = headingsOf(blocks).map((h) => h.id);
  let h = 0;
  return (
    <div className="prose">
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} headingId={block.t === 'h' ? ids[h++] : undefined} />
      ))}
    </div>
  );
}
