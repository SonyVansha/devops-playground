'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export interface NavGroup {
  name: string;
  items: Array<{ slug: string; title: string }>;
}

export default function DocsNav({ groups }: Readonly<{ groups: NavGroup[] }>) {
  const pathname = usePathname() ?? '';
  return (
    <nav aria-label="Daftar dokumentasi" className="docs-nav">
      {groups.map((group) => (
        <div key={group.name}>
          <h2>{group.name}</h2>
          <ul>
            {group.items.map((item) => {
              const active = pathname.endsWith(`/docs/${item.slug}`);
              return (
                <li key={item.slug}>
                  <Link href={`/docs/${item.slug}`} aria-current={active ? 'page' : undefined}>
                    {item.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
