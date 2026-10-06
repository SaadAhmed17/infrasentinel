import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// The reset token is part of this page's URL: never send it to other sites in the Referer header.
export const metadata: Metadata = {
  title: 'Reset password',
  referrer: 'no-referrer',
};

export default function ResetPasswordLayout({ children }: { children: ReactNode }) {
  return children;
}
