'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { cn } from '@/lib/utils';

function initials(email?: string) {
  if (!email) return '?';
  return email.slice(0, 2).toUpperCase();
}

function roleLabel(role?: string) {
  if (!role) return '';
  return role
    .split('_')
    .map((word) => word.charAt(0) + word.slice(1).toLowerCase())
    .join(' ');
}

export function ProfileMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'flex h-9 items-center gap-2.5 rounded-lg border border-border bg-surface-2/50 pl-1 pr-2.5 transition-colors hover:bg-accent',
          open && 'bg-accent',
        )}
      >
        <span className="flex size-7 items-center justify-center rounded-md bg-primary/15 font-mono text-[11px] font-semibold text-primary-bright">
          {initials(user?.email)}
        </span>
        <span className="hidden max-w-40 truncate text-[13.5px] font-medium text-foreground sm:block">{user?.email}</span>
        <ChevronDown className={cn('size-3.5 text-muted-foreground transition-transform', open && 'rotate-180')} strokeWidth={2} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-64 animate-in rounded-xl border border-border-strong bg-popover p-1.5 shadow-[var(--shadow-panel)] fade-in-0 zoom-in-95"
        >
          <div className="px-3 py-2.5">
            <p className="truncate text-[13.5px] font-medium text-foreground">{user?.email}</p>
            <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
              {roleLabel(user?.role)}
            </p>
          </div>
          <div className="my-1 h-px bg-border" />
          <button
            role="menuitem"
            onClick={logout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13.5px] font-medium text-foreground transition-colors hover:bg-accent"
          >
            <LogOut className="size-4 text-muted-foreground" strokeWidth={1.8} />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
