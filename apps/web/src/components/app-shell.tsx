'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShieldCheck,
  LayoutDashboard,
  Server,
  ListChecks,
  AlertTriangle,
  Bot,
  ChevronsLeft,
  ChevronsRight,
  Bell,
} from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { ProfileMenu } from '@/components/profile-menu';
import { apiClient } from '@/lib/api-client';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/servers', label: 'Servers', icon: Server },
  { href: '/rules', label: 'Rules', icon: ListChecks },
  { href: '/incidents', label: 'Incidents', icon: AlertTriangle },
  { href: '/assistant', label: 'Assistant', icon: Bot },
];

// The sidebar's collapsed state is kept in localStorage. Read it as an external
// store (the server renders it expanded) instead of copying it into state in an
// effect. 'storage' covers other tabs; SIDEBAR_EVENT covers this tab.
const SIDEBAR_KEY = 'sidebarCollapsed';
const SIDEBAR_EVENT = 'sidebar-collapsed-change';

function subscribeToSidebar(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(SIDEBAR_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(SIDEBAR_EVENT, onChange);
  };
}

const isSidebarCollapsed = () => localStorage.getItem(SIDEBAR_KEY) === '1';

export function AppShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribeToSidebar, isSidebarCollapsed, () => false);
  const [openIncidents, setOpenIncidents] = useState<number | null>(null);

  useEffect(() => {
    apiClient
      .get<{ openIncidents: number }>('/incidents/dashboard-summary')
      .then((d) => setOpenIncidents(d.openIncidents))
      .catch(() => setOpenIncidents(null));
  }, []);

  function toggleCollapsed() {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? '0' : '1');
    window.dispatchEvent(new Event(SIDEBAR_EVENT));
  }

  const sidebarWidth = collapsed ? 'w-16' : 'w-60';
  const contentMargin = collapsed ? 'ml-16' : 'ml-60';

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-20 flex ${sidebarWidth} flex-col border-r border-white/10 bg-[oklch(0.16_0.01_265)] transition-[width] duration-200`}
      >
        <div className="flex h-14 items-center gap-2.5 px-5">
          <div
            className="flex size-7 shrink-0 items-center justify-center rounded-lg shadow-sm"
            style={{ background: 'oklch(0.62 0.19 265)' }}
          >
            <ShieldCheck className="size-4 text-white" strokeWidth={2.25} />
          </div>
          {!collapsed && (
                        <span className="truncate text-[15px] font-bold tracking-tight text-slate-100">
              InfraSentinel
            </span>
          )}
        </div>

        <nav className="flex-1 space-y-0.5 px-3 py-4">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || pathname?.startsWith(item.href + '/');
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                                className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-semibold transition-colors ${
                  collapsed ? 'justify-center' : ''
                } ${
                  active
                    ? 'bg-white/[0.08] text-slate-100'
                    : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                }`}
              >
                <Icon className="size-4 shrink-0" strokeWidth={1.9} />
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-3">
          <button
            onClick={toggleCollapsed}
                            className={`flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-semibold transition-colors ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            {collapsed ? (
              <ChevronsRight className="size-4 shrink-0" strokeWidth={1.9} />
            ) : (
              <>
                <ChevronsLeft className="size-4 shrink-0" strokeWidth={1.9} />
                Collapse
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className={`flex-1 transition-[margin] duration-200 ${contentMargin}`}>
        {/* Topbar */}
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-border bg-background/95 px-8 backdrop-blur">
                    <h1 className="text-[21px] font-bold tracking-tight text-foreground">{title}</h1>
          <div className="flex items-center gap-3">
            <Link
              href="/incidents"
              className="relative flex size-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Open incidents"
              title="Open incidents"
            >
              <Bell className="size-4" strokeWidth={1.9} />
              {openIncidents !== null && openIncidents > 0 && (
                <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {openIncidents > 9 ? '9+' : openIncidents}
                </span>
              )}
            </Link>
            <ThemeToggle />
            <ProfileMenu />
          </div>
        </header>

        <main className="px-8 py-6">{children}</main>
      </div>
    </div>
  );
}