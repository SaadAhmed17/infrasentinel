'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { AppBackground } from '@/components/app-background';
import { RackSkyline } from '@/components/auth/rack-skyline';
import { Logo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/theme-toggle';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Shared look of the sign-in, sign-up, password and invitation screens.
export const authButtonClassName = cn(buttonVariants({ size: 'lg' }), 'w-full');
export const authLinkClassName = 'font-semibold text-primary underline-offset-4 hover:underline';

const CAPABILITIES = ['Rules checked every 30 s', 'LSTM anomaly detection', 'AI incident assistant'];

export function AuthShell({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="relative min-h-screen lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
      <AppBackground intensity="bold" />

      <aside className="relative z-10 hidden min-h-screen flex-col overflow-hidden border-r border-border bg-surface-3/45 lg:flex dark:bg-transparent">
        <div className="px-12 pt-10 xl:px-16">
          <Link href="/" className="inline-flex rounded-md" aria-label="InfraSentinel home">
            <Logo markClassName="w-7" wordmarkClassName="text-[20px]" />
          </Link>
        </div>

        <div className="flex flex-1 flex-col justify-center px-12 py-12 xl:px-16">
          <p className="hud-label">Infrastructure security monitoring</p>
          <h2 className="mt-5 max-w-[14ch] font-display text-[40px] font-semibold leading-[1.06] tracking-[-0.035em] text-foreground xl:text-[46px]">
            See every server. Catch every attack.
          </h2>
          <p className="mt-6 max-w-md text-[15.5px] leading-relaxed text-muted-foreground">
            Live metrics, SIEM rules and an LSTM anomaly model watch your fleet around the clock. When
            something happens, the AI assistant explains it.
          </p>
          <ul className="mt-8 flex flex-wrap gap-2">
            {CAPABILITIES.map((item) => (
              <li
                key={item}
                className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface-2/60 px-3 py-1.5 font-mono text-[11.5px] text-foreground"
              >
                <span className="size-1.5 rounded-[1px] bg-primary-bright" aria-hidden />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <RackSkyline className="h-[34vh] min-h-52 w-full" />
      </aside>

      <main className="relative z-10 flex min-h-screen flex-col px-6 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex rounded-md lg:invisible" aria-label="InfraSentinel home">
            <Logo markClassName="w-6" wordmarkClassName="text-[18px]" />
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px] animate-fade-up">
            <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.025em] text-foreground">
              {title}
            </h1>
            <div className="mt-2.5 text-[14.5px] leading-relaxed text-muted-foreground">{description}</div>
            <div className="mt-8">{children}</div>
            {footer && (
              <div className="mt-8 border-t border-border pt-6 text-center text-[14px] text-muted-foreground">
                {footer}
              </div>
            )}
          </div>
        </div>

        {/* small screens: the skyline becomes a strip under the form */}
        <RackSkyline className="-mx-6 -mb-6 h-44 w-[calc(100%+3rem)] sm:-mx-10 sm:w-[calc(100%+5rem)] lg:hidden" />
      </main>
    </div>
  );
}
