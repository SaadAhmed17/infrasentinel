import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export function PageHeader({
  title,
  description,
  meta,
  back,
  actions,
}: {
  title: ReactNode;
  /** One sentence for first-time users; leave it out when the page explains itself. */
  description?: ReactNode;
  /** Live facts under the title, e.g. "5 of 7 online". */
  meta?: ReactNode;
  /** Back link for detail pages, e.g. { href: '/servers', label: 'Servers' }. */
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 sm:mb-6">
      {back && (
        <Link
          href={back.href}
          className="mb-3 inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" strokeWidth={1.75} aria-hidden />
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <h1 className="font-display text-[24px] font-semibold leading-[1.2] tracking-[-0.02em] text-foreground sm:text-[28px] sm:leading-[1.15]">
            {title}
          </h1>
          {meta && <div className="mt-2 text-[13.5px] text-muted-foreground">{meta}</div>}
          {description && <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">{actions}</div>}
      </div>
    </div>
  );
}
