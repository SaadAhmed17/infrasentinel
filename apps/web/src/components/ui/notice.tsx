import type { ReactNode } from 'react';
import { AlertCircle, AlertTriangle, CircleCheck, Info, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toneSurface, type Tone } from './tone';

const VARIANTS: Record<'error' | 'success' | 'info' | 'warning', { tone: Tone; icon: LucideIcon }> = {
  error: { tone: 'critical', icon: AlertCircle },
  success: { tone: 'online', icon: CircleCheck },
  info: { tone: 'primary', icon: Info },
  warning: { tone: 'medium', icon: AlertTriangle },
};

// Inline message for errors, confirmations and hints inside a page or form.
export function Notice({
  tone = 'info',
  icon,
  action,
  children,
  className,
}: {
  tone?: 'error' | 'success' | 'info' | 'warning';
  icon?: LucideIcon;
  /** A button or link at the end, e.g. "Try again". */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const variant = VARIANTS[tone];
  const Icon = icon ?? variant.icon;
  const surface = toneSurface(variant.tone);
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-[13.5px] leading-relaxed', className)}
      style={{ backgroundColor: surface.backgroundColor, borderColor: surface.borderColor }}
    >
      <Icon className="mt-[3px] size-4 shrink-0" style={{ color: surface.color }} strokeWidth={1.75} aria-hidden />
      <div className="min-w-0 flex-1 text-foreground">{children}</div>
      {action && <div className="-my-1 shrink-0">{action}</div>}
    </div>
  );
}
