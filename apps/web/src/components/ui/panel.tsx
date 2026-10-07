import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// HUD-style corner brackets, drawn just outside a panel's corners.
// Used on at most one key panel per page.
export function CornerBrackets({ className }: { className?: string }) {
  const corner = 'pointer-events-none absolute size-2.5 border-hud/60';
  return (
    <span aria-hidden className={className}>
      <span className={cn(corner, '-left-px -top-px rounded-tl-[3px] border-l-[1.5px] border-t-[1.5px]')} />
      <span className={cn(corner, '-right-px -top-px rounded-tr-[3px] border-r-[1.5px] border-t-[1.5px]')} />
      <span className={cn(corner, '-bottom-px -left-px rounded-bl-[3px] border-b-[1.5px] border-l-[1.5px]')} />
      <span className={cn(corner, '-bottom-px -right-px rounded-br-[3px] border-b-[1.5px] border-r-[1.5px]')} />
    </span>
  );
}

export function Panel({
  title,
  meta,
  actions,
  brackets = false,
  flush = false,
  className,
  bodyClassName,
  children,
  id,
}: {
  title?: ReactNode;
  /** Short text next to the title, e.g. "6 members". */
  meta?: ReactNode;
  actions?: ReactNode;
  /** Corner brackets: only on the one key panel of a page. */
  brackets?: boolean;
  /** No padding around the body, for tables and lists. */
  flush?: boolean;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
  id?: string;
}) {
  const hasHeader = title || actions || meta;
  return (
    <section
      id={id}
      className={cn(
        'relative rounded-xl border border-border bg-card text-card-foreground shadow-[var(--shadow-panel)]',
        className,
      )}
    >
      {brackets && <CornerBrackets />}
      {hasHeader && (
        <header className="flex min-h-13 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-4 py-3 sm:px-5">
          <div className="min-w-0">
            {title && (
              <h2 className="text-[15px] font-semibold tracking-[-0.005em] text-foreground">
                {title}
                {meta && <span className="ml-2 text-[13px] font-normal text-muted-foreground">{meta}</span>}
              </h2>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      {/* responsive padding only when the page doesn't set its own */}
      <div className={cn(flush ? '' : bodyClassName ? 'p-5' : 'p-4 sm:p-5', bodyClassName)}>{children}</div>
    </section>
  );
}
