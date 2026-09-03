'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/app-shell';
import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import {
  Server,
  AlertTriangle,
  ListChecks,
  WifiOff,
  UserPlus,
  X,
  Copy,
  ArrowRight,
  Inbox,
} from 'lucide-react';

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

const ROLES = ['OWNER', 'ADMIN', 'SECURITY_ANALYST', 'DEVOPS_ENGINEER', 'DEVELOPER', 'VIEWER'];

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400',
  HIGH: 'border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400',
  MEDIUM: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  LOW: 'border-border bg-muted text-muted-foreground',
};

function timeAgo(dateStr: string) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
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

  const statCards = [
    {
      label: 'Servers Online',
      value: summary ? summary.servers.online : null,
      suffix: summary ? `of ${summary.servers.total}` : undefined,
      icon: Server,
      accent: 'bg-emerald-500',
      iconTone: 'text-emerald-600 bg-emerald-500/10 dark:text-emerald-400',
    },
    {
      label: 'Servers Offline',
      value: summary ? summary.servers.offline : null,
      icon: WifiOff,
      accent: summary && summary.servers.offline > 0 ? 'bg-red-500' : 'bg-border',
      iconTone:
        summary && summary.servers.offline > 0
          ? 'text-red-600 bg-red-500/10 dark:text-red-400'
          : 'text-muted-foreground bg-muted',
    },
    {
      label: 'Open Incidents',
      value: summary ? summary.openIncidents : null,
      icon: AlertTriangle,
      accent: summary && summary.openIncidents > 0 ? 'bg-red-500' : 'bg-border',
      iconTone:
        summary && summary.openIncidents > 0
          ? 'text-red-600 bg-red-500/10 dark:text-red-400'
          : 'text-muted-foreground bg-muted',
    },
    {
      label: 'Active Rules',
      value: summary ? summary.activeRules : null,
      icon: ListChecks,
      accent: 'bg-[oklch(0.62_0.19_265)]',
      iconTone: 'text-[oklch(0.55_0.19_265)] bg-[oklch(0.62_0.19_265)]/10 dark:text-[oklch(0.72_0.15_265)]',
    },
  ];

  return (
    <div>
      {error && (
        <div className="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {inviteLink && (
        <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-foreground">Invitation created — share this link</p>
              <code className="mt-2 block truncate rounded-md border border-border bg-card px-2.5 py-1.5 text-[12px] text-muted-foreground">
                {inviteLink}
              </code>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                onClick={copyInviteLink}
                className="flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-[12px] font-medium text-foreground hover:bg-muted"
              >
                <Copy className="size-3" strokeWidth={2} />
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={() => setInviteLink(null)}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                aria-label="Dismiss"
              >
                <X className="size-3.5" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      )}

            {/* Stat cards */}
      <div className="mb-6 grid grid-cols-4 gap-4">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-sm"
          >
            <div className={`flex size-11 shrink-0 items-center justify-center rounded-xl ${card.iconTone}`}>
              <card.icon className="size-5" strokeWidth={2.1} />
            </div>
            <div>
                            <p className="text-[32px] font-bold leading-none tracking-tight text-foreground">
                {summaryLoading || card.value === null ? (
                  <span className="inline-block h-7 w-10 animate-pulse rounded bg-muted align-middle" />
                ) : (
                  card.value
                )}
              </p>
                            <p className="mt-1.5 text-[13.5px] font-semibold text-muted-foreground">
                {card.label}
                {card.suffix && <span className="text-muted-foreground/70"> · {card.suffix}</span>}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-6 grid grid-cols-3 gap-4">
        {/* Recent alerts */}
        <div className="col-span-2 rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
                        <h2 className="text-[15px] font-bold text-foreground">Recent Alerts</h2>
            <Link
              href="/incidents"
              className="flex items-center gap-1 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
            >
              View all
              <ArrowRight className="size-3" strokeWidth={2} />
            </Link>
          </div>

          {summaryLoading ? (
            <div className="space-y-3 p-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : summary && summary.recentAlerts.length > 0 ? (
            <ul className="divide-y divide-border">
              {summary.recentAlerts.map((a) => (
                <li key={a.id} className="flex items-center justify-between px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium text-foreground">{a.rule.name}</p>
                    {a.server && <p className="text-[12px] text-muted-foreground">{a.server.name}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <Badge className={SEVERITY_STYLES[a.rule.severity] ?? SEVERITY_STYLES.LOW}>
                      {a.rule.severity}
                    </Badge>
                    <span className="w-14 text-right text-[11.5px] text-muted-foreground">
                      {timeAgo(a.createdAt)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 px-5 py-10 text-center">
              <div className="flex size-9 items-center justify-center rounded-full bg-muted">
                <Inbox className="size-4 text-muted-foreground" strokeWidth={1.75} />
              </div>
              <p className="text-[13px] font-medium text-foreground">No alerts yet</p>
              <p className="text-[12.5px] text-muted-foreground">
                Alerts will appear here once your SIEM rules start firing.
              </p>
            </div>
          )}
        </div>

        {/* Fleet snapshot */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
                      <h2 className="text-[15px] font-bold text-foreground">Fleet Health</h2>
          {summaryLoading ? (
            <div className="h-2.5 w-full animate-pulse rounded-full bg-muted" />
          ) : summary && summary.servers.total > 0 ? (
            <div className="space-y-3">
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{
                    width: `${Math.round((summary.servers.online / summary.servers.total) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex items-center justify-between text-[12.5px]">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  {summary.servers.online} online
                </span>
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-1.5 rounded-full bg-red-400" />
                  {summary.servers.offline} offline
                </span>
              </div>
              <Link
                href="/servers"
                className="mt-2 flex items-center justify-center gap-1 rounded-lg border border-border py-2 text-[12.5px] font-medium text-foreground hover:bg-muted"
              >
                Manage servers
                <ArrowRight className="size-3" strokeWidth={2} />
              </Link>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 py-6 text-center">
              <div className="flex size-9 items-center justify-center rounded-full bg-muted">
                <Server className="size-4 text-muted-foreground" strokeWidth={1.75} />
              </div>
              <p className="text-[12.5px] text-muted-foreground">No servers registered</p>
              <Link
                href="/servers"
                className="text-[12.5px] font-medium text-[oklch(0.62_0.19_265)] hover:underline"
              >
                Register a server →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Organization members */}
      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
                      <h2 className="text-[15px] font-bold text-foreground">Organization Members</h2>
          {canManageMembers && (
            <button
              onClick={() => setShowInviteForm(!showInviteForm)}
              className="flex h-7.5 items-center gap-1.5 rounded-md bg-[oklch(0.62_0.19_265)] px-2.5 text-[12.5px] font-medium text-white hover:bg-[oklch(0.66_0.19_265)]"
            >
              <UserPlus className="size-3.5" strokeWidth={2} />
              Invite Member
            </button>
          )}
        </div>

        {showInviteForm && (
          <form onSubmit={handleInvite} className="flex items-end gap-2 border-b border-border bg-muted/50 px-5 py-3.5">
            <div className="flex-1">
              <label className="mb-1 block text-[11.5px] font-medium text-muted-foreground">Email</label>
              <input
                type="email"
                required
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="h-8 w-full rounded-md border border-border bg-background px-2.5 text-[13px] text-foreground outline-none focus:border-[oklch(0.62_0.19_265)] focus:ring-2 focus:ring-[oklch(0.62_0.19_265)]/20"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11.5px] font-medium text-muted-foreground">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="h-8 rounded-md border border-border bg-background px-2 text-[13px] text-foreground outline-none focus:border-[oklch(0.62_0.19_265)]"
              >
                {ROLES.filter((r) => r !== 'OWNER').map((r) => (
                  <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={inviting}
              className="h-8 rounded-md bg-[oklch(0.62_0.19_265)] px-3 text-[12.5px] font-medium text-white hover:bg-[oklch(0.66_0.19_265)] disabled:opacity-50"
            >
              {inviting ? 'Sending...' : 'Send Invite'}
            </button>
          </form>
        )}

        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border text-left text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">
              <th className="px-5 py-2.5">Email</th>
              <th className="px-5 py-2.5">Role</th>
              <th className="px-5 py-2.5">Joined</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-border/60 last:border-0 hover:bg-muted/50">
                <td className="px-5 py-2.5 text-foreground">{m.email}</td>
                <td className="px-5 py-2.5">
                  {canManageMembers && m.role !== 'OWNER' ? (
                    <select
                      value={m.role}
                      onChange={(e) => handleRoleChange(m.id, e.target.value)}
                      className="rounded-md border border-border bg-background px-2 py-1 text-[12px] text-foreground outline-none focus:border-[oklch(0.62_0.19_265)]"
                    >
                      {ROLES.filter((r) => r !== 'OWNER').map((r) => (
                        <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  ) : (
                    <Badge className="border-border bg-muted text-muted-foreground">
                      {m.role.replace(/_/g, ' ')}
                    </Badge>
                  )}
                </td>
                <td className="px-5 py-2.5 text-muted-foreground">
                  {new Date(m.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Dashboard">
        <DashboardContent />
      </AppShell>
    </ProtectedRoute>
  );
}