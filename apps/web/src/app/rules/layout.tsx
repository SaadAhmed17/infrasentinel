import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: 'Rules' };

export default function RulesLayout({ children }: { children: ReactNode }) {
  return children;
}
