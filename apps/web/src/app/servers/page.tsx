'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, Copy, KeyRound, Plus, X } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/app-shell';
import { apiClient } from '@/lib/api-client';
import { canManageServers } from '@/lib/permissions';
import { Button, buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { fieldControlClass, fieldLabelClass } from '@/components/ui/form-styles';
import { Notice } from '@/components/ui/notice';
import { Panel } from '@/components/ui/panel';
import { ServerStatusBadge } from '@/components/ui/status';
import { TONE_COLOR } from '@/components/ui/tone';
import { cn } from '@/lib/utils';

interface Server {
  id: string;
  name: string;
  hostname: string | null;
  status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
  lastHeartbeat: string | null;
  createdAt: string;
}

function timeSince(dateStr: string | null) {
  if (!dateStr) return 'Never';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function ServersContent({
  showForm,
  onOpenForm,
  onCloseForm,
}: {
  showForm: boolean;
  onOpenForm: () => void;
  onCloseForm: () => void;
}) {
  const { user } = useAuth();
  const [servers, setServers] = useState<Server[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [newServerName, setNewServerName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function loadServers() {
    apiClient
      .get<Server[]>('/servers')
      .then(setServers)
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true));
  }

  useEffect(() => {
    loadServers();
    const interval = setInterval(loadServers, 10000);
    return () => clearInterval(interval);
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const result = await apiClient.post<{ apiKey: string }>('/servers', { name: newServerName });
      setNewApiKey(result.apiKey);
      setNewServerName('');
      onCloseForm();
      loadServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create server');
    } finally {
      setCreating(false);
    }
  }

  function copyApiKey() {
    if (!newApiKey) return;
    navigator.clipboard.writeText(newApiKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const counts = {
    online: servers.filter((s) => s.status === 'ONLINE').length,
    offline: servers.filter((s) => s.status === 'OFFLINE').length,
    unknown: servers.filter((s) => s.status === 'UNKNOWN').length,
  };
  const canManage = canManageServers(user?.role);

  return (
    <div className="space-y-6">
      {error && <Notice tone="error">{error}</Notice>}

      {newApiKey && (
        <section className="rounded-xl border border-sev-medium/35 bg-sev-medium/8 p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sev-medium/15 text-sev-medium">
                <KeyRound className="size-[18px]" strokeWidth={1.9} />
              </span>
              <div>
                <p className="text-[15px] font-semibold text-foreground">Server registered. Copy its agent key now.</p>
                <p className="mt-1 text-[13.5px] text-muted-foreground">
                  The key is shown only once. Start the agent on the server with <code className="font-mono text-foreground">API_KEY</code> set to it.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="sm" variant="outline" onClick={copyApiKey}>
                {copied ? <Check /> : <Copy />}
                {copied ? 'Copied' : 'Copy key'}
              </Button>
              <Button size="icon-sm" variant="ghost" onClick={() => setNewApiKey(null)} aria-label="Dismiss">
                <X />
              </Button>
            </div>
          </div>
          <code className="mt-4 block break-all rounded-lg border border-border bg-surface-2 px-3 py-2.5 font-mono text-[13px] text-foreground">
            {newApiKey}
          </code>
        </section>
      )}

      {showForm && canManage && (
        <Panel label="New server" title="Register a server">
          <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3">
            <div className="min-w-64 flex-1">
              <label htmlFor="server-name" className={fieldLabelClass}>
                Server name
              </label>
              <input
                id="server-name"
                type="text"
                required
                autoFocus
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value)}
                placeholder="e.g. prod-db-01"
                className={fieldControlClass}
              />
            </div>
            <Button type="submit" disabled={creating} className="h-10">
              {creating ? 'Registering...' : 'Register server'}
            </Button>
            <Button type="button" variant="ghost" onClick={onCloseForm} className="h-10">
              Cancel
            </Button>
          </form>
        </Panel>
      )}

      <Panel
        label="Fleet"
        title={
          !loaded
            ? 'Loading servers...'
            : servers.length === 0
              ? 'No servers registered yet'
              : `${counts.online} of ${servers.length} servers online`
        }
        bodyClassName="p-0"
        actions={
          servers.length > 0 && (
            <div className="hidden items-center gap-4 font-mono text-[12px] text-muted-foreground sm:flex">
              {[
                { label: 'online', count: counts.online, color: TONE_COLOR.online },
                { label: 'offline', count: counts.offline, color: TONE_COLOR.offline },
                { label: 'not yet', count: counts.unknown, color: TONE_COLOR.unknown },
              ].map((c) => (
                <span key={c.label} className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full" style={{ background: c.color }} aria-hidden />
                  {c.count} {c.label}
                </span>
              ))}
            </div>
          )
        }
      >
        {!loaded ? (
          <div className="space-y-3 p-5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : servers.length === 0 ? (
          <EmptyState
            art="server"
            title="No servers yet"
            description="Register a server, then start the agent on it with the key you get. Its metrics appear within seconds."
            action={
              canManage && !showForm ? (
                <Button size="sm" onClick={onOpenForm}>
                  <Plus />
                  Add server
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="overflow-x-auto [contain:paint]">
            <table className="w-full min-w-[36rem] text-[14px]">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="hud-label px-5 py-3 font-medium">Server</th>
                  <th className="hud-label px-5 py-3 font-medium">Status</th>
                  <th className="hud-label px-5 py-3 font-medium">Last heartbeat</th>
                  <th className="px-5 py-3">
                    <span className="sr-only">Details</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {servers.map((s) => (
                  <tr key={s.id} className="group border-b border-border/70 transition-colors last:border-0 hover:bg-accent/40">
                    <td className="px-5 py-3.5">
                      <Link href={`/servers/${s.id}`} className="block rounded-sm">
                        <span className="block font-semibold text-foreground">{s.name}</span>
                        {s.hostname && <span className="block font-mono text-[12px] text-muted-foreground">{s.hostname}</span>}
                      </Link>
                    </td>
                    <td className="px-5 py-3.5">
                      <ServerStatusBadge status={s.status} />
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[12.5px] tabular-nums text-muted-foreground">
                      {timeSince(s.lastHeartbeat)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/servers/${s.id}`}
                        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'group-hover:text-foreground')}
                      >
                        Details
                        <ArrowRight />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function ServersPageInner() {
  const { user } = useAuth();
  const [showForm, setShowForm] = useState(false);
  return (
    <AppShell
      title="Servers"
      description="Every machine that sends its metrics to InfraSentinel. The list refreshes every 10 seconds."
      actions={
        canManageServers(user?.role) && (
          <Button variant={showForm ? 'outline' : 'default'} onClick={() => setShowForm(!showForm)}>
            {showForm ? <X /> : <Plus />}
            {showForm ? 'Close' : 'Add server'}
          </Button>
        )
      }
    >
      <ServersContent showForm={showForm} onOpenForm={() => setShowForm(true)} onCloseForm={() => setShowForm(false)} />
    </AppShell>
  );
}

export default function ServersPage() {
  return (
    <ProtectedRoute>
      <ServersPageInner />
    </ProtectedRoute>
  );
}
