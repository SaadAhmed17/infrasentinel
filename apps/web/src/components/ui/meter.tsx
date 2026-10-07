import { cn } from '@/lib/utils';

/** Colour for a usage percentage: teal, amber from 75 %, red from 90 % (or from a rule's threshold). */
export function usageColor(value: number, limit?: number) {
  if (value >= 90 || (limit !== undefined && value >= limit)) return 'var(--sev-critical)';
  if (value >= 75) return 'var(--sev-medium)';
  return 'var(--chart-1)';
}

/**
 * Usage bar for a percentage. `limit` draws a tick where an active rule fires
 * (e.g. the High CPU rule at 85 %).
 */
export function UsageMeter({
  value,
  label,
  limit,
  className,
}: {
  value: number;
  label: string;
  limit?: number;
  className?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-valuetext={`${Math.round(clamped)}%${limit !== undefined ? `, rule fires at ${limit}%` : ''}`}
      className={cn('relative h-1.5 w-full rounded-full bg-muted', className)}
    >
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{ width: `${clamped}%`, background: usageColor(clamped, limit) }}
      />
      {limit !== undefined && limit > 0 && limit < 100 && (
        <span
          aria-hidden
          className="absolute -top-1 h-3.5 w-0.5 -translate-x-1/2 rounded-full bg-foreground/55"
          style={{ left: `${limit}%` }}
        />
      )}
    </div>
  );
}
