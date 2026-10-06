'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Check, Copy, ListChecks, Server, UserPlus, WifiOff, X } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/app-shell';
import { apiClient } from '@/lib/api-client';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { fieldControlClass, fieldLabelClass, fieldSelectClass } from '@/components/ui/form-styles';
import { Notice } from '@/components/ui/notice';
import { Panel } from '@/components/ui/panel';
import { StatTile } from '@/components/ui/stat-tile';
import { SeverityBadge } from '@/components/ui/status';
import { TONE_COLOR } from '@/components/ui/tone';
import { ROLE_LABELS, roleLabel } from '@/lib/roles';
import { cn } from '@/lib/utils';

interface Member {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}
interface DashboardSummary {
  servers: { total: number; online: number; offline: number };
  openIncidents: number;
  activeRules: number;
  recentAlerts: {
    id: string;
    status: string;
    createdAt: string;
    rule: { name: string; severity: string };
    server: { name: string } | null;
  }[];
}

const ROLES = Object.keys(ROLE_LABELS);

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function Skeleton({ className }: { className?: string }) {
  return <span className={cn('inline-block animate-pulse rounded-md bg-muted align-middle', className)} />;
}

// One light per server: the fleet at a glance. The summary counts servers that
// never reported together with offline ones, so both show as "not reporting".
function FleetLights({ online, notReporting }: { online: number; notReporting: number }) {
  const lights = [
    ...Array<string>(online).fill(TONE_COLOR.online),
    ...Array<string>(notReporting).fill(TONE_COLOR.offline),
  ];
  const shown = lights.slice(0, 60);
  // small fleets get bigger lights
  const big = lights.length <= 16;
  return (
    <div
      className={cn('flex flex-wrap', big ? 'gap-2' : 'gap-1.5')}
      role="img"
      aria-label={`${online} online, ${notReporting} not reporting`}
    >
      {shown.map((color, i) => (
        <span
          key={i}
          className={cn('flex items-center justify-center border', big ? 'size-9 rounded-md' : 'size-4 rounded-[3px]')}
          style={{
            background: `color-mix(in oklab, ${color} 14%, transparent)`,
            borderColor: `color-mix(in oklab, ${color} 45%, transparent)`,
          }}
        >
          <span
            className={cn(big ? 'size-3 rounded-[2px]' : 'size-1.5 rounded-[1px]')}
            style={{ background: color, boxShadow: `0 0 10px color-mix(in oklab, ${color} 60%, transparent)` }}
          />
        </span>
      ))}
      {lights.length > shown.length && (
        <span className="self-center font-mono text-[12px] text-muted-foreground">+{lights.length - shown.length}</span>
      )}
    </div>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState('');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('DEVELOPER');
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  function loadMembers() {
    apiClient
      .get<Member[]>('/organizations/members')
      .then(setMembers)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    loadMembers();
  }, []);

  useEffect(() => {
    apiClient
      .get<DashboardSummary>('/incidents/dashboard-summary')
      .then(setSummary)
      .catch(() => setSummary(null))
      .finally(() => setSummaryLoading(false));
  }, []);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviting(true);
    setError('');
    try {
      const result = await apiClient.post<{ inviteLink: string }>('/organizations/invitations', {
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteLink(result.inviteLink);
      setInviteEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invitation');
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(memberId: string, newRole: string) {
    try {
      await apiClient.patch(`/organizations/members/${memberId}/role`, { role: newRole });
      loadMembers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    }
  }

  function copyInviteLink() {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const canManageMembers = user?.role === 'OWNER' || user?.role === 'ADMIN';
  const servers = summary?.servers;
  const value = (n: number | undefined) => (summaryLoading || n === undefined ? <Skeleton className="h-7 w-12" /> : n);

  return (
    <div className="space-y-6">
      {error && <Notice tone="error">{error}</Notice>}

      {inviteLink && (
        <Notice tone="success" icon={UserPlus}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-medium">Invitation created. Share this link with your colleague:</p>
            <div className="flex items-center gap-1.5">
              <Button size="xs" variant="outline" onClick={copyInviteLink}>
                {copied ? <Check /> : <Copy />}
                {copied ? 'Copied' : 'Copy link'}
              </Button>
              <Button size="icon-xs" variant="ghost" onClick={() => setInviteLink(null)} aria-label="Dismiss">
                <X />
              </Button>
            </div>
          </div>
          <code className="mt-2 block truncate rounded-md border border-border bg-surface-2 px-2.5 py-1.5 font-mono text-[12px] text-muted-foreground">
            {inviteLink}
          </code>
        </Notice>
      )}

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatTile
          label="Servers online"
          value={value(servers?.online)}
          hint={servers ? `of ${servers.total} monitored` : undefined}
          tone="online"
          icon={Server}
        />
        <StatTile
          label="Servers offline"
          value={value(servers?.offline)}
          hint={servers ? (servers.offline > 0 ? 'not reporting' : 'all reporting') : undefined}
          tone={servers && servers.offline > 0 ? 'offline' : 'default'}
          icon={WifiOff}
        />
        <StatTile
          label="Open incidents"
          value={value(summary?.openIncidents)}
          hint={summary ? (summary.openIncidents > 0 ? 'need attention' : 'all clear') : undefined}
          tone={summary && summary.openIncidents > 0 ? 'critical' : 'default'}
          icon={AlertTriangle}
        />
        <StatTile
          label="Active rules"
          value={value(summary?.activeRules)}
          hint="checked every 30 s"
          tone="primary"
          icon={ListChecks}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          className="xl:col-span-2"
          label="Detections"
          title="Recent alerts"
          bodyClassName="p-0"
          actions={
            <Link href="/incidents" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
              View incidents
              <ArrowRight />
            </Link>
          }
        >
          {summaryLoading ? (
            <div className="space-y-3 p-5">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="block h-11 w-full" />
              ))}
            </div>
          ) : summary && summary.recentAlerts.length > 0 ? (
            <ul className="divide-y divide-border">
              {summary.recentAlerts.map((a) => (
                <li key={a.id} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-accent/40">
                  <SeverityBadge severity={a.rule.severity} className="w-[7.5rem] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-foreground">{a.rule.name}</p>
                    <p className="truncate font-mono text-[12px] text-muted-foreground">
                      {a.server ? a.server.name : 'no server · account or IP based'}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-[12px] tabular-nums text-muted-foreground">{timeAgo(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              art="incidents"
              title="No alerts yet"
              description="Alerts appear here as soon as one of your rules fires."
            />
          )}
        </Panel>

        <Panel label="Fleet" title="Server health" brackets>
          {summaryLoading ? (
            <Skeleton className="block h-24 w-full" />
          ) : servers && servers.total > 0 ? (
            <div>
              <FleetLights online={servers.online} notReporting={servers.offline} />
              <dl className="mt-6 grid grid-cols-2 gap-3 border-t border-border pt-5">
                {[
                  { label: 'Online', count: servers.online, color: TONE_COLOR.online },
                  { label: 'Not reporting', count: servers.offline, color: TONE_COLOR.offline },
                ].map((s) => (
                  <div key={s.label}>
                    <dt className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
                      <span className="size-1.5 rounded-full" style={{ background: s.color }} aria-hidden />
                      {s.label}
                    </dt>
                    <dd className="mt-1.5 font-display text-[22px] font-semibold tabular-nums text-foreground">{s.count}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-5 text-[13px] leading-relaxed text-muted-foreground">
                A server counts as offline when its agent has not reported for a minute.
              </p>
              <Link href="/servers" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'mt-4 w-full')}>
                Manage servers
                <ArrowRight />
              </Link>
            </div>
          ) : (
            <EmptyState
              art="server"
              title="No servers yet"
              description="Register a server and start its agent to see it here."
              className="py-6"
              action={
                <Link href="/servers" className={buttonVariants({ size: 'sm' })}>
                  Register a server
                </Link>
              }
            />
          )}
        </Panel>
      </div>

      <Panel
        label="Team"
        title="Organization members"
        bodyClassName="p-0"
        actions={
          canManageMembers && (
            <Button size="sm" variant={showInviteForm ? 'outline' : 'default'} onClick={() => setShowInviteForm(!showInviteForm)}>
              {showInviteForm ? <X /> : <UserPlus />}
              {showInviteForm ? 'Close' : 'Invite member'}
            </Button>
          )
        }
      >
        {showInviteForm && (
          <form onSubmit={handleInvite} className="flex flex-wrap items-end gap-3 border-b border-border bg-surface-2/50 px-5 py-4">
            <div className="min-w-56 flex-1">
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
            <div className="w-56">
              <label htmlFor="invite-role" className={fieldLabelClass}>
                Role
              </label>
              <select id="invite-role" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className={fieldSelectClass}>
                {ROLES.filter((r) => r !== 'OWNER').map((r) => (
                  <option key={r} value={r}>
                    {roleLabel(r)}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={inviting} className="h-10">
              {inviting ? 'Creating link...' : 'Create invitation'}
            </Button>
          </form>
        )}

        <table className="w-full text-[14px]">
          <thead>
            <tr className="border-b border-border text-left">
              <th className="hud-label px-5 py-3 font-medium">Member</th>
              <th className="hud-label px-5 py-3 font-medium">Role</th>
              <th className="hud-label px-5 py-3 text-right font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-border/70 transition-colors last:border-0 hover:bg-accent/40">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/12 font-mono text-[11px] font-semibold text-primary-bright">
                      {m.email.slice(0, 2).toUpperCase()}
                    </span>
                    <span className="truncate font-medium text-foreground">
                      {m.email}
                      {m.id === user?.userId && <span className="ml-2 font-mono text-[11px] text-muted-foreground">(you)</span>}
                    </span>
                  </div>
                </td>
                <td className="px-5 py-3">
                  {canManageMembers && m.role !== 'OWNER' ? (
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.id, e.target.value)}
                      aria-label={`Role of ${m.email}`}
                      className={cn(fieldSelectClass, 'h-8 w-48 text-[13px]')}
                    >
                      {ROLES.filter((r) => r !== 'OWNER').map((r) => (
                        <option key={r} value={r}>
                          {roleLabel(r)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className={cn(
                        'inline-flex h-6 items-center rounded-md border px-2 font-mono text-[11px] font-semibold uppercase tracking-[0.08em]',
                        m.role === 'OWNER'
                          ? 'border-primary/30 bg-primary/10 text-primary-bright'
                          : 'border-border-strong bg-surface-2 text-muted-foreground',
                      )}
                    >
                      {roleLabel(m.role)}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 text-right font-mono text-[12.5px] tabular-nums text-muted-foreground">
                  {formatDate(m.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Dashboard" description="Fleet health, open incidents and the latest detections for your organization.">
        <DashboardContent />
      </AppShell>
    </ProtectedRoute>
  );
}
