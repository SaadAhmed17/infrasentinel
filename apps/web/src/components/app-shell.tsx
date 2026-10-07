'use client';

import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AlertTriangle,
  Bell,
  Bot,
  LayoutDashboard,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  Server,
  type LucideIcon,
} from 'lucide-react';
import { AppBackground } from '@/components/app-background';
import { Logo, LogoMark } from '@/components/brand/logo';
import { ProfileMenu } from '@/components/profile-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { PageHeader } from '@/components/ui/page-header';
import { apiClient } from '@/lib/api-client';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  showIncidentCount?: boolean;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: 'Operations',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/servers', label: 'Servers', icon: Server },
      { href: '/incidents', label: 'Incidents', icon: AlertTriangle, showIncidentCount: true },
    ],
  },
  { label: 'Detection', items: [{ href: '/rules', label: 'Rules', icon: ListChecks }] },
  { label: 'Intelligence', items: [{ href: '/assistant', label: 'AI assistant', icon: Bot }] },
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

// UTC clock for the top bar: rule business hours are set in UTC.
function subscribeToClock(onChange: () => void) {
  const timer = window.setInterval(onChange, 1000);
  return () => window.clearInterval(timer);
}

const utcTime = () => new Date().toISOString().slice(11, 19);

function UtcClock() {
  const time = useSyncExternalStore(subscribeToClock, utcTime, () => '');
  return (
    <span
      className="hidden h-9 items-center gap-2 rounded-lg border border-border bg-surface-2/50 px-3 font-mono text-[12.5px] tabular-nums text-muted-foreground md:inline-flex"
      title="Coordinated Universal Time — rule business hours use UTC"
    >
      <span className="text-[10.5px] font-semibold tracking-[0.14em] text-primary-bright">UTC</span>
      <span className="min-w-[4.75rem] text-foreground">{time}</span>
    </span>
  );
}

function findSection(pathname: string | null) {
  for (const group of NAV_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.href || pathname?.startsWith(item.href + '/')) return { group, item };
    }
  }
  return null;
}

export function AppShell({
  children,
  title,
  description,
  actions,
}: {
  children: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribeToSidebar, isSidebarCollapsed, () => false);
  const [openIncidents, setOpenIncidents] = useState<number | null>(null);
  const section = findSection(pathname);

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

  // Below the lg breakpoint the sidebar always shows icons only.
  const labelClass = collapsed ? 'hidden' : 'hidden lg:inline';
  const incidentCount = openIncidents && openIncidents > 0 ? openIncidents : null;

  return (
    <div className="relative min-h-screen">
      <AppBackground intensity="plain" />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex flex-col border-r border-sidebar-border bg-sidebar/95 backdrop-blur-md transition-[width] duration-200',
          collapsed ? 'w-[72px]' : 'w-[72px] lg:w-[248px]',
        )}
      >
        <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-5">
          <Link href="/dashboard" aria-label="InfraSentinel dashboard" className="flex items-center rounded-md">
            {collapsed ? (
              <LogoMark className="w-[26px]" />
            ) : (
              <>
                <LogoMark className="w-[26px] lg:hidden" />
                <Logo className="hidden lg:inline-flex" markClassName="w-[26px]" wordmarkClassName="text-[18px]" />
              </>
            )}
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5" aria-label="Main">
          {NAV_GROUPS.map((group, index) => (
            <div key={group.label} className={cn(index > 0 && 'mt-6')}>
              <p className={cn('hud-label mb-2 px-3', labelClass)}>{group.label}</p>
              {index > 0 && <div className={cn('mx-3 mb-3 h-px bg-sidebar-border', collapsed ? 'block' : 'lg:hidden')} />}
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const active = section?.item.href === item.href;
                  const Icon = item.icon;
                  const count = item.showIncidentCount ? incidentCount : null;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={item.label}
                        aria-current={active ? 'page' : undefined}
                        className={cn(
                          'group relative flex h-10 items-center gap-3 rounded-lg px-3 text-[14px] font-medium transition-colors',
                          collapsed ? 'justify-center' : 'justify-center lg:justify-start',
                          active
                            ? 'bg-sidebar-accent text-foreground'
                            : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground',
                        )}
                      >
                        {active && (
                          <span
                            aria-hidden
                            className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary-bright dark:shadow-[0_0_12px_var(--primary-bright)]"
                          />
                        )}
                        <Icon
                          className={cn('size-[18px] shrink-0', active ? 'text-primary-bright' : '')}
                          strokeWidth={1.8}
                        />
                        <span className={cn('flex-1 truncate', labelClass)}>{item.label}</span>
                        {count !== null && (
                          <>
                            <span
                              className={cn(
                                'min-w-5 rounded-md bg-sev-critical/15 px-1.5 text-center font-mono text-[11px] font-semibold leading-5 text-sev-critical',
                                labelClass,
                              )}
                            >
                              {count > 99 ? '99+' : count}
                            </span>
                            <span
                              aria-hidden
                              className={cn(
                                'absolute right-2 top-2 size-1.5 rounded-full bg-sev-critical',
                                collapsed ? 'block' : 'lg:hidden',
                              )}
                            />
                          </>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="hidden border-t border-sidebar-border p-3 lg:block">
          <button
            onClick={toggleCollapsed}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex h-9 w-full items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground',
              collapsed && 'justify-center',
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[18px] shrink-0" strokeWidth={1.8} />
            ) : (
              <>
                <PanelLeftClose className="size-[18px] shrink-0" strokeWidth={1.8} />
                Collapse
              </>
            )}
          </button>
        </div>
      </aside>

      <div
        className={cn(
          'relative z-10 flex min-h-screen flex-col transition-[padding] duration-200',
          collapsed ? 'pl-[72px]' : 'pl-[72px] lg:pl-[248px]',
        )}
      >
        <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border bg-background/75 px-6 backdrop-blur-md lg:px-10">
          <p className="hud-label truncate">
            {section ? (
              <>
                {section.group.label}
                <span className="mx-2 text-border-strong">/</span>
                <span className="text-foreground">{section.item.label}</span>
              </>
            ) : (
              title
            )}
          </p>
          <div className="flex items-center gap-2">
            <UtcClock />
            <Link
              href="/incidents"
              className="relative flex size-9 items-center justify-center rounded-lg border border-border bg-surface-2/50 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label={incidentCount ? `Open incidents: ${incidentCount}` : 'Open incidents'}
              title="Open incidents"
            >
              <Bell className="size-[17px]" strokeWidth={1.8} />
              {incidentCount !== null && (
                <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-sev-critical px-1 font-mono text-[10px] font-bold text-white ring-2 ring-background">
                  {incidentCount > 9 ? '9+' : incidentCount}
                </span>
              )}
            </Link>
            <ThemeToggle />
            <ProfileMenu />
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] flex-1 animate-fade-up px-6 py-8 lg:px-10">
          <PageHeader title={title} description={description} actions={actions} />
          {children}
        </main>
      </div>
    </div>
  );
}
