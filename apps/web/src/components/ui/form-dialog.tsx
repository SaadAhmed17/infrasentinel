'use client';

import type { ReactNode } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Loader2 } from 'lucide-react';
import { Button } from './button';

// A small dialog with a form, e.g. renaming something from a page header.
// Same look as ConfirmDialog; Enter submits, Escape cancels.
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  submitLabel,
  busy = false,
  error,
  onSubmit,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  submitLabel: string;
  busy?: boolean;
  /** Shown above the buttons when saving failed. */
  error?: string;
  onSubmit: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/30 transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 dark:bg-black/60" />
        <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[min(26rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border-strong bg-popover p-5 text-popover-foreground shadow-[0_24px_64px_-24px_rgb(0_0_0/0.5)] outline-none transition-[opacity,scale] duration-200 data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0">
          <Dialog.Title className="text-[16px] font-semibold text-foreground">{title}</Dialog.Title>
          {description && (
            <Dialog.Description className="mt-1.5 text-[14px] leading-relaxed text-muted-foreground">{description}</Dialog.Description>
          )}
          <form
            noValidate
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              onSubmit();
            }}
          >
            {children}
            {error && (
              <p role="alert" className="mt-3 text-[13px] font-medium text-destructive">
                {error}
              </p>
            )}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close render={<Button type="button" variant="ghost" disabled={busy} />}>Cancel</Dialog.Close>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="animate-spin" aria-hidden />}
                {submitLabel}
              </Button>
            </div>
          </form>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
