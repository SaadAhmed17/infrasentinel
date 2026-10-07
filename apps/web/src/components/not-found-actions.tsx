'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { buttonVariants } from '@/components/ui/button';

// The way back depends on whether someone is signed in.
export function NotFoundActions() {
  const { user } = useAuth();
  const primary = user ? { href: '/dashboard', label: 'Go to dashboard' } : { href: '/', label: 'Go to home page' };
  const secondary = user ? { href: '/', label: 'Go to home page' } : { href: '/login', label: 'Sign in' };
  return (
    <div className="mt-8 flex w-full flex-col justify-center gap-3 sm:w-auto sm:flex-row">
      <Link href={primary.href} className={buttonVariants({ size: 'lg' })}>
        {primary.label}
      </Link>
      <Link href={secondary.href} className={buttonVariants({ variant: 'outline', size: 'lg' })}>
        {secondary.label}
      </Link>
    </div>
  );
}
