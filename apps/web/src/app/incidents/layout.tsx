import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: 'Incidents' };

export default function IncidentsLayout({ children }: { children: ReactNode }) {
  return children;
}
