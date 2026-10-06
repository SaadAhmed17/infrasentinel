import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: 'Servers' };

export default function ServersLayout({ children }: { children: ReactNode }) {
  return children;
}
