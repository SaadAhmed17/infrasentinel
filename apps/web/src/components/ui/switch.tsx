import { cn } from '@/lib/utils';

// On/off switch (e.g. a rule's active state).
export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange?: () => void;
  disabled?: boolean;
  /** Accessible name, e.g. "Rule SSH brute force active". */
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      title={disabled ? (checked ? 'Active' : 'Inactive') : undefined}
      onClick={onChange}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors disabled:cursor-default disabled:opacity-60',
        checked ? 'border-primary bg-primary' : 'border-border-strong bg-muted',
      )}
    >
      <span
        className={cn(
          'inline-block size-3.5 rounded-full shadow-sm transition-transform',
          checked ? 'translate-x-[18px] bg-primary-foreground' : 'translate-x-[2px] bg-muted-foreground',
        )}
      />
    </button>
  );
}
