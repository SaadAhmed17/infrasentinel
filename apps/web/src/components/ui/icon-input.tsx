import * as React from 'react';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from './input';

// Text input with a leading icon and an optional trailing control
// (e.g. a show/hide password button).
export function IconInput({
  icon: Icon,
  trailing,
  className,
  ...props
}: React.ComponentProps<'input'> & { icon: LucideIcon; trailing?: React.ReactNode }) {
  return (
    <div className="relative">
      <Icon
        className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        strokeWidth={1.75}
        aria-hidden
      />
      <Input className={cn('pl-9.5', trailing ? 'pr-10' : undefined, className)} {...props} />
      {trailing && <div className="absolute right-1.5 top-1/2 -translate-y-1/2">{trailing}</div>}
    </div>
  );
}

export function PasswordVisibilityToggle({ visible, onToggle }: { visible: boolean; onToggle: () => void }) {
  const label = visible ? 'Hide password' : 'Show password';
  const Icon = visible ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground pointer-coarse:size-10"
    >
      <Icon className="size-4" strokeWidth={1.75} />
    </button>
  );
}
