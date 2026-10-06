import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

// HUD-style corner brackets, drawn just outside a panel's corners.
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
  label,
  title,
  actions,
  brackets = false,
  className,
  bodyClassName,
  children,
}: {
  /** Small uppercase label above the title. */
  label?: string;
  title?: ReactNode;
  actions?: ReactNode;
  /** Corner brackets — reserve for the one or two key panels on a page. */
  brackets?: boolean;
  className?: string;
  bodyClassName?: string;
  children?: ReactNode;
}) {
  const hasHeader = label || title || actions;
  return (
    <section
      className={cn(
        'relative rounded-xl border border-border bg-card/90 text-card-foreground shadow-[var(--shadow-panel)] backdrop-blur-[2px]',
        className,
      )}
    >
      {brackets && <CornerBrackets />}
      {hasHeader && (
        <header className="flex min-h-14 items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div className="min-w-0">
            {label && <p className="hud-label">{label}</p>}
            {title && (
              <h2 className={cn('truncate text-[15px] font-semibold tracking-tight text-foreground', label && 'mt-0.5')}>
                {title}
              </h2>
            )}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn('p-5', bodyClassName)}>{children}</div>
    </section>
  );
}
