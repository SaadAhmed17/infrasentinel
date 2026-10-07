import type { Metadata } from 'next';
import Link from 'next/link';
import { AppBackground } from '@/components/app-background';
import { RackSkyline } from '@/components/auth/rack-skyline';
import { Logo } from '@/components/brand/logo';
import { NotFoundActions } from '@/components/not-found-actions';

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

      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <p className="text-[13px] font-semibold text-muted-foreground">Error 404</p>
        <h1 className="mt-3 font-display text-[34px] font-semibold leading-tight tracking-[-0.03em] text-foreground sm:text-[48px]">
          Page not found
        </h1>
        <p className="mt-4 max-w-md text-[15.5px] leading-relaxed text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <NotFoundActions />
      </main>

      {/* an outage: lights off, one red light, the sun going down */}
      <RackSkyline outage className="relative z-10 h-40 w-full sm:hidden" />
      <RackSkyline outage variant="wide" className="relative z-10 hidden h-56 w-full sm:block" />
    </div>
  );
}
