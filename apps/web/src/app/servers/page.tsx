'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/app-shell';
import { apiClient } from '@/lib/api-client';
import {
  Server as ServerIcon,
  Plus,
  Copy,
  X,
  Circle,
  Eye,
  Pencil,
  Trash2,
  Check,
} from 'lucide-react';

interface Server {
  id: string;
  name: string;
  hostname: string | null;
  status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
  lastHeartbeat: string | null;
  createdAt: string;
}

const STATUS_STYLES: Record<Server['status'], { dot: string; text: string }> = {
  ONLINE: { dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  OFFLINE: { dot: 'bg-red-500', text: 'text-red-600 dark:text-red-400' },
  UNKNOWN: { dot: 'bg-muted-foreground/40', text: 'text-muted-foreground' },
};

function timeSince(dateStr: string | null) {
  if (!dateStr) return 'Never';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function ServersContent() {
  const [servers, setServers] = useState<Server[]>([]);
  const [error, setError] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newServerName, setNewServerName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  function loadServers() {
    apiClient
      .get<Server[]>('/servers')
      .then(setServers)
      .catch((err) => setError(err.message));
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
      setShowCreateForm(false);
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

  async function handleRename(id: string) {
    await apiClient.patch(`/servers/${id}`, { name: editName });
    setEditingServerId(null);
    loadServers();
  }

  async function handleDeleteServer(id: string, name: string) {
    if (confirm(`Delete server "${name}"? This permanently removes its metrics and alert history.`)) {
      await apiClient.delete(`/servers/${id}`);
      loadServers();
    }
  }

  const onlineCount = servers.filter((s) => s.status === 'ONLINE').length;

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <p className="text-[14.5px] font-semibold text-muted-foreground">
          {servers.length === 0
            ? 'No servers registered yet'
            : `${onlineCount} of ${servers.length} servers online`}
        </p>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex h-9.5 items-center gap-1.5 rounded-lg bg-[oklch(0.62_0.19_265)] px-3.5 text-[14px] font-bold text-white hover:bg-[oklch(0.66_0.19_265)]"
        >
          <Plus className="size-4" strokeWidth={2.25} />
          Add Server
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-[14px] font-medium text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {newApiKey && (
        <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-foreground">
                Server created — copy this API key now, it won&apos;t be shown again
              </p>
              <code className="mt-2 block break-all rounded-md border border-border bg-card px-2.5 py-1.5 text-[13px] text-muted-foreground">
                {newApiKey}
              </code>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                onClick={copyApiKey}
                className="flex h-8 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-[13px] font-semibold text-foreground hover:bg-muted"
              >
                <Copy className="size-3.5" strokeWidth={2} />
                {copied ? 'Copied' : 'Copy'}
              </button>
              <button
                onClick={() => setNewApiKey(null)}
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                aria-label="Dismiss"
              >
                <X className="size-4" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateForm && (
        <form
          onSubmit={handleCreate}
          className="mb-5 flex items-end gap-2 rounded-xl border border-border bg-card p-4 shadow-sm"
        >
          <div className="flex-1">
            <label className="mb-1.5 block text-[12.5px] font-bold text-muted-foreground">
              Server name
            </label>
            <input
              type="text"
              required
              value={newServerName}
              onChange={(e) => setNewServerName(e.target.value)}
              placeholder="e.g. Production DB Server"
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-[14px] text-foreground outline-none focus:border-[oklch(0.62_0.19_265)] focus:ring-2 focus:ring-[oklch(0.62_0.19_265)]/20"
            />
          </div>
          <button
            type="submit"
            disabled={creating}
            className="h-10 rounded-md bg-[oklch(0.62_0.19_265)] px-4 text-[14px] font-bold text-white hover:bg-[oklch(0.66_0.19_265)] disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </form>
      )}

      <div className="rounded-xl border border-border bg-card shadow-sm">
        {servers.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-5 py-14 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-muted">
              <ServerIcon className="size-5 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <p className="text-[15px] font-bold text-foreground">No servers yet</p>
            <p className="text-[14px] text-muted-foreground">
              Add a server above, then run the agent to start streaming metrics.
            </p>
          </div>
        ) : (
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-border text-left text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3">Server</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Last Heartbeat</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {servers.map((s) => {
                const st = STATUS_STYLES[s.status];
                const isEditing = editingServerId === s.id;
                return (
                  <tr key={s.id} className="border-b border-border/60 last:border-0 hover:bg-muted/50">
                    <td className="px-5 py-3.5">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="h-8 rounded-md border border-border bg-background px-2.5 text-[14px] text-foreground outline-none focus:border-[oklch(0.62_0.19_265)] focus:ring-2 focus:ring-[oklch(0.62_0.19_265)]/20"
                          />
                          <button
                            onClick={() => handleRename(s.id)}
                            className="flex size-7.5 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-emerald-500/40 hover:text-emerald-600 dark:hover:text-emerald-400"
                            aria-label="Save name"
                          >
                            <Check className="size-3.5" strokeWidth={2} />
                          </button>
                          <button
                            onClick={() => setEditingServerId(null)}
                            className="flex size-7.5 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted"
                            aria-label="Cancel"
                          >
                            <X className="size-3.5" strokeWidth={2} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="text-[14.5px] font-bold text-foreground">{s.name}</p>
                          {s.hostname && (
                            <p className="text-[13px] text-muted-foreground">{s.hostname}</p>
                          )}
                        </>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`flex items-center gap-1.5 text-[13.5px] font-bold ${st.text}`}>
                        <Circle className={`size-2 rounded-full ${st.dot}`} fill="currentColor" strokeWidth={0} />
                        {s.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-[13.5px] font-medium text-muted-foreground">
                      {timeSince(s.lastHeartbeat)}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/servers/${s.id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-[13px] font-bold text-foreground transition-colors hover:border-[oklch(0.62_0.19_265)] hover:bg-[oklch(0.62_0.19_265)]/10 hover:text-[oklch(0.55_0.19_265)] dark:hover:text-[oklch(0.72_0.15_265)]"
                        >
                          <Eye className="size-3.5" strokeWidth={2} />
                          View Details
                        </Link>
                        <button
                          onClick={() => { setEditingServerId(s.id); setEditName(s.name); }}
                          className="flex size-7.5 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-[oklch(0.62_0.19_265)] hover:text-[oklch(0.55_0.19_265)] dark:hover:text-[oklch(0.72_0.15_265)]"
                          aria-label="Edit server"
                        >
                          <Pencil className="size-3.5" strokeWidth={2} />
                        </button>
                        <button
                          onClick={() => handleDeleteServer(s.id, s.name)}
                          className="flex size-7.5 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-red-500/40 hover:text-red-600 dark:hover:text-red-400"
                          aria-label="Delete server"
                        >
                          <Trash2 className="size-3.5" strokeWidth={2} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function ServersPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Servers">
        <ServersContent />
      </AppShell>
    </ProtectedRoute>
  );
}