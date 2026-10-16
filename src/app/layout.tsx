import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'DevOps Playground',
  description: 'Workload dummy untuk menguji Kubernetes, ingress, API gateway, dan rollout',
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="id">
      <body>
        <a className="skip" href="#konten">
          Lewati ke konten
        </a>
        <div id="konten">{children}</div>
      </body>
    </html>
  );
}
