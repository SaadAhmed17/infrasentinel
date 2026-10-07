'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Bot, ChevronDown, CircleCheck, RotateCcw, Search } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/app-shell';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { LiveIndicator } from '@/components/ui/live-indicator';
import { Notice } from '@/components/ui/notice';
import { Panel } from '@/components/ui/panel';
import { RelativeTime, useNow } from '@/components/ui/relative-time';
import { SkeletonRows } from '@/components/ui/skeleton';
import { IncidentStatusBadge, SeverityBadge } from '@/components/ui/status';
import { FilterTabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { alertDetailRows } from '@/lib/alert-details';
import { apiClient } from '@/lib/api-client';
import { friendlyError } from '@/lib/errors';
import { formatDate, formatDateTime, plural } from '@/lib/format';
import { incidentTitle, isOpenIncident } from '@/lib/incidents';
import { canManageSecurity } from '@/lib/permissions';
import { refreshOpenIncidents } from '@/lib/shell-store';
import { cn } from '@/lib/utils';

interface Alert {
  id: string;
  status: string;
  details: Record<string, unknown>;
  serverId: string | null;
  rule: { name: string; ruleType: string };
  server: { name: string } | null;
  createdAt: string;
}

interface Incident {
  id: string;
  title: string;
  severity: string;
  status: string;
  alerts: Alert[];
  createdAt: string;
}

type Tab = 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'ALL';
const REFRESH_MS = 15_000;

const TAB_EMPTY: Record<Tab, { title: string; description?: string }> = {
  OPEN: { title: 'All clear', description: 'No open incidents. New ones appear here as soon as a rule fires.' },
  INVESTIGATING: { title: 'Nothing under investigation' },
  RESOLVED: { title: 'No resolved incidents yet' },
  ALL: { title: 'No incidents' },
};

function inTab(incident: Incident, tab: Tab) {
  if (tab === 'ALL') return true;
  if (tab === 'OPEN') return isOpenIncident(incident.status);
  return incident.status === tab;
}

/** "Today", "Yesterday", or the date. */
function dayLabel(date: string, now: number) {
  const day = new Date(date);
  const today = new Date(now);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((startOf(today) - startOf(day)) / 86_400_000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return formatDate(day);
}

function serverNames(incident: Incident) {
  return [...new Set(incident.alerts.map((a) => a.server?.name).filter((n): n is string => !!n))];
}

function askLink(incident: Incident) {
  const q = `Explain the incident "${incidentTitle(incident.title)}" from ${formatDateTime(incident.createdAt)}.`;
  return `/assistant?q=${encodeURIComponent(q)}`;
}

function AlertItem({ alert, last, single }: { alert: Alert; last: boolean; single: boolean }) {
  const [showDetails, setShowDetails] = useState(single);
  const rows = alertDetailRows(alert.details);
  const resolved = alert.status === 'RESOLVED';
  return (
    <li className="relative pl-7">
      {!last && <span className="absolute left-[6px] top-5 h-[calc(100%+0.25rem)] w-px bg-border-strong" aria-hidden />}
      <span
        aria-hidden
        className={cn('absolute left-0 top-1.5 size-[13px] rounded-full border-2', resolved ? 'border-status-online bg-status-online/25' : 'border-sev-critical bg-sev-critical/20')}
      />
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-foreground">{alert.rule.name}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-muted-foreground">
            {alert.serverId && alert.server ? (
              <Link href={`/servers/${alert.serverId}`} className="font-mono text-[12px] text-foreground underline-offset-2 hover:underline">
                {alert.server.name}
              </Link>
            ) : (
              <span>Account or IP based</span>
            )}
            <span aria-hidden>·</span>
            <span className="whitespace-nowrap">{formatDateTime(alert.createdAt, true)}</span>
            <span aria-hidden>·</span>
            <span>{resolved ? 'Resolved' : 'Open'}</span>
          </p>
        </div>
        {rows.length > 0 && (
          <Button size="xs" variant="ghost" onClick={() => setShowDetails((v) => !v)} aria-expanded={showDetails}>
            {showDetails ? 'Hide details' : 'Details'}
          </Button>
        )}
      </div>
      {showDetails && rows.length > 0 && (
        <dl className="mt-3 grid overflow-hidden rounded-lg border border-border text-[13px] sm:grid-cols-[minmax(10rem,auto)_1fr]">
          {rows.map((row, i) => (
            <div key={row.label + i} className={cn('contents', i > 0 && '[&>*]:border-t [&>*]:border-border max-sm:[&>dd]:border-t-0')}>
              <dt className="bg-surface-2/70 px-3 pt-2 text-[12.5px] font-medium text-muted-foreground sm:py-2">{row.label}</dt>
              <dd className={cn('break-words bg-surface-2/70 px-3 pb-2 text-foreground sm:bg-transparent sm:py-2', row.mono && 'font-mono text-[12.5px]')}>
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  );
}

function IncidentRow({
  incident,
  expanded,
  onToggle,
  canChange,
  busy,
  onStatus,
}: {
  incident: Incident;
  expanded: boolean;
  onToggle: () => void;
  canChange: boolean;
  busy: boolean;
  onStatus: (status: string) => void;
}) {
  const servers = serverNames(incident);
  const resolved = incident.status === 'RESOLVED';
  const title = incidentTitle(incident.title);
  return (
    <li id={`incident-${incident.id}`} className="scroll-mt-24">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={cn(
          'flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors duration-[120ms] hover:bg-accent/40 sm:items-center sm:gap-4 sm:px-5',
          expanded && 'bg-accent/30',
        )}
      >
        <SeverityBadge severity={incident.severity} compact className="mt-0.5 sm:mt-0" />
        <span className="min-w-0 flex-1">
          <span className={cn('block text-[14.5px] font-semibold sm:truncate', resolved ? 'text-muted-foreground' : 'text-foreground')}>{title}</span>
          {/* phones: the status only when it isn't plain "Open" */}
          {incident.status !== 'OPEN' && <IncidentStatusBadge status={incident.status} className="my-1 sm:hidden" />}
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-muted-foreground">
            {servers.length > 0 ? (
              <span className="font-mono text-[12px]">{servers.length > 2 ? `${servers.slice(0, 2).join(', ')} +${servers.length - 2}` : servers.join(', ')}</span>
            ) : (
              <span>Account or IP based</span>
            )}
            <span className="flex items-center gap-2 whitespace-nowrap">
              <span aria-hidden>·</span>
              {plural(incident.alerts.length, 'alert')}
              <span aria-hidden>·</span>
              <RelativeTime value={incident.createdAt} />
            </span>
          </span>
        </span>
        <IncidentStatusBadge status={incident.status} className="hidden shrink-0 sm:inline-flex" />
        <ChevronDown
          className={cn('mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform duration-150 sm:mt-0', expanded && 'rotate-180')}
          strokeWidth={1.75}
          aria-hidden
        />
      </button>

      {expanded && (
        <div className="animate-fade-up border-t border-border px-4 pb-5 pt-4 sm:px-5 sm:pl-[3.25rem]">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <IncidentStatusBadge status={incident.status} className="sm:hidden" />
            <p className="text-[13px] text-muted-foreground">
              <SeverityBadge severity={incident.severity} className="mr-2 align-middle" />
              Opened {formatDateTime(incident.createdAt)}
            </p>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {canChange && incident.status === 'OPEN' && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => onStatus('INVESTIGATING')}>
                <Search />
                Start investigating
              </Button>
            )}
            {canChange && !resolved && (
              <Button size="sm" disabled={busy} onClick={() => onStatus('RESOLVED')}>
                <CircleCheck />
                Mark resolved
              </Button>
            )}
            {canChange && resolved && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => onStatus('OPEN')}>
                <RotateCcw />
                Reopen
              </Button>
            )}
            <Link href={askLink(incident)} className={buttonVariants({ size: 'sm', variant: 'ghost' })}>
              <Bot />
              Ask the assistant
            </Link>
          </div>

          <p className="text-label mb-3 mt-6">Alerts in this incident ({incident.alerts.length})</p>
          <ul className="space-y-4">
            {incident.alerts.map((alert, i) => (
              <AlertItem key={alert.id} alert={alert} last={i === incident.alerts.length - 1} single={incident.alerts.length === 1} />
            ))}
          </ul>
        </div>
      )}
    </li>
  );
}

function IncidentsContent() {
  const { user } = useAuth();
  const toast = useToast();
  const now = useNow();
  const openParam = useSearchParams().get('open');
  const canChange = canManageSecurity(user?.role);
  const [incidents, setIncidents] = useState<Incident[] | null>(null);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [tab, setTab] = useState<Tab>('OPEN');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [scrollTo, setScrollTo] = useState<string | null>(null);
  const [linkHandled, setLinkHandled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    function load() {
      apiClient
        .get<Incident[]>('/incidents')
        .then((list) => {
          if (cancelled) return;
          setIncidents(list);
          setError('');
          setUpdatedAt(Date.now());
        })
        .catch((err) => !cancelled && setError(friendlyError(err)));
    }
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [attempt]);

  // /incidents?open=<id>: show that incident's tab, open it and scroll to it (once)
  if (incidents && openParam && !linkHandled) {
    const target = incidents.find((i) => i.id === openParam);
    setLinkHandled(true);
    if (target) {
      setTab(isOpenIncident(target.status) ? 'OPEN' : 'RESOLVED');
      setExpandedId(target.id);
      setScrollTo(target.id);
    }
  }

  useEffect(() => {
    if (!scrollTo) return;
    document.getElementById(`incident-${scrollTo}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [scrollTo]);

  async function changeStatus(incident: Incident, status: string) {
    const previous = incident.status;
    setBusyId(incident.id);
    setIncidents((list) => list?.map((i) => (i.id === incident.id ? { ...i, status } : i)) ?? null);
    try {
      await apiClient.patch(`/incidents/${incident.id}/status`, { status });
      toast.success(status === 'RESOLVED' ? 'Marked resolved' : status === 'OPEN' ? 'Reopened' : 'Investigation started', incidentTitle(incident.title));
      refreshOpenIncidents();
    } catch (err) {
      setIncidents((list) => list?.map((i) => (i.id === incident.id ? { ...i, status: previous } : i)) ?? null);
      toast.error("Couldn't change the status", friendlyError(err));
    } finally {
      setBusyId(null);
    }
  }

  const list = incidents ?? [];
  const count = (t: Tab) => list.filter((i) => inTab(i, t)).length;
  const shown = list.filter((i) => inTab(i, tab)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const groups: { label: string; items: Incident[] }[] = [];
  for (const incident of shown) {
    const label = now ? dayLabel(incident.createdAt, now) : formatDate(incident.createdAt);
    const group = groups[groups.length - 1];
    if (group?.label === label) group.items.push(incident);
    else groups.push({ label, items: [incident] });
  }
  const openCount = count('OPEN');

  return (
    <AppShell
      title="Incidents"
      description="Related alerts are grouped into one incident. Resolve it once the cause is handled."
      meta={
        incidents && (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{openCount === 0 ? 'None open' : `${openCount} open`}</span>
            <span aria-hidden className="h-3.5 w-px bg-border-strong" />
            <LiveIndicator state={error ? 'paused' : 'live'} every="15 s" updatedAt={updatedAt} />
          </span>
        )
      }
    >
      <div className="space-y-5 sm:space-y-6">
        {error && incidents && (
          <Notice
            tone="error"
            action={
              <Button size="xs" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
                Try again
              </Button>
            }
          >
            {error}
          </Notice>
        )}

        {incidents && incidents.length > 0 && (
          <FilterTabs
            label="Show incidents"
            value={tab}
            onValueChange={(value) => setTab(value as Tab)}
            tabs={[
              { value: 'OPEN', label: 'Open', count: openCount },
              { value: 'INVESTIGATING', label: 'Investigating', count: count('INVESTIGATING') },
              { value: 'RESOLVED', label: 'Resolved', count: count('RESOLVED') },
              { value: 'ALL', label: 'All', count: list.length },
            ]}
          />
        )}

        <Panel flush>
          {!incidents ? (
            error ? (
              <EmptyState
                icon={AlertCircle}
                tone="error"
                title="Couldn't load incidents"
                description={error}
                action={
                  <Button size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
                    Try again
                  </Button>
                }
              />
            ) : (
              <SkeletonRows rows={5} />
            )
          ) : incidents.length === 0 ? (
            <EmptyState art="incidents" title="No incidents yet" description="They're created automatically when a rule fires." />
          ) : shown.length === 0 ? (
            <EmptyState
              icon={tab === 'OPEN' ? CircleCheck : undefined}
              tone={tab === 'OPEN' ? 'positive' : 'default'}
              title={TAB_EMPTY[tab].title}
              description={TAB_EMPTY[tab].description}
              className="py-10"
              action={
                tab !== 'ALL' && (
                  <Button size="sm" variant="outline" onClick={() => setTab('ALL')}>
                    Show all incidents
                  </Button>
                )
              }
            />
          ) : (
            groups.map((group, gi) => (
              <section key={group.label} aria-label={group.label}>
                <h2
                  className={cn(
                    'text-label sticky top-14 z-[1] border-b border-border bg-card/95 px-4 py-2 backdrop-blur-sm sm:px-5 md:top-16',
                    gi === 0 ? 'rounded-t-[calc(var(--radius-xl)-1px)]' : 'border-t',
                  )}
                >
                  {group.label}
                </h2>
                <ul className="divide-y divide-border">
                  {group.items.map((incident) => (
                    <IncidentRow
                      key={incident.id}
                      incident={incident}
                      expanded={expandedId === incident.id}
                      onToggle={() => setExpandedId(expandedId === incident.id ? null : incident.id)}
                      canChange={canChange}
                      busy={busyId === incident.id}
                      onStatus={(status) => changeStatus(incident, status)}
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
          {incidents && incidents.length > 0 && !canChange && (
            <p className="border-t border-border px-4 py-3.5 text-[13.5px] text-muted-foreground sm:px-5">
              View only. Owners, admins and security analysts can change an incident&apos;s status.
            </p>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}

export default function IncidentsPage() {
  return (
    <ProtectedRoute>
      {/* useSearchParams (?open=<id> deep links) needs a Suspense boundary */}
      <Suspense fallback={null}>
        <IncidentsContent />
      </Suspense>
    </ProtectedRoute>
  );
}
