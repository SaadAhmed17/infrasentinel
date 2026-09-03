'use client';

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { LogOut, ChevronDown } from 'lucide-react';

function initials(email?: string) {
  if (!email) return '?';
  return email.slice(0, 2).toUpperCase();
}

export function ProfileMenu() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-lg border border-border py-1 pl-1 pr-2 transition-colors hover:bg-muted"
      >
        <div
          className="flex size-6.5 items-center justify-center rounded-md text-[11px] font-semibold text-white"
          style={{ background: 'oklch(0.62 0.19 265)' }}
        >
          {initials(user?.email)}
        </div>
        <span className="max-w-32 truncate text-[13px] font-medium text-foreground">{user?.email}</span>
        <ChevronDown className="size-3.5 text-muted-foreground" strokeWidth={2} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-30 mt-2 w-56 rounded-xl border border-border bg-card p-1.5 shadow-lg">
          <div className="px-2.5 py-2">
            <p className="truncate text-[13px] font-medium text-foreground">{user?.email}</p>
            <p className="text-[12px] text-muted-foreground">{user?.role.replace(/_/g, ' ')}</p>
          </div>
          <div className="my-1 h-px bg-border" />
          <button
            onClick={logout}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-foreground transition-colors hover:bg-muted"
          >
            <LogOut className="size-3.5" strokeWidth={2} />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}