'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/auth-context';
import { ProtectedRoute } from '@/components/protected-route';
import { apiClient } from '@/lib/api-client';

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

function DashboardContent() {
  const { user, logout } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [error, setError] = useState('');
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('DEVELOPER');
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

  function loadMembers() {
    apiClient
      .get<Member[]>('/organizations/members')
      .then(setMembers)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    loadMembers();
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

  const canManageMembers = user?.role === 'OWNER' || user?.role === 'ADMIN';

  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  useEffect(() => {
    apiClient.get<DashboardSummary>('/incidents/dashboard-summary').then(setSummary).catch(() => setSummary(null));
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">InfraSentinel Dashboard</h1>
            <p className="text-sm text-gray-600">Logged in as {user?.email} ({user?.role})</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/servers" className="text-sm text-blue-600 hover:underline">Servers</Link>
            <Link href="/rules" className="text-sm text-blue-600 hover:underline">Rules</Link>
            <Link href="/incidents" className="text-sm text-blue-600 hover:underline">Incidents</Link>
            <button onClick={logout} className="rounded-md border px-4 py-2 text-sm hover:bg-gray-100">
              Log out
            </button>
          </div>
        </div>

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        {inviteLink && (
          <div className="mb-6 rounded-lg border border-yellow-300 bg-yellow-50 p-4">
            <p className="text-sm font-medium text-yellow-800">Invitation created — share this link:</p>
            <code className="mt-2 block break-all rounded bg-white p-2 text-xs">{inviteLink}</code>
            <button onClick={() => setInviteLink(null)} className="mt-2 text-xs text-yellow-700 underline">
              Dismiss
            </button>
          </div>
        )}

        {summary && (
          <div className="mb-6 grid grid-cols-4 gap-4">
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500">Servers Online</p>
              <p className="mt-1 text-2xl font-semibold">
                {summary.servers.online}
                <span className="text-sm font-normal text-gray-400"> / {summary.servers.total}</span>
              </p>
            </div>
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500">Open Incidents</p>
              <p className={`mt-1 text-2xl font-semibold ${summary.openIncidents > 0 ? 'text-red-600' : ''}`}>
                {summary.openIncidents}
              </p>
            </div>
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500">Active Rules</p>
              <p className="mt-1 text-2xl font-semibold">{summary.activeRules}</p>
            </div>
            <div className="rounded-lg border bg-white p-4 shadow-sm">
              <p className="text-xs text-gray-500">Servers Offline</p>
              <p className={`mt-1 text-2xl font-semibold ${summary.servers.offline > 0 ? 'text-orange-600' : ''}`}>
                {summary.servers.offline}
              </p>
            </div>
          </div>
        )}

        {summary && summary.recentAlerts.length > 0 && (
          <div className="mb-6 rounded-lg border bg-white p-6 shadow-sm">
            <h2 className="mb-3 text-lg font-medium">Recent Alerts</h2>
            <ul className="space-y-2">
              {summary.recentAlerts.map((a) => (
                <li key={a.id} className="flex items-center justify-between border-b pb-2 text-sm last:border-0">
                  <div>
                    <span className="font-medium">{a.rule.name}</span>
                    {a.server && <span className="text-gray-500"> · {a.server.name}</span>}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className={`rounded-full px-2 py-0.5 font-medium ${
                      a.rule.severity === 'CRITICAL' || a.rule.severity === 'HIGH' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {a.rule.severity}
                    </span>
                    {new Date(a.createdAt).toLocaleTimeString()}
                  </div>
                </li>
              ))}
            </ul>
            <Link href="/incidents" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
              View all incidents →
            </Link>
          </div>
        )}

        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-medium">Organization Members</h2>
            {canManageMembers && (
              <button
                onClick={() => setShowInviteForm(!showInviteForm)}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
              >
                + Invite Member
              </button>
            )}
          </div>

          {showInviteForm && (
            <form onSubmit={handleInvite} className="mb-4 flex items-end gap-2 rounded-md bg-gray-50 p-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600">Email</label>
                <input
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="mt-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                >
                  {ROLES.filter((r) => r !== 'OWNER').map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <button
                type="submit"
                disabled={inviting}
                className="rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {inviting ? 'Sending...' : 'Send Invite'}
              </button>
            </form>
          )}

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2">Email</th>
                <th className="pb-2">Role</th>
                <th className="pb-2">Joined</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="border-b last:border-0">
                  <td className="py-2">{m.email}</td>
                  <td className="py-2">
                    {canManageMembers && m.role !== 'OWNER' ? (
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.id, e.target.value)}
                        className="rounded-md border border-gray-300 px-2 py-1 text-xs"
                      >
                        {ROLES.filter((r) => r !== 'OWNER').map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    ) : (
                      m.role
                    )}
                  </td>
                  <td className="py-2">{new Date(m.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}