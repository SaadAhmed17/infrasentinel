import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TONE_COLOR, type Tone } from './tone';

export function StatTile({
  label,
  value,
  hint,
  tone = 'default',
  icon: Icon,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: Tone;
  icon?: LucideIcon;
  className?: string;
}) {
  const color = TONE_COLOR[tone];
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-xl border border-border bg-card/90 p-5 shadow-[var(--shadow-panel)] backdrop-blur-[2px]',
        className,
      )}
    >
      {/* tone rail */}
      <span aria-hidden className="absolute inset-y-4 left-0 w-[3px] rounded-r-full" style={{ background: color }} />
      <div className="flex items-start justify-between gap-3">
        <p className="hud-label">{label}</p>
        {Icon && <Icon className="size-4 shrink-0" style={{ color }} strokeWidth={1.9} aria-hidden />}
      </div>
      <p className="mt-4 font-display text-[30px] font-semibold leading-none tracking-[-0.03em] text-foreground tabular-nums">
        {value}
      </p>
      {hint && <div className="mt-2.5 text-[13px] text-muted-foreground">{hint}</div>}
    </div>
  );
}
