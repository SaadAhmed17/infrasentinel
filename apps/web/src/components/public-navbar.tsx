'use client';

import { useEffect, useRef, useState } from 'react';
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
  { href: '/features', label: 'Features' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

// Top bar for the public pages (home, features, about, contact).
export function PublicNavbar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // The menu belongs to the page it was opened on, so navigating closes it.
  const open = openFor === pathname;

  useEffect(() => {
    if (!open) return;
    sheetRef.current?.querySelector<HTMLElement>('a')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenFor(null);
        buttonRef.current?.focus();
      }
      // keep Tab inside the open menu
      if (e.key === 'Tab' && sheetRef.current) {
        const items = [...sheetRef.current.querySelectorAll<HTMLElement>('a, button')];
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const primaryCta = user ? { href: '/dashboard', label: 'Open dashboard' } : { href: '/signup', label: 'Create organization' };

  return (
    <header className="relative z-30">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-6 lg:px-10">
        <Link href="/" className="inline-flex rounded-md" aria-label="InfraSentinel home">
          <Logo markClassName="w-7" wordmarkClassName="text-[20px]" />
        </Link>

        <nav className="hidden items-center gap-6 md:flex" aria-label="Main">
          {LINKS.map((link) => {
            const active = isActive(pathname, link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative py-2 text-[14px] font-medium transition-colors duration-[120ms]',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {link.label}
                {active && <span aria-hidden className="absolute inset-x-0 -bottom-0.5 h-0.5 rounded-full bg-primary-bright" />}
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
            ref={buttonRef}
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
        <>
          {/* tapping outside the sheet closes it */}
          <div aria-hidden className="fixed inset-0 top-20 z-30 bg-black/20 md:hidden dark:bg-black/50" onClick={() => setOpenFor(null)} />
          <div
            ref={sheetRef}
            id="public-menu"
            className="absolute inset-x-0 top-20 z-40 animate-fade-up border-y border-border bg-background shadow-[0_24px_48px_-24px_rgb(0_0_0/0.35)] md:hidden"
          >
            <nav className="mx-auto max-w-7xl px-4 py-3" aria-label="Main">
              {LINKS.map((link) => {
                const active = isActive(pathname, link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex h-12 items-center rounded-lg px-3 text-[16px] font-medium transition-colors',
                      active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                    )}
                  >
                    {link.label}
                  </Link>
                );
              })}
              <div className="mt-3 flex flex-col gap-2 border-t border-border pb-2 pt-4">
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
        </>
      )}
    </header>
  );
}
