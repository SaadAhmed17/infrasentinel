'use client';

import { formatTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Tooltip } from './tooltip';

const STATES = {
  live: { label: 'Live', dot: 'var(--status-online)', pulse: true },
  paused: { label: 'Retrying', dot: 'var(--sev-medium)', pulse: false },
  offline: { label: 'Offline', dot: 'var(--status-unknown)', pulse: false },
};

/**
 * The one moving element on a page: shows that the data refreshes by itself,
 * and switches to "Retrying" when the last refresh failed.
 */
export function LiveIndicator({
  state,
  every,
  updatedAt,
  className,
}: {
  state: keyof typeof STATES;
  /** How often the page refreshes, e.g. "10 s". */
  every: string;
  updatedAt?: number | null;
  className?: string;
}) {
  const { label, dot, pulse } = STATES[state];
  const hint =
    state === 'paused'
      ? `The last refresh failed. Trying again every ${every}.`
      : `Refreshes every ${every}.${updatedAt ? ` Last update at ${formatTime(updatedAt, true)}.` : ''}`;
  return (
    <Tooltip content={hint}>
      <span
        tabIndex={0}
        className={cn('inline-flex items-center gap-1.5 rounded-sm text-[12.5px] font-medium text-muted-foreground', className)}
        aria-label={`${label}. ${hint}`}
      >
        <span className="relative inline-flex size-2" aria-hidden>
          {pulse && <span className="absolute inset-0 animate-status-ping rounded-full" style={{ background: dot }} />}
          <span className="relative inline-flex size-2 rounded-full" style={{ background: dot }} />
        </span>
        {label}
      </span>
    </Tooltip>
  );
}
