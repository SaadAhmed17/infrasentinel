'use client';

import { useEffect, useSyncExternalStore, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bot,
  LayoutDashboard,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  Server,
  Siren,
  type LucideIcon,
} from 'lucide-react';
import { AppBackground } from '@/components/app-background';
import { Logo, LogoMark } from '@/components/brand/logo';
import { ProfileMenu } from '@/components/profile-menu';
import { ThemeToggle } from '@/components/theme-toggle';
import { PageHeader } from '@/components/ui/page-header';
import { Tooltip } from '@/components/ui/tooltip';
import { loadOrganization, refreshOpenIncidents, useShellState } from '@/lib/shell-store';
import { useMediaQuery } from '@/lib/use-media-query';
import { cn } from '@/lib/utils';

interface NavItem {
  href: string;
  label: string;
  /** Label under the icon in the phone tab bar. */
  short: string;
  icon: LucideIcon;
  showIncidentCount?: boolean;
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', short: 'Dashboard', icon: LayoutDashboard },
  { href: '/servers', label: 'Servers', short: 'Servers', icon: Server },
  { href: '/incidents', label: 'Incidents', short: 'Incidents', icon: Siren, showIncidentCount: true },
  { href: '/rules', label: 'Rules', short: 'Rules', icon: ListChecks },
  { href: '/assistant', label: 'AI assistant', short: 'Assistant', icon: Bot },
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

// UTC clock for the top bar (rule business hours are set in UTC). Minutes only,
// so nothing in the top bar moves every second.
function subscribeToClock(onChange: () => void) {
  const timer = window.setInterval(onChange, 15_000);
  return () => window.clearInterval(timer);
}

const utcTime = () => new Date().toISOString().slice(11, 16);

function UtcClock() {
  const time = useSyncExternalStore(subscribeToClock, utcTime, () => '');
  return (
    <Tooltip content="Coordinated Universal Time. Rule business hours use UTC.">
      <span
        tabIndex={0}
        className="hidden h-9 items-center gap-1.5 rounded-lg px-2 text-[13px] tabular-nums text-muted-foreground lg:inline-flex"
      >
        <span className="font-medium">UTC</span>
        <span className="min-w-[2.6rem] text-foreground">{time}</span>
      </span>
    </Tooltip>
  );
}

function isActive(pathname: string | null, href: string) {
  return pathname === href || pathname?.startsWith(href + '/');
}

function countLabel(count: number) {
  return count > 99 ? '99+' : String(count);
}

export function AppShell({
  children,
  title,
  description,
  meta,
  back,
  actions,
}: {
  children: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  back?: { href: string; label: string };
  actions?: ReactNode;
}) {
  const pathname = usePathname();
  const collapsed = useSyncExternalStore(subscribeToSidebar, isSidebarCollapsed, () => false);
  const wide = useMediaQuery('(min-width: 1024px)');
  const { openIncidents } = useShellState();
  const incidentCount = openIncidents && openIncidents > 0 ? openIncidents : null;
  // Widths and labels come from CSS (rail below 1024 px or when collapsed);
  // the screen-size check only decides whether the rail needs tooltips.
  const showLabels = wide && !collapsed;
  const labelClass = collapsed ? 'hidden' : 'hidden lg:inline';

  useEffect(() => {
    loadOrganization();
    refreshOpenIncidents();
    const timer = window.setInterval(refreshOpenIncidents, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  function toggleCollapsed() {
    localStorage.setItem(SIDEBAR_KEY, collapsed ? '0' : '1');
    window.dispatchEvent(new Event(SIDEBAR_EVENT));
  }

  return (
    <div className="relative min-h-screen">
      <a
        href="#main"
        className="sr-only z-[70] rounded-md bg-primary px-3 py-2 text-[14px] font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to content
      </a>
      <AppBackground intensity="plain" />

      {/* sidebar: icon rail on tablets, full width on desktop (collapsible) */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-sidebar-border bg-sidebar/95 backdrop-blur-md transition-[width] duration-200 md:flex',
          collapsed ? 'w-[72px]' : 'w-[72px] lg:w-[248px]',
        )}
      >
        <div className={cn('flex h-16 shrink-0 items-center justify-center border-b border-sidebar-border', !collapsed && 'lg:justify-start lg:px-5')}>
          <Link href="/dashboard" aria-label="InfraSentinel dashboard" className="flex items-center rounded-md">
            <LogoMark className={cn('w-[26px]', !collapsed && 'lg:hidden')} />
            {!collapsed && <Logo className="hidden lg:inline-flex" markClassName="w-[26px]" wordmarkClassName="text-[18px]" />}
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main">
          <ul className="space-y-1">
            {NAV.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              const count = item.showIncidentCount ? incidentCount : null;
              const link = (
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  aria-label={showLabels ? undefined : count ? `${item.label}, ${count} open` : item.label}
                  className={cn(
                    'relative flex h-10 items-center justify-center gap-3 rounded-lg px-3 text-[14px] font-medium transition-colors duration-[120ms]',
                    !collapsed && 'lg:justify-start',
                    active ? 'bg-sidebar-accent text-foreground' : 'text-muted-foreground hover:bg-sidebar-accent/70 hover:text-foreground',
                  )}
                >
                  {active && <span aria-hidden className="absolute -left-3 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary-bright" />}
                  <Icon className={cn('size-[18px] shrink-0', active && 'text-primary-bright')} strokeWidth={1.75} aria-hidden />
                  <span className={cn('flex-1 truncate', labelClass)}>{item.label}</span>
                  {count !== null && (
                    <>
                      <span
                        className={cn(
                          'min-w-5 rounded-md bg-sev-critical/15 px-1.5 text-center text-[11.5px] font-semibold tabular-nums leading-5 text-sev-critical',
                          labelClass,
                        )}
                      >
                        {countLabel(count)}
                        <span className="sr-only"> open</span>
                      </span>
                      <span
                        aria-hidden
                        className={cn('absolute right-2 top-2 size-1.5 rounded-full bg-sev-critical', !collapsed && 'lg:hidden')}
                      />
                    </>
                  )}
                </Link>
              );
              return (
                <li key={item.href}>
                  <Tooltip side="right" disabled={showLabels} content={count ? `${item.label} (${countLabel(count)} open)` : item.label}>
                    {link}
                  </Tooltip>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="hidden border-t border-sidebar-border p-3 lg:block">
          <button
            onClick={toggleCollapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={cn(
              'flex h-9 w-full items-center gap-3 rounded-lg px-3 text-[13.5px] font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground',
              collapsed && 'justify-center',
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
            ) : (
              <>
                <PanelLeftClose className="size-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                Collapse
              </>
            )}
          </button>
        </div>
      </aside>

      <div
        className={cn(
          'relative z-10 flex min-h-screen flex-col transition-[padding] duration-200',
          collapsed ? 'md:pl-[72px]' : 'md:pl-[72px] lg:pl-[248px]',
        )}
      >
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6 md:h-16 lg:px-10">
          {/* phones have no sidebar, so the logo lives in the top bar */}
          <Link href="/dashboard" aria-label="InfraSentinel dashboard" className="flex items-center rounded-md md:hidden">
            <Logo markClassName="w-[22px]" wordmarkClassName="text-[16px]" />
          </Link>
          <div className="hidden md:block" />
          <div className="flex items-center gap-2">
            <UtcClock />
            <ThemeToggle />
            <ProfileMenu />
          </div>
        </header>

        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1400px] flex-1 animate-fade-up px-4 pb-28 pt-5 outline-none sm:px-6 sm:pt-7 md:pb-10 lg:px-10"
        >
          <PageHeader title={title} description={description} meta={meta} back={back} actions={actions} />
          {children}
        </main>
      </div>

      {/* phones: the five sections as a bottom tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <ul className="grid grid-cols-5">
          {NAV.map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            const count = item.showIncidentCount ? incidentCount : null;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors',
                    active ? 'text-primary-bright' : 'text-muted-foreground',
                  )}
                >
                  {active && <span aria-hidden className="absolute inset-x-5 top-0 h-0.5 rounded-b-full bg-primary-bright" />}
                  <span className="relative">
                    <Icon className="size-5" strokeWidth={1.75} aria-hidden />
                    {count !== null && (
                      <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sev-critical px-1 text-[10px] font-bold tabular-nums leading-none text-white ring-2 ring-background">
                        {count > 9 ? '9+' : count}
                        <span className="sr-only"> open</span>
                      </span>
                    )}
                  </span>
                  {item.short}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
