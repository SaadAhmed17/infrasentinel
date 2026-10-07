'use client';

import type { ReactNode } from 'react';
import { AlertDialog } from '@base-ui/react/alert-dialog';
import { Loader2 } from 'lucide-react';
import { Button } from './button';

// One pattern for every destructive action: the title names the object, one
// sentence says what happens, the confirm button repeats the verb.
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  busy = false,
  error,
  destructive = true,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  busy?: boolean;
  /** Shown inside the dialog when the action failed, so it can be retried. */
  error?: string;
  destructive?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop className="fixed inset-0 z-50 bg-black/30 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 dark:bg-black/60" />
        <AlertDialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border-strong bg-popover p-5 text-popover-foreground shadow-[0_24px_64px_-24px_rgb(0_0_0/0.5)] outline-none transition-[opacity,scale] duration-200 data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0">
          <AlertDialog.Title className="text-[16px] font-semibold text-foreground">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">
            {description}
          </AlertDialog.Description>
          {error && (
            <p role="alert" className="mt-3 text-[13px] font-medium text-destructive">
              {error}
            </p>
          )}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Close render={<Button variant="ghost" disabled={busy} />}>Cancel</AlertDialog.Close>
            <Button variant={destructive ? 'destructive-solid' : 'default'} onClick={onConfirm} disabled={busy}>
              {busy && <Loader2 className="animate-spin" aria-hidden />}
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
