'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ShieldCheck, Menu, X } from 'lucide-react';

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/services', label: 'Services' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export function PublicNavbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  /* Close menu automatically whenever the route changes */
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  /* Close on Escape */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">

        {/* LOGO */}
        <Link href="/" className="flex items-center gap-2.5">
          <div
            className="flex size-8 items-center justify-center rounded-lg shadow-sm"
            style={{ background: 'oklch(0.62 0.19 265)' }}
          >
            <ShieldCheck
              className="size-4.5 text-white"
              strokeWidth={2.25}
            />
          </div>

          <span className="text-[16px] font-bold tracking-tight text-foreground">
            InfraSentinel
          </span>
        </Link>

        {/* NAV LINKS — DESKTOP */}
        <nav className="hidden items-center gap-1 sm:flex">
          {LINKS.map((link) => {
            const active =
              link.href === '/'
                ? pathname === '/'
                : pathname.startsWith(link.href);

            return (
              <Link
                key={link.href}
                href={link.href}
                className={`rounded-lg px-3.5 py-2 text-[14px] font-semibold transition-colors ${
                  active
                    ? 'bg-muted text-foreground'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        {/* RIGHT SIDE */}
        <div className="flex items-center gap-2.5">

          {/* Desktop auth buttons */}
          <Link
            href="/login"
            className="hidden rounded-lg px-3.5 py-2 text-[14px] font-semibold text-foreground transition-colors hover:bg-muted sm:block"
          >
            Log in
          </Link>

          <Link
            href="/signup"
            className="hidden rounded-lg px-4 py-2 text-[14px] font-bold text-white shadow-sm transition-opacity hover:opacity-90 sm:block"
            style={{ background: 'oklch(0.62 0.19 265)' }}
          >
            Sign up
          </Link>

          {/* Mobile: keep only the signup CTA visible */}
          <Link
            href="/signup"
            className="rounded-lg px-3.5 py-2 text-[13px] font-bold text-white shadow-sm transition-opacity hover:opacity-90 sm:hidden"
            style={{ background: 'oklch(0.62 0.19 265)' }}
          >
            Sign up
          </Link>

          {/* Hamburger — mobile only */}
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="flex size-9 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted sm:hidden"
          >
            {open ? (
              <X className="size-5" strokeWidth={2.25} />
            ) : (
              <Menu className="size-5" strokeWidth={2.25} />
            )}
          </button>
        </div>
      </div>

      {/* MOBILE DROPDOWN */}
      {open && (
        <div
          id="mobile-menu"
          className="animate-[navDrop_0.18s_ease-out] border-t border-border bg-background sm:hidden"
        >
          <nav className="mx-auto max-w-6xl space-y-1 px-6 py-4">
            {LINKS.map((link) => {
              const active =
                link.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(link.href);

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`block rounded-lg px-3.5 py-2.5 text-[14px] font-semibold transition-colors ${
                    active
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}

            <div className="!mt-3 border-t border-border pt-3">
              <Link
                href="/login"
                className="block rounded-lg px-3.5 py-2.5 text-[14px] font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Log in
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}