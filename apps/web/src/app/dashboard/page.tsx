'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { AlertCircle, CircleCheck, UserPlus, X } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/app-shell';
import { SetupChecklist, SetupReminder, type SetupStep } from '@/components/dashboard/setup-checklist';
import { Button, buttonVariants } from '@/components/ui/button';
import { CopyField } from '@/components/ui/copy-button';
import { EmptyState } from '@/components/ui/empty-state';
import { fieldControlClass, fieldLabelClass, fieldSelectClass } from '@/components/ui/form-styles';
import { LiveIndicator } from '@/components/ui/live-indicator';
import { Notice } from '@/components/ui/notice';
import { Panel } from '@/components/ui/panel';
import { RelativeTime } from '@/components/ui/relative-time';
import { Skeleton, SkeletonRows } from '@/components/ui/skeleton';
import { IncidentStatusBadge, SeverityBadge, StatusDot, serverStatusLabel } from '@/components/ui/status';
import { useToast } from '@/components/ui/toast';
import { TONE_COLOR, type Tone } from '@/components/ui/tone';
import { Tooltip } from '@/components/ui/tooltip';
import { apiClient } from '@/lib/api-client';
import { friendlyError, NETWORK_ERROR_MESSAGE } from '@/lib/errors';
import { formatDate, formatRelative, formatTime, plural, initialsFromEmail } from '@/lib/format';
import { bySeverityThenRecent, incidentTitle, isOpenIncident } from '@/lib/incidents';
import { canManageSecurity, canManageServers } from '@/lib/permissions';
import { ROLE_LABELS, roleLabel } from '@/lib/roles';
import { RULE_TEMPLATES, templatePayload } from '@/lib/rule-templates';
import { useShellState } from '@/lib/shell-store';
import { useStoredFlag } from '@/lib/use-stored-flag';
import { cn } from '@/lib/utils';

interface RecentAlert {
  id: string;
  createdAt: string;
  incidentId: string | null;
  serverId: string | null;
  rule: { name: string; severity: string };
  server: { name: string } | null;
}
interface DashboardSummary {
  servers: { total: number; online: number; offline: number };
  openIncidents: number;
  activeRules: number;
  recentAlerts: RecentAlert[];
}
interface IncidentRow {
  id: string;
  title: string;
  severity: string;
  status: string;
  createdAt: string;
  alerts: { id: string; serverId: string | null; server: { name: string } | null }[];
}
interface ServerRow {
  id: string;
  name: string;
  status: string;
  lastHeartbeat: string | null;
}
interface RuleRow {
  id: string;
  name: string;
  isActive: boolean;
}
interface Member {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

interface DashboardData {
  summary: DashboardSummary | null;
  incidents: IncidentRow[] | null;
  servers: ServerRow[] | null;
  rules: RuleRow[] | null;
  members: Member[] | null;
}
type Resource = keyof DashboardData;

const ENDPOINTS: Record<Resource, string> = {
  summary: '/incidents/dashboard-summary',
  incidents: '/incidents',
  servers: '/servers',
  rules: '/rules',
  members: '/organizations/members',
};
// Refreshed every 15 s; rules and members change rarely and load once.
const LIVE: Resource[] = ['summary', 'incidents', 'servers'];
const ALL: Resource[] = [...LIVE, 'rules', 'members'];
const REFRESH_MS = 15_000;
const EMPTY_DATA: DashboardData = { summary: null, incidents: null, servers: null, rules: null, members: null };

const SEVERITY_TONE: Record<string, Tone> = { CRITICAL: 'critical', HIGH: 'high', MEDIUM: 'medium', LOW: 'low' };
const SERVER_TONE: Record<string, Tone> = { ONLINE: 'online', OFFLINE: 'offline', UNKNOWN: 'unknown' };
// Problems first in the fleet panel.
const SERVER_ORDER: Record<string, number> = { OFFLINE: 0, UNKNOWN: 1, ONLINE: 2 };
const OPEN_INCIDENTS_SHOWN = 6;
const ROLES = Object.keys(ROLE_LABELS).filter((r) => r !== 'OWNER');

async function fetchResources(names: Resource[]) {
  const results = await Promise.allSettled(names.map((name) => apiClient.get<unknown>(ENDPOINTS[name])));
  const data: Partial<Record<Resource, unknown>> = {};
  const errors: Partial<Record<Resource, string>> = {};
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') data[names[i]] = result.value;
    else errors[names[i]] = friendlyError(result.reason);
  });
  return { data: data as Partial<DashboardData>, errors };
}

