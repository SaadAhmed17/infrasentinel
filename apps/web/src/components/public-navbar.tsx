'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { Logo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

// Top bar for the public pages (home, services, about, contact).
export function PublicNavbar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [openFor, setOpenFor] = useState<string | null>(null);
  // The menu belongs to the page it was opened on, so navigating closes it.
  const open = openFor === pathname;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpenFor(null);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const primaryCta = user
    ? { href: '/dashboard', label: 'Open dashboard' }
    : { href: '/signup', label: 'Create organization' };

  return (
    <header className="relative z-20">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-6 lg:px-10">
        <Link href="/" className="inline-flex rounded-md" aria-label="InfraSentinel home">
          <Logo markClassName="w-7" wordmarkClassName="text-[20px]" />
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  active ? 'bg-accent text-foreground' : 'text-muted-foreground',
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {!user && (
            <Link href="/login" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'hidden sm:inline-flex')}>
              Sign in
            </Link>
          )}
          <Link href={primaryCta.href} className={cn(buttonVariants({ size: 'sm' }), 'hidden sm:inline-flex')}>
            {primaryCta.label}
          </Link>
          <Button
            variant="ghost"
            size="icon-sm"
            className="md:hidden"
            onClick={() => setOpenFor(open ? null : pathname)}
            aria-expanded={open}
            aria-controls="public-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
          >
            {open ? <X /> : <Menu />}
          </Button>
        </div>
      </div>

      {open && (
        <div id="public-menu" className="border-y border-border bg-background/95 backdrop-blur md:hidden">
          <nav className="mx-auto max-w-7xl space-y-1 px-6 py-4" aria-label="Main">
            {LINKS.map((link) => {
              const active = isActive(pathname, link.href);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'block rounded-md px-3 py-2.5 text-[15px] font-medium transition-colors',
                    active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                  )}
                >
                  {link.label}
                </Link>
              );
            })}
            <div className="mt-3 flex flex-col gap-2 border-t border-border pt-4 sm:hidden">
              {!user && (
                <Link href="/login" className={buttonVariants({ variant: 'outline' })}>
                  Sign in
                </Link>
              )}
              <Link href={primaryCta.href} className={buttonVariants()}>
                {primaryCta.label}
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
