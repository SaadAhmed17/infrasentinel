'use client';

import type { ReactElement, ReactNode } from 'react';
import { Tooltip as BaseTooltip } from '@base-ui/react/tooltip';

// Supplementary hint on hover and keyboard focus (not shown on touch screens),
// so it never carries information that isn't available another way.
export function Tooltip({
  content,
  children,
  side = 'top',
}: {
  content: ReactNode;
  /** The trigger. Must accept a ref and props (a DOM element, Link or Button). */
  children: ReactElement;
  side?: 'top' | 'bottom' | 'left' | 'right';
}) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner side={side} sideOffset={8} className="z-50">
          <BaseTooltip.Popup className="max-w-xs origin-[var(--transform-origin)] rounded-md border border-border-strong bg-popover px-2.5 py-1.5 text-[12.5px] leading-snug text-popover-foreground shadow-[0_8px_24px_-12px_rgb(0_0_0/0.4)] transition-[opacity,scale] duration-150 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            {content}
          </BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}
