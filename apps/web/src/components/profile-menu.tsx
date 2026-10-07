'use client';

import { ChevronDown, LogOut, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { initialsFromEmail } from '@/lib/format';
import { roleLabel } from '@/lib/roles';
import { useShellState } from '@/lib/shell-store';
import { DropdownMenu, MenuItem, MenuLinkItem, MenuSeparator } from '@/components/ui/menu';
import { Skeleton } from '@/components/ui/skeleton';

// Account button in the top bar: initials and organization name; the menu
// holds who is signed in and the account actions.
export function ProfileMenu() {
  const { user, logout } = useAuth();
  const { orgName, orgFailed } = useShellState();

  return (
    <DropdownMenu
      trigger={
        <button
          type="button"
          aria-label={`Account menu for ${user?.email ?? 'you'}`}
          className="flex h-9 items-center gap-2.5 rounded-lg border border-border bg-surface-2/60 pl-1 pr-1 transition-colors hover:bg-accent data-[popup-open]:bg-accent sm:pr-2.5 pointer-coarse:h-11"
        >
          <span className="flex size-7 items-center justify-center rounded-md bg-primary/15 text-[11.5px] font-semibold text-primary-bright pointer-coarse:size-9">
            {initialsFromEmail(user?.email)}
          </span>
          <span className="hidden max-w-44 truncate text-[13.5px] font-medium text-foreground sm:block">
            {orgName ?? (orgFailed ? 'Account' : <Skeleton className="h-3.5 w-24" />)}
          </span>
          <ChevronDown className="hidden size-3.5 text-muted-foreground sm:block" strokeWidth={1.75} aria-hidden />
        </button>
      }
    >
      <div className="px-2.5 pb-2 pt-1.5">
        <p className="truncate text-[13.5px] font-medium text-foreground">{user?.email}</p>
        <p className="mt-0.5 truncate text-[12.5px] text-muted-foreground">
          {roleLabel(user?.role)}
          {orgName && ` at ${orgName}`}
        </p>
      </div>
      <MenuSeparator />
      <MenuLinkItem href="/settings" icon={Settings}>
        Settings
      </MenuLinkItem>
      <MenuItem icon={LogOut} onClick={logout}>
        Sign out
      </MenuItem>
    </DropdownMenu>
  );
}
