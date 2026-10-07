'use client';

import type { ReactNode } from 'react';
import { Toast } from '@base-ui/react/toast';
import { Tooltip } from '@base-ui/react/tooltip';
import { Toaster } from '@/components/ui/toast';

// App-wide providers for tooltips and toasts.
export function Providers({ children }: { children: ReactNode }) {
  return (
    <Tooltip.Provider delay={400}>
      <Toast.Provider timeout={4000} limit={3}>
        {children}
        <Toaster />
      </Toast.Provider>
    </Tooltip.Provider>
  );
}
