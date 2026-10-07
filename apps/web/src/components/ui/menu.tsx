'use client';

import type { ReactElement, ReactNode } from 'react';
import Link from 'next/link';
import { Menu } from '@base-ui/react/menu';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

const itemClass =
  'flex w-full cursor-default items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13.5px] font-medium text-foreground outline-none select-none data-[highlighted]:bg-accent pointer-coarse:py-2.5';

// Dropdown menu with keyboard support (arrow keys, Escape, type-ahead).
export function DropdownMenu({
  trigger,
  children,
  align = 'end',
  className,
}: {
  /** The button that opens the menu. Must accept a ref and props. */
  trigger: ReactElement;
  children: ReactNode;
  align?: 'start' | 'center' | 'end';
  className?: string;
}) {
  return (
    <Menu.Root>
      <Menu.Trigger render={trigger} />
      <Menu.Portal>
        <Menu.Positioner align={align} sideOffset={6} className="z-40 outline-none">
          <Menu.Popup
            className={cn(
              'min-w-48 origin-[var(--transform-origin)] rounded-xl border border-border-strong bg-popover p-1.5 text-popover-foreground shadow-[0_12px_32px_-16px_rgb(0_0_0/0.45)] outline-none transition-[opacity,scale] duration-150 data-[ending-style]:scale-[0.98] data-[ending-style]:opacity-0 data-[starting-style]:scale-[0.98] data-[starting-style]:opacity-0',
              className,
            )}
          >
            {children}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export function MenuItem({
  icon: Icon,
  onClick,
  destructive = false,
  children,
}: {
  icon?: LucideIcon;
  onClick?: () => void;
  destructive?: boolean;
  children: ReactNode;
}) {
  return (
    <Menu.Item onClick={onClick} className={cn(itemClass, destructive && 'text-destructive data-[highlighted]:bg-destructive/10')}>
      {Icon && (
        <Icon className={cn('size-4 shrink-0', destructive ? 'text-destructive' : 'text-muted-foreground')} strokeWidth={1.75} aria-hidden />
      )}
      {children}
    </Menu.Item>
  );
}

export function MenuLinkItem({ href, icon: Icon, children }: { href: string; icon?: LucideIcon; children: ReactNode }) {
  return (
    <Menu.LinkItem render={<Link href={href} />} closeOnClick className={itemClass}>
      {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} aria-hidden />}
      {children}
    </Menu.LinkItem>
  );
}

export function MenuSeparator() {
  return <Menu.Separator className="mx-1 my-1.5 h-px bg-border" />;
}