/**
 * Loads everything the dashboard shows and keeps the live parts fresh. A failed
 * refresh keeps the last data on screen; `errors` says which requests failed.
 */
function useDashboardData() {
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [errors, setErrors] = useState<Partial<Record<Resource, string>>>({});
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    function refresh(names: Resource[]) {
      fetchResources(names).then((result) => {
        if (cancelled) return;
        setData((prev) => ({ ...prev, ...result.data }));
        setErrors((prev) => {
          const next = { ...prev };
          for (const name of names) {
            if (result.errors[name]) next[name] = result.errors[name];
            else delete next[name];
          }
          return next;
        });
        if (Object.keys(result.errors).length === 0) setUpdatedAt(Date.now());
      });
    }
    refresh(ALL);
    const timer = window.setInterval(() => refresh(LIVE), REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [attempt]);

  async function reload(name: Resource) {
    try {
      const value = await apiClient.get<unknown>(ENDPOINTS[name]);
      setData((prev) => ({ ...prev, [name]: value }));
    } catch {
      // the next scheduled refresh tries again
    }
  }

  return { data, errors, updatedAt, retry: () => setAttempt((n) => n + 1), reload };
}

function serverHint(server: ServerRow, now = Date.now()) {
  if (server.status === 'UNKNOWN') return 'Waiting for first report';
  const status = serverStatusLabel(server.status);
  return server.lastHeartbeat ? `${status}, last report ${formatRelative(server.lastHeartbeat, now)}` : status;
}

function serverNames(incident: IncidentRow) {
  const names = [...new Set(incident.alerts.map((a) => a.server?.name).filter((n): n is string => !!n))];
  if (names.length === 0) return null;
  return names.length > 2 ? `${names.slice(0, 2).join(', ')} +${names.length - 2}` : names.join(', ');
}

