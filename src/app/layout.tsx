import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'DevOps Playground',
  description: 'Workload dummy untuk menguji Kubernetes, ingress, API gateway, dan rollout',
};

// Terapkan tema pilihan sebelum paint agar tidak berkedip. ?theme=light|dark juga diterima (berguna untuk tautan dan tangkapan layar).
const THEME_SCRIPT = `(function(){try{var p=new URLSearchParams(location.search).get('theme');var t=(p==='light'||p==='dark')?p:localStorage.getItem('theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t}catch(e){}})()`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <a className="skip" href="#konten">
          Lewati ke konten
        </a>
        <div id="konten">{children}</div>
      </body>
    </html>
  );
}
