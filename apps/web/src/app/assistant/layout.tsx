import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: 'AI assistant' };

export default function AssistantLayout({ children }: { children: ReactNode }) {
  return children;
}
