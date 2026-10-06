import type { Metadata } from 'next';
import Link from 'next/link';
import { AppBackground } from '@/components/app-background';
import { RackSkyline } from '@/components/auth/rack-skyline';
import { Logo } from '@/components/brand/logo';
import { buttonVariants } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Page not found' };

export default function NotFound() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip">
      <AppBackground intensity="bold" />
      <header className="relative z-10 mx-auto flex h-20 w-full max-w-7xl items-center px-6 lg:px-10">
        <Link href="/" className="inline-flex rounded-md" aria-label="InfraSentinel home">
          <Logo markClassName="w-7" wordmarkClassName="text-[20px]" />
        </Link>
      </header>

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <p className="hud-label">Error 404</p>
        <h1 className="mt-5 font-display text-[64px] font-semibold leading-none tracking-[-0.05em] text-foreground sm:text-[96px]">
          4<span className="text-primary-bright">0</span>4
        </h1>
        <p className="mt-6 text-[20px] font-semibold text-foreground">Page not found</p>
        <p className="mt-2 max-w-md text-[15px] text-muted-foreground">
          The page you are looking for does not exist or has moved.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/dashboard" className={buttonVariants({ size: 'lg' })}>
            Open dashboard
          </Link>
          <Link href="/" className={buttonVariants({ variant: 'outline', size: 'lg' })}>
            Back to home
          </Link>
        </div>
      </main>

      <RackSkyline variant="wide" className="relative z-10 h-44 w-full sm:h-56" />
    </div>
  );
}