/** A coloured dot and a count, e.g. "● 2 critical". */
function CountDot({ tone, count, label, hollow = false }: { tone: Tone; count: number; label: string; hollow?: boolean }) {
  const color = TONE_COLOR[tone];
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span
        aria-hidden
        className="size-1.5 rounded-full"
        style={hollow ? { boxShadow: `inset 0 0 0 1.25px ${color}` } : { background: color }}
      />
      {count} {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Status strip: the four numbers that answer "is anything wrong right now?"

function StripCell({
  href,
  label,
  value,
  suffix,
  sub,
  className,
}: {
  href: string;
  label: string;
  value: ReactNode;
  suffix?: ReactNode;
  sub: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn('flex min-w-0 flex-col gap-2 border-border p-4 transition-colors duration-[120ms] hover:bg-accent/40 sm:p-5', className)}
    >
      <span className="text-label">{label}</span>
      <span className="flex items-baseline gap-1.5 text-[22px] font-semibold leading-none tracking-[-0.02em] text-foreground sm:text-[24px] xl:text-[28px]">
        {value}
        {suffix && <span className="text-[14px] font-medium tracking-normal text-muted-foreground">{suffix}</span>}
      </span>
      <span className="flex min-h-5 flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] leading-5 text-muted-foreground">{sub}</span>
    </Link>
  );
}

function StatusStrip({ data, failed }: { data: DashboardData; failed: Partial<Record<Resource, string>> }) {
  const { summary, incidents, servers, rules } = data;
  const loading = (value: unknown, resource: Resource) => value === null && !failed[resource];
  const dash = <span className="text-muted-foreground">—</span>;
  const pending = <Skeleton className="h-6 w-14" />;
  const unavailable = <span>Not available</span>;

  // 1. open incidents, with a severity breakdown
  const open = incidents?.filter((i) => isOpenIncident(i.status));
  const openCount = open?.length ?? summary?.openIncidents;
  const bySeverity = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']
    .map((severity) => ({ severity, count: open?.filter((i) => i.severity === severity).length ?? 0 }))
    .filter((s) => s.count > 0);

  // 2. servers online
  const online = servers?.filter((s) => s.status === 'ONLINE').length ?? 0;
  const offline = servers?.filter((s) => s.status === 'OFFLINE').length ?? 0;
  const waiting = servers?.filter((s) => s.status === 'UNKNOWN').length ?? 0;

  // 3. active rules
  const activeRules = rules?.filter((r) => r.isActive).length ?? summary?.activeRules;

  // 4. last detection
  const lastAlert = summary?.recentAlerts[0];

  return (
    <Panel brackets flush>
      <div className="grid grid-cols-2 overflow-hidden rounded-[calc(var(--radius-xl)-1px)] sm:grid-cols-4">
        <StripCell
          href="/incidents"
          label="Open incidents"
          className="border-b border-r sm:border-b-0"
          value={openCount ?? (loading(incidents, 'incidents') && loading(summary, 'summary') ? pending : dash)}
          sub={
            openCount === undefined ? (
              loading(incidents, 'incidents') ? null : unavailable
            ) : openCount === 0 ? (
              'All clear'
            ) : bySeverity.length > 0 ? (
              bySeverity
                .slice(0, 3)
                .map((s) => (
                  <CountDot key={s.severity} tone={SEVERITY_TONE[s.severity]} count={s.count} label={s.severity.toLowerCase()} />
                ))
            ) : (
              'Need attention'
            )
          }
        />
        <StripCell
          href="/servers"
          label="Servers online"
          className="border-b sm:border-b-0 sm:border-r"
          value={servers ? (servers.length === 0 ? 'None yet' : online) : loading(servers, 'servers') ? pending : dash}
          suffix={servers && servers.length > 0 ? `of ${servers.length}` : undefined}
          sub={
            !servers ? (
              loading(servers, 'servers') ? null : unavailable
            ) : servers.length === 0 ? (
              'Add a server to start'
            ) : offline + waiting === 0 ? (
              'All reporting'
            ) : (
              <>
                {offline > 0 && <CountDot tone="offline" count={offline} label="offline" />}
                {waiting > 0 && <CountDot tone="unknown" count={waiting} label="waiting" hollow />}
              </>
            )
          }
        />
        <StripCell
          href="/rules"
          label="Active rules"
          className="border-r"
          value={
            rules
              ? rules.length === 0
                ? 'None yet'
                : activeRules
              : activeRules ?? (loading(rules, 'rules') && loading(summary, 'summary') ? pending : dash)
          }
          suffix={rules && rules.length > 0 ? `of ${rules.length}` : undefined}
          sub={
            activeRules === undefined
              ? loading(rules, 'rules')
                ? null
                : unavailable
              : rules && rules.length === 0
                ? 'Add rules to start detecting'
                : activeRules === 0
                  ? 'All rules are off'
                  : 'Checked every 30 s'
          }
        />
        <StripCell
          href={lastAlert?.incidentId ? `/incidents?open=${lastAlert.incidentId}` : '/incidents'}
          label="Last detection"
          value={
            summary ? (
              lastAlert ? (
                <RelativeTime value={lastAlert.createdAt} />
              ) : (
                'None yet'
              )
            ) : loading(summary, 'summary') ? (
              pending
            ) : (
              dash
            )
          }
          sub={
            summary ? (
              lastAlert ? (
                <span className="truncate">{lastAlert.rule.name}</span>
              ) : (
                'No rule has fired yet'
              )
            ) : loading(summary, 'summary') ? null : (
              unavailable
            )
          }
        />
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Panels

function PanelError({ message, onRetry, what }: { message: string; onRetry: () => void; what: string }) {
  return (
    <EmptyState
      icon={AlertCircle}
      tone="error"
      title={`Couldn't load ${what}`}
      description={message}
      className="py-10"
      action={
        <Button size="sm" variant="outline" onClick={onRetry}>
          Try again
        </Button>
      }
    />
  );
}

function PanelFooterLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex h-11 items-center justify-center border-t border-border text-[13.5px] font-semibold text-primary transition-colors duration-[120ms] hover:bg-accent/40"
    >
      {children}
    </Link>
  );
}

function OpenIncidentsPanel({
  incidents,
  error,
  onRetry,
  className,
}: {
  incidents: IncidentRow[] | null;
  error?: string;
  onRetry: () => void;
  className?: string;
}) {
  const open = incidents?.filter((i) => isOpenIncident(i.status)).sort(bySeverityThenRecent) ?? [];
  const shown = open.slice(0, OPEN_INCIDENTS_SHOWN);

  return (
    <Panel title="Open incidents" meta={incidents && open.length > 0 ? open.length : undefined} flush className={className}>
      {!incidents ? (
        error ? (
          <PanelError what="incidents" message={error} onRetry={onRetry} />
        ) : (
          <SkeletonRows rows={4} />
        )
      ) : open.length === 0 ? (
        <>
          <EmptyState
            icon={CircleCheck}
            tone="positive"
            title="All clear"
            description="No open incidents. New ones appear here as soon as a rule fires."
            className="py-10"
          />
          {incidents.length > 0 && <PanelFooterLink href="/incidents">All incidents</PanelFooterLink>}
        </>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {shown.map((incident) => {
              const where = serverNames(incident);
              return (
                <li key={incident.id}>
                  <Link
                    href={`/incidents?open=${incident.id}`}
                    className="flex items-start gap-3 px-4 py-3.5 transition-colors duration-[120ms] hover:bg-accent/40 sm:items-center sm:gap-4 sm:px-5"
                  >
                    <SeverityBadge severity={incident.severity} compact className="mt-px sm:hidden" />
                    <SeverityBadge severity={incident.severity} className="hidden w-[6.5rem] shrink-0 sm:inline-flex" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className="truncate text-[14px] font-semibold text-foreground">{incidentTitle(incident.title)}</p>
                        <IncidentStatusBadge status={incident.status} className="-my-0.5 shrink-0 sm:hidden" />
                      </div>
                      <p className="mt-1 flex min-w-0 items-center gap-2 text-[12.5px] text-muted-foreground">
                        <span className={cn('truncate', where && 'font-mono text-[12px]')}>{where ?? 'Account or IP based'}</span>
                        <span className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                          <span aria-hidden>·</span>
                          {plural(incident.alerts.length, 'alert')}
                          <span aria-hidden>·</span>
                          <RelativeTime value={incident.createdAt} />
                        </span>
                      </p>
                    </div>
                    <IncidentStatusBadge status={incident.status} className="hidden shrink-0 sm:inline-flex" />
                  </Link>
                </li>
              );
            })}
          </ul>
          <PanelFooterLink href="/incidents">
            {open.length > shown.length ? `See all ${open.length} open incidents` : 'All incidents'}
          </PanelFooterLink>
        </>
      )}
    </Panel>
  );
}

// The inner light: filled, or a hollow ring while waiting for a first report.
// --light-glow feeds the dark-theme glow.
function lightStyle(color: string, hollow: boolean) {
  const style: Record<string, string> = { '--light-glow': `color-mix(in oklab, ${color} 60%, transparent)` };
  if (hollow) style.boxShadow = `inset 0 0 0 1.5px ${color}`;
  else style.background = color;
  return style as React.CSSProperties;
}

// One light per server, problems first. Each light links to its server.
function FleetLights({ servers }: { servers: ServerRow[] }) {
  const sorted = [...servers].sort(
    (a, b) => (SERVER_ORDER[a.status] ?? 1) - (SERVER_ORDER[b.status] ?? 1) || a.name.localeCompare(b.name),
  );
  const shown = sorted.slice(0, 60);
  const big = servers.length <= 16;
  return (
    <ul className={cn('flex flex-wrap', big ? 'gap-2' : 'gap-1.5')} aria-label="Servers">
      {shown.map((server) => {
        const color = TONE_COLOR[SERVER_TONE[server.status] ?? 'unknown'];
        const hollow = server.status === 'UNKNOWN';
        const hint = `${server.name}: ${serverHint(server).toLowerCase()}`;
        return (
          <li key={server.id}>
            <Tooltip content={hint}>
              <Link
                href={`/servers/${server.id}`}
                aria-label={hint}
                className={cn(
                  'flex items-center justify-center border transition-transform duration-[120ms] hover:-translate-y-px',
                  big ? 'size-9 rounded-md' : 'size-4 rounded-[3px]',
                )}
                style={{
                  background: `color-mix(in oklab, ${color} 14%, transparent)`,
                  borderColor: `color-mix(in oklab, ${color} 45%, transparent)`,
                }}
              >
                <span
                  className={cn(
                    big ? 'size-3 rounded-[2px]' : 'size-1.5 rounded-[1px]',
                    // lights glow in the dark theme only
                    !hollow && 'dark:shadow-[0_0_6px_var(--light-glow)]',
                  )}
                  style={lightStyle(color, hollow)}
                />
              </Link>
            </Tooltip>
          </li>
        );
      })}
      {servers.length > shown.length && (
        <li className="self-center text-[12.5px] text-muted-foreground">+{servers.length - shown.length} more</li>
      )}
    </ul>
  );
}

function FleetPanel({
  servers,
  error,
  onRetry,
  canAdd,
}: {
  servers: ServerRow[] | null;
  error?: string;
  onRetry: () => void;
  canAdd: boolean;
}) {
  const attention = (servers ?? [])
    .filter((s) => s.status !== 'ONLINE')
    .sort((a, b) => (SERVER_ORDER[a.status] ?? 1) - (SERVER_ORDER[b.status] ?? 1) || a.name.localeCompare(b.name));

  return (
    <Panel
      title="Fleet"
      meta={servers && servers.length > 0 ? plural(servers.length, 'server') : undefined}
      className="min-w-0 xl:self-start"
      flush
    >
      {!servers ? (
        error ? (
          <PanelError what="servers" message={error} onRetry={onRetry} />
        ) : (
          <div className="space-y-4 p-4 sm:p-5" role="status" aria-label="Loading">
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="size-9" />
              ))}
            </div>
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )
      ) : servers.length === 0 ? (
        <EmptyState
          art="server"
          title="No servers yet"
          description="Add a server and start its agent to see it here."
          className="py-10"
          action={
            canAdd && (
              <Link href="/servers?add=1" className={buttonVariants({ size: 'sm' })}>
                Add a server
              </Link>
            )
          }
        />
      ) : (
        <>
          <div className="p-4 sm:p-5">
            <FleetLights servers={servers} />
            <div className="mt-5 border-t border-border pt-4">
              {attention.length === 0 ? (
                <p className="flex items-center gap-2 text-[13.5px] text-foreground">
                  <CircleCheck className="size-4 text-status-online" strokeWidth={1.75} aria-hidden />
                  All servers are reporting.
                </p>
              ) : (
                <>
                  <p className="text-label">Needs attention</p>
                  <ul className="mt-2 space-y-0.5">
                    {attention.slice(0, 5).map((server) => (
                      <li key={server.id}>
                        <Link
                          href={`/servers/${server.id}`}
                          className="-mx-2 flex items-start gap-2.5 rounded-md px-2 py-1.5 transition-colors duration-[120ms] hover:bg-accent/40"
                        >
                          <StatusDot status={server.status} className="mt-[5px]" />
                          <span className="min-w-0">
                            <span className="block truncate font-mono text-[13px] text-foreground">{server.name}</span>
                            <span className="block text-[12.5px] text-muted-foreground">
                              {server.status === 'UNKNOWN' ? (
                                'Waiting for first report'
                              ) : (
                                <>
                                  {serverStatusLabel(server.status)}, last report <RelativeTime value={server.lastHeartbeat} />
                                </>
                              )}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {attention.length > 5 && (
                    <p className="mt-1 text-[12.5px] text-muted-foreground">and {plural(attention.length - 5, 'more server')}</p>
                  )}
                </>
              )}
              <p className="mt-4 text-[12.5px] leading-relaxed text-muted-foreground">Offline means no report for over a minute.</p>
            </div>
          </div>
          <PanelFooterLink href="/servers">Manage servers</PanelFooterLink>
        </>
      )}
    </Panel>
  );
}

function RecentDetectionsPanel({
  summary,
  error,
  onRetry,
}: {
  summary: DashboardSummary | null;
  error?: string;
  onRetry: () => void;
}) {
  return (
    <Panel title="Recent detections" flush>
      {!summary ? (
        error ? (
          <PanelError what="detections" message={error} onRetry={onRetry} />
        ) : (
          <SkeletonRows rows={4} />
        )
      ) : summary.recentAlerts.length === 0 ? (
        <EmptyState
          title="No detections yet"
          description="Each time a rule fires, the alert shows up here and joins an incident."
          className="py-10"
        />
      ) : (
        <ul className="divide-y divide-border">
          {summary.recentAlerts.map((alert) => {
            const row = (
              <>
                <SeverityBadge severity={alert.rule.severity} compact className="mt-px" />
                <span className="min-w-0 flex-1 sm:flex sm:items-center sm:gap-4">
                  <span className="block truncate text-[14px] font-medium text-foreground sm:w-72 sm:shrink-0">{alert.rule.name}</span>
                  <span
                    className={cn(
                      'mt-0.5 block truncate text-muted-foreground sm:mt-0',
                      alert.server ? 'font-mono text-[12px]' : 'text-[12.5px]',
                    )}
                  >
                    {alert.server?.name ?? 'Account or IP based'}
                  </span>
                </span>
                <RelativeTime value={alert.createdAt} className="shrink-0 text-[12.5px] tabular-nums text-muted-foreground" />
              </>
            );
            const rowClass = 'flex items-start gap-3 px-4 py-3 sm:items-center sm:gap-4 sm:px-5';
            return (
              <li key={alert.id}>
                {alert.incidentId ? (
                  <Link
                    href={`/incidents?open=${alert.incidentId}`}
                    className={cn(rowClass, 'transition-colors duration-[120ms] hover:bg-accent/40')}
                  >
                    {row}
                  </Link>
                ) : (
                  <div className={rowClass}>{row}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

// Members and invitations stay here until they move to the Settings page.
function MembersPanel({ members, error, onChanged }: { members: Member[] | null; error?: string; onChanged: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('DEVELOPER');
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const canManageMembers = user?.role === 'OWNER' || user?.role === 'ADMIN';

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteError('');
    try {
      const result = await apiClient.post<{ inviteLink: string }>('/organizations/invitations', {
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteLink(result.inviteLink);
      setInviteEmail('');
    } catch (err) {
      setInviteError(friendlyError(err, "Couldn't create the invitation. Try again."));
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(member: Member, role: string) {
    try {
      await apiClient.patch(`/organizations/members/${member.id}/role`, { role });
      toast.success('Role changed', `${member.email} is now ${roleLabel(role)}.`);
      onChanged();
    } catch (err) {
      toast.error("Couldn't change the role", friendlyError(err));
    }
  }

  return (
    <Panel
      id="team"
      title="Team"
      meta={members ? plural(members.length, 'member') : undefined}
      flush
      actions={
        canManageMembers && (
          <Button size="sm" variant={showInviteForm ? 'outline' : 'default'} onClick={() => setShowInviteForm(!showInviteForm)}>
            {showInviteForm ? <X /> : <UserPlus />}
            {showInviteForm ? 'Close' : 'Invite people'}
          </Button>
        )
      }
    >
      {showInviteForm && (
        <div className="space-y-3 border-b border-border bg-surface-2/50 px-4 py-4 sm:px-5">
          <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3">
            <div className="min-w-0 flex-1 basis-56">
              <label htmlFor="invite-email" className={fieldLabelClass}>
                Email
              </label>
              <input
                id="invite-email"
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                className={fieldControlClass}
              />
            </div>
            <div className="w-full sm:w-56">
              <label htmlFor="invite-role" className={fieldLabelClass}>
                Role
              </label>
              <select id="invite-role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className={fieldSelectClass}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={inviting} className="w-full sm:w-auto">
              {inviting ? 'Creating link…' : 'Create invitation'}
            </Button>
          </form>
          {inviteError && <Notice tone="error">{inviteError}</Notice>}
          {inviteLink && (
            <Notice tone="success">
              <p className="font-medium">Invitation created. Send this link to your colleague:</p>
              <CopyField value={inviteLink} label="Invitation link" ariaLabel="Copy invitation link" />
            </Notice>
          )}
        </div>
      )}

      {!members ? (
        error ? (
          <p className="px-4 py-4 text-[13.5px] text-muted-foreground sm:px-5">{error}</p>
        ) : (
          <SkeletonRows rows={3} />
        )
      ) : (
        <ul className="divide-y divide-border">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[12px] font-semibold text-primary-bright">
                {initialsFromEmail(m.email)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium text-foreground">
                  {m.email}
                  {m.id === user?.userId && <span className="ml-1.5 font-normal text-muted-foreground">(you)</span>}
                </span>
                <span className="block text-[12.5px] text-muted-foreground">Joined {formatDate(m.createdAt)}</span>
              </span>
              {canManageMembers && m.role !== 'OWNER' ? (
                <select
                  value={m.role}
                  onChange={(e) => handleRoleChange(m, e.target.value)}
                  aria-label={`Role of ${m.email}`}
                  className={cn(fieldSelectClass, 'h-9 w-full text-[13.5px] sm:w-48')}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-[13px] font-medium text-muted-foreground">{roleLabel(m.role)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------

type Dashboard = ReturnType<typeof useDashboardData>;

function DashboardContent({ dashboard }: { dashboard: Dashboard }) {
  const { user } = useAuth();
  const toast = useToast();
  const { data, errors, updatedAt, retry, reload } = dashboard;
  const [addingRules, setAddingRules] = useState(false);
  const [reminderHidden, setReminderHidden] = useStoredFlag(user ? `setupReminderHidden:${user.organizationId}` : null);
  const { servers, incidents, rules, members, summary } = data;

  const canAddServers = canManageServers(user?.role);
  const canAddRules = canManageSecurity(user?.role);
  const canInvite = user?.role === 'OWNER' || user?.role === 'ADMIN';

  async function addRecommendedRules() {
    setAddingRules(true);
    const existing = new Set((rules ?? []).map((r) => r.name.toLowerCase()));
    const missing = RULE_TEMPLATES.filter((t) => !existing.has(t.name.toLowerCase()));
    const results = await Promise.allSettled(missing.map((t) => apiClient.post('/rules', templatePayload(t))));
    const added = results.filter((r) => r.status === 'fulfilled').length;
    const failure = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
    if (failure) {
      toast.error(added ? `Added ${added} of ${missing.length} rules` : "Couldn't add the rules", friendlyError(failure.reason));
    } else {
      toast.success(`Added ${plural(added, 'rule')}`, 'They are checked every 30 seconds.');
    }
    await Promise.all([reload('rules'), reload('summary')]);
    setAddingRules(false);
  }

  const firstWaiting = servers?.find((s) => s.status === 'UNKNOWN');
  const hasServers = !!servers && servers.length > 0;
  const steps: SetupStep[] = [
    {
      key: 'server',
      title: 'Add your first server',
      description: 'Give it a name. You get a key for its agent straight away.',
      done: hasServers,
      action: canAddServers && (
        <Link href="/servers?add=1" className={buttonVariants({ size: 'sm' })}>
          Add a server
        </Link>
      ),
      note: 'Ask an owner, admin or DevOps engineer to add one.',
    },
    {
      key: 'agent',
      title: 'Start the agent',
      description: 'Run the agent on the server with its key. It reports every 10 seconds and the server turns online here.',
      done: !!servers?.some((s) => s.status !== 'UNKNOWN' || s.lastHeartbeat),
      action: hasServers && (
        <Link href={firstWaiting ? `/servers/${firstWaiting.id}` : '/servers'} className={buttonVariants({ size: 'sm', variant: 'outline' })}>
          See how to start it
        </Link>
      ),
      note: 'Add a server first.',
    },
    {
      key: 'rules',
      title: 'Turn on detection rules',
      description:
        rules && rules.length > 0
          ? 'You have rules, but all of them are off.'
          : 'Rules check your servers and sign-ins every 30 seconds. Start with the six recommended ones.',
      done: !!rules?.some((r) => r.isActive),
      action:
        canAddRules &&
        (rules && rules.length > 0 ? (
          <Link href="/rules" className={buttonVariants({ size: 'sm' })}>
            Turn on rules
          </Link>
        ) : (
          <>
            <Button size="sm" onClick={addRecommendedRules} disabled={addingRules || !rules}>
              {addingRules ? 'Adding rules…' : 'Add the recommended rules'}
            </Button>
            <Link href="/rules" className={buttonVariants({ size: 'sm', variant: 'ghost' })}>
              Choose rules
            </Link>
          </>
        )),
      note: 'Ask an owner, admin or security analyst to turn on rules.',
    },
    {
      key: 'team',
      title: 'Invite your team',
      description: 'Add the people who look after these servers, each with their own role.',
      done: !!members && members.length > 1,
      action: canInvite && (
        <a href="#team" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
          Invite people
        </a>
      ),
      note: 'Owners and admins can invite people.',
    },
  ];

  // First run: nothing to monitor yet, so the checklist is the whole page.
  // Incidents not tied to a server (sign-in attacks) still get the normal view.
  const firstRun = servers?.length === 0 && incidents?.length === 0;
  const setupOpen = !!servers && !!rules && !!members && steps.some((s) => !s.done);
  const liveFailed = LIVE.find((name) => errors[name]);
  const hasLiveData = LIVE.some((name) => data[name] !== null);

  if (!hasLiveData && LIVE.every((name) => errors[name])) {
    return (
      <Panel>
        <EmptyState
          icon={AlertCircle}
          tone="error"
          title="Couldn't load the dashboard"
          description={`${errors[LIVE[0]]} The page keeps trying every 15 s.`}
          action={
            <Button size="sm" variant="outline" onClick={retry}>
              Try again
            </Button>
          }
        />
      </Panel>
    );
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      {liveFailed && hasLiveData && (
        <Notice
          tone="error"
          action={
            <Button size="xs" variant="outline" onClick={retry}>
              Try again
            </Button>
          }
        >
          {errors[liveFailed] === NETWORK_ERROR_MESSAGE ? "Can't reach InfraSentinel." : errors[liveFailed]}{' '}
          {updatedAt ? `Showing data from ${formatTime(updatedAt)}, retrying every 15 s.` : 'Retrying every 15 s.'}
        </Notice>
      )}

      {firstRun ? (
        <SetupChecklist steps={steps} />
      ) : (
        <>
          {setupOpen && !reminderHidden && <SetupReminder steps={steps} onDismiss={() => setReminderHidden(true)} />}
          <StatusStrip data={data} failed={errors} />
          <div className="grid gap-5 sm:gap-6 xl:grid-cols-3">
            <OpenIncidentsPanel incidents={incidents} error={errors.incidents} onRetry={retry} className="min-w-0 xl:col-span-2" />
            <FleetPanel servers={servers} error={errors.servers} onRetry={retry} canAdd={canAddServers} />
          </div>
          <RecentDetectionsPanel summary={summary} error={errors.summary} onRetry={retry} />
        </>
      )}

      <MembersPanel members={members} error={errors.members} onChanged={() => reload('members')} />
    </div>
  );
}

// Organization name and the live indicator under the page title.
function DashboardMeta({ dashboard }: { dashboard: Dashboard }) {
  const { orgName } = useShellState();
  const { errors, updatedAt } = dashboard;
  const failed = LIVE.some((name) => errors[name]);
  if (!orgName && !updatedAt && !failed) return null;
  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
      {orgName && <span className="font-medium text-foreground/80">{orgName}</span>}
      {orgName && (updatedAt || failed) && <span aria-hidden className="h-3.5 w-px bg-border-strong" />}
      {(updatedAt || failed) && <LiveIndicator state={failed ? 'paused' : 'live'} every="15 s" updatedAt={updatedAt} />}
    </span>
  );
}

function DashboardShell() {
  const dashboard = useDashboardData();
  return (
    <AppShell title="Dashboard" meta={<DashboardMeta dashboard={dashboard} />}>
      <DashboardContent dashboard={dashboard} />
    </AppShell>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardShell />
    </ProtectedRoute>
  );
}
