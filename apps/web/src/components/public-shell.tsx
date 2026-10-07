import type { ReactNode } from 'react';
import { AppBackground } from '@/components/app-background';
import { PublicFooter } from '@/components/public-footer';
import { PublicNavbar } from '@/components/public-navbar';

// Frame for the public pages: backdrop, top bar and footer.
export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip">
      <AppBackground intensity="bold" />
      <PublicNavbar />
      <main className="relative z-10 flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}

// Heading block used at the top of each public page.
export function PublicPageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="animate-fade-up">
      <p className="hud-label">{eyebrow}</p>
      <h1 className="mt-5 max-w-3xl font-display text-[38px] font-semibold leading-[1.05] tracking-[-0.04em] text-foreground sm:text-[50px]">
        {title}
      </h1>
      {children && <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">{children}</p>}
    </div>
  );
}
