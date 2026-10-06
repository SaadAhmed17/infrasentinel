import type { ReactNode } from 'react';
import { AlertCircle, CircleCheck, Info, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toneSurface, type Tone } from './tone';

const VARIANTS: Record<'error' | 'success' | 'info', { tone: Tone; icon: LucideIcon }> = {
  error: { tone: 'critical', icon: AlertCircle },
  success: { tone: 'online', icon: CircleCheck },
  info: { tone: 'primary', icon: Info },
};

// Inline message for errors, confirmations and hints inside a page or form.
export function Notice({
  tone = 'info',
  icon,
  children,
  className,
}: {
  tone?: 'error' | 'success' | 'info';
  icon?: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  const variant = VARIANTS[tone];
  const Icon = icon ?? variant.icon;
  const surface = toneSurface(variant.tone);
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-[13.5px] leading-relaxed', className)}
      style={{ backgroundColor: surface.backgroundColor, borderColor: surface.borderColor }}
    >
      <Icon className="mt-[3px] size-4 shrink-0" style={{ color: surface.color }} strokeWidth={2} aria-hidden />
      <div className="min-w-0 text-foreground">{children}</div>
    </div>
  );
}
