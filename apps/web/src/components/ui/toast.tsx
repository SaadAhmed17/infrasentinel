'use client';

import { Toast } from '@base-ui/react/toast';
import { AlertCircle, CircleCheck, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Short confirmations after an action ("Rule turned off"). Errors that block
// the user stay inline next to what failed; toasts are for things that worked.
export function Toaster() {
  return (
    <Toast.Portal>
      <Toast.Viewport className="fixed bottom-4 right-4 z-[60] flex w-[min(22.5rem,calc(100vw-2rem))] flex-col gap-2 outline-none max-md:bottom-[calc(5rem+env(safe-area-inset-bottom))] max-md:right-4">
        <ToastList />
      </Toast.Viewport>
    </Toast.Portal>
  );
}

function ToastList() {
  const { toasts } = Toast.useToastManager();
  return toasts.map((toast) => {
    const Icon = toast.type === 'error' ? AlertCircle : CircleCheck;
    return (
      <Toast.Root
        key={toast.id}
        toast={toast}
        className="rounded-xl border border-border-strong bg-popover text-popover-foreground shadow-[0_12px_32px_-16px_rgb(0_0_0/0.45)] outline-none transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.2,0.7,0.2,1)] data-[ending-style]:translate-y-2 data-[ending-style]:opacity-0 data-[starting-style]:translate-y-2 data-[starting-style]:opacity-0"
      >
        <Toast.Content className="flex items-start gap-3 p-3.5">
          <Icon
            className={cn('mt-0.5 size-4 shrink-0', toast.type === 'error' ? 'text-destructive' : 'text-status-online')}
            strokeWidth={1.75}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <Toast.Title className="text-[14px] font-medium leading-snug text-foreground" />
            <Toast.Description className="mt-0.5 text-[13px] leading-snug text-muted-foreground" />
          </div>
          <Toast.Close
            aria-label="Dismiss"
            className="-m-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="size-3.5" strokeWidth={1.75} aria-hidden />
          </Toast.Close>
        </Toast.Content>
      </Toast.Root>
    );
  });
}

export function useToast() {
  const manager = Toast.useToastManager();
  return {
    success: (title: string, description?: string) => manager.add({ title, description, type: 'success' }),
    error: (title: string, description?: string) => manager.add({ title, description, type: 'error', priority: 'high' }),
  };
}
