'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Check, Plus, X } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/app-shell';
import { ConnectPanel } from '@/components/servers/connect-panel';
import { ServerMenu, useServerActions } from '@/components/servers/server-actions';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { fieldControlClass, fieldHintClass, fieldInlineErrorClass, fieldLabelClass } from '@/components/ui/form-styles';
import { LiveIndicator } from '@/components/ui/live-indicator';
import { Notice } from '@/components/ui/notice';
import { Panel } from '@/components/ui/panel';
import { RelativeTime } from '@/components/ui/relative-time';
import { SkeletonRows } from '@/components/ui/skeleton';
import { ServerStatusBadge } from '@/components/ui/status';
import { FilterTabs } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api-client';
import { friendlyError } from '@/lib/errors';
import { formatDate, formatTime } from '@/lib/format';
import { canManageServers } from '@/lib/permissions';
import { cn } from '@/lib/utils';

interface Server {
  id: string;
  name: string;
  hostname: string | null;
  status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
  lastHeartbeat: string | null;
  createdAt: string;
}

type Filter = 'all' | Server['status'];

// Problems first, then by name.
const STATUS_ORDER: Record<string, number> = { OFFLINE: 0, UNKNOWN: 1, ONLINE: 2 };
const FILTER_EMPTY: Record<Filter, string> = {
  all: 'No servers.',
  ONLINE: 'No servers are online.',
  OFFLINE: 'No offline servers.',
  UNKNOWN: 'No servers are waiting for a first report.',
};
const REFRESH_MS = 10_000;

/** The list, refreshed every 10 s. A failed refresh keeps the last list. */
function useServerList() {
  const toast = useToast();
  const [servers, setServers] = useState<Server[] | null>(null);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const lastStatus = useRef(new Map<string, string>());

  useEffect(() => {
    let cancelled = false;
    function load() {
      apiClient
        .get<Server[]>('/servers')
        .then((list) => {
          if (cancelled) return;
          // a waiting server whose first report just arrived
          for (const server of list) {
            if (lastStatus.current.get(server.id) === 'UNKNOWN' && server.status === 'ONLINE') {
              toast.success(`${server.name} is connected`, 'Its first report just arrived.');
            }
          }
          lastStatus.current = new Map(list.map((s) => [s.id, s.status]));
          setServers(list);
          setError('');
          setUpdatedAt(Date.now());
        })
        .catch((err) => {
          if (!cancelled) setError(friendlyError(err));
        });
    }
    load();
    const timer = window.setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [attempt, toast]);

  function replace(server: Server) {
    setServers((list) => list?.map((s) => (s.id === server.id ? { ...s, ...server } : s)) ?? null);
  }
  function remove(id: string) {
    setServers((list) => list?.filter((s) => s.id !== id) ?? null);
  }
  function add(server: Server) {
    lastStatus.current.set(server.id, server.status);
    setServers((list) => [...(list ?? []), server]);
  }

  return { servers, error, updatedAt, retry: () => setAttempt((n) => n + 1), replace, remove, add };
}

// ---------------------------------------------------------------------------

function AddServerForm({ onAdded, onCancel }: { onAdded: (server: Server, apiKey: string) => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [hostname, setHostname] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError('Use at least 2 characters.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const created = await apiClient.post<Server & { apiKey: string }>('/servers', {
        name: trimmed,
        ...(hostname.trim() ? { hostname: hostname.trim() } : {}),
      });
      const { apiKey, ...server } = created;
      onAdded(server, apiKey);
    } catch (err) {
      setError(friendlyError(err, "Couldn't add the server. Try again."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Add a server" className="animate-fade-up">
      <form onSubmit={submit} noValidate>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
          <div>
            <label htmlFor="server-name" className={fieldLabelClass}>
              Name
            </label>
            <input
              id="server-name"
              required
              autoFocus
              autoComplete="off"
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="prod-db-01"
              aria-invalid={!!error || undefined}
              aria-describedby={error ? 'server-name-error' : undefined}
              className={fieldControlClass}
            />
          </div>
          <div>
            <label htmlFor="server-hostname" className={fieldLabelClass}>
              Hostname <span className="font-normal">(optional)</span>
            </label>
            <input
              id="server-hostname"
              autoComplete="off"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              placeholder="db01.example.internal"
              className={cn(fieldControlClass, 'font-mono text-[13.5px]')}
            />
          </div>
          <div className="flex gap-2 sm:col-span-2 lg:col-span-1">
            <Button type="submit" disabled={saving} className="flex-1 lg:flex-none">
              {saving ? 'Adding…' : 'Add server'}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel} className="flex-1 lg:flex-none">
              Cancel
            </Button>
          </div>
        </div>
        {error ? (
          <p id="server-name-error" className={fieldInlineErrorClass}>
            {error}
          </p>
        ) : (
          <p className={fieldHintClass}>You get a key for the server&apos;s agent as soon as it is added.</p>
        )}
      </form>
    </Panel>
  );
}

function RenameForm({
  server,
  onSaved,
  onCancel,
}: {
  server: Server;
  onSaved: (server: Server) => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [value, setValue] = useState(server.name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = value.trim();
    if (name === server.name) return onCancel();
    if (name.length < 2) return setError('Use at least 2 characters.');
    setSaving(true);
    setError('');
    try {
      const updated = await apiClient.patch<Server>(`/servers/${server.id}`, { name });
      onSaved(updated);
      toast.success(`Renamed to ${updated.name}`);
    } catch (err) {
      setError(friendlyError(err, "Couldn't rename the server. Try again."));
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} noValidate className="relative z-10 min-w-0">
      <div className="flex items-center gap-1.5">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Escape' && onCancel()}
          aria-label={`New name for ${server.name}`}
          aria-invalid={!!error || undefined}
          autoFocus
          maxLength={100}
          className={cn(fieldControlClass, 'h-8 min-w-0 max-w-64 text-[14px] pointer-coarse:h-10')}
        />
        <Button type="submit" size="icon-sm" variant="outline" disabled={saving} aria-label="Save name">
          <Check />
        </Button>
        <Button type="button" size="icon-sm" variant="ghost" onClick={onCancel} aria-label="Cancel renaming">
          <X />
        </Button>
      </div>
      {error && <p className={fieldInlineErrorClass}>{error}</p>}
    </form>
  );
}

/** Name (the row's link) with the hostname under it, or the rename form. */
function ServerName({
  server,
  renaming,
  onSaved,
  onCancel,
}: {
  server: Server;
  renaming: boolean;
  onSaved: (server: Server) => void;
  onCancel: () => void;
}) {
  return (
    <div className="min-w-0">
      {renaming ? (
        <RenameForm server={server} onSaved={onSaved} onCancel={onCancel} />
      ) : (
        // the link stretches over the whole row, so the row opens the server
        <Link
          href={`/servers/${server.id}`}
          className="block truncate text-[14px] font-semibold text-foreground after:absolute after:inset-0 after:content-['']"
        >
          {server.name}
        </Link>
      )}
      {server.hostname && <p className="mt-0.5 truncate font-mono text-[12.5px] text-muted-foreground">{server.hostname}</p>}
    </div>
  );
}

function LastReport({ server, never = 'Never', className }: { server: Server; never?: string; className?: string }) {
  return server.lastHeartbeat ? (
    <RelativeTime value={server.lastHeartbeat} className={cn('relative z-10', className)} />
  ) : (
    <span className={className}>{never}</span>
  );
}

// ---------------------------------------------------------------------------

type ServerList = ReturnType<typeof useServerList>;
type Connect = { title: string; apiKey: string } | null;

function ServersContent({
  list,
  canManage,
  adding,
  setAdding,
  connect,
  setConnect,
}: {
  list: ServerList;
  canManage: boolean;
  adding: boolean;
  setAdding: (adding: boolean) => void;
  connect: Connect;
  setConnect: (connect: Connect) => void;
}) {
  const { servers, error, updatedAt, retry, replace, remove, add } = list;
  const [filter, setFilter] = useState<Filter>('all');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const actions = useServerActions({
    onDeleted: (server) => remove(server.id),
    onKeyReplaced: (server, apiKey) => {
      setConnect({ title: `New agent key for ${server.name}`, apiKey });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  });

  const sorted = [...(servers ?? [])].sort(
    (a, b) => (STATUS_ORDER[a.status] ?? 1) - (STATUS_ORDER[b.status] ?? 1) || a.name.localeCompare(b.name),
  );
  const shown = filter === 'all' ? sorted : sorted.filter((s) => s.status === filter);
  const count = (status: Server['status']) => sorted.filter((s) => s.status === status).length;

  // renaming happens in the row; the other actions open dialogs
  const menuFor = (server: Server) =>
    canManage && (
      <ServerMenu
        server={server}
        onAction={(kind) => (kind === 'rename' ? setRenamingId(server.id) : actions.open(kind, server))}
      />
    );

  return (
    <div className="space-y-5 sm:space-y-6">
      {error && servers && (
        <Notice
          tone="error"
          action={
            <Button size="xs" variant="outline" onClick={retry}>
              Try again
            </Button>
          }
        >
          {error} {updatedAt ? `Showing the list from ${formatTime(updatedAt)}.` : ''}
        </Notice>
      )}

      {connect && <ConnectPanel title={connect.title} apiKey={connect.apiKey} onDone={() => setConnect(null)} />}

      {adding && canManage && !connect && (
        <AddServerForm
          onCancel={() => setAdding(false)}
          onAdded={(server, apiKey) => {
            add(server);
            setAdding(false);
            setFilter('all');
            setConnect({ title: `Connect ${server.name}`, apiKey });
          }}
        />
      )}

      {servers && servers.length > 1 && (
        <FilterTabs
          label="Show servers"
          value={filter}
          onValueChange={(value) => setFilter(value as Filter)}
          tabs={[
            { value: 'all', label: 'All', count: servers.length },
            { value: 'ONLINE', label: 'Online', count: count('ONLINE') },
            { value: 'OFFLINE', label: 'Offline', count: count('OFFLINE') },
            { value: 'UNKNOWN', label: 'Waiting', count: count('UNKNOWN') },
          ]}
        />
      )}

      <Panel flush>
        {!servers ? (
          error ? (
            <EmptyState
              icon={AlertCircle}
              tone="error"
              title="Couldn't load your servers"
              description={error}
              action={
                <Button size="sm" variant="outline" onClick={retry}>
                  Try again
                </Button>
              }
            />
          ) : (
            <SkeletonRows rows={4} />
          )
        ) : servers.length === 0 ? (
          <EmptyState
            art="server"
            title="No servers yet"
            description="Add a server, then start its agent with the key you get. Metrics arrive within seconds."
            action={
              canManage &&
              !adding &&
              !connect && (
                <Button size="sm" onClick={() => setAdding(true)}>
                  <Plus />
                  Add server
                </Button>
              )
            }
          />
        ) : shown.length === 0 ? (
          <EmptyState
            title={FILTER_EMPTY[filter]}
            className="py-10"
            action={
              <Button size="sm" variant="outline" onClick={() => setFilter('all')}>
                Show all servers
              </Button>
            }
          />
        ) : (
          <>
            {/* tablets and up: a table */}
            <table className="hidden w-full text-[14px] md:table">
              <thead>
                <tr className="border-b border-border text-left">
                  <th scope="col" className="text-label px-5 py-3 font-medium">
                    Server
                  </th>
                  <th scope="col" className="text-label px-5 py-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="text-label px-5 py-3 text-right font-medium">
                    Last report
                  </th>
                  <th scope="col" className="text-label hidden px-5 py-3 text-right font-medium lg:table-cell">
                    Added
                  </th>
                  <th scope="col" className="w-14 px-3 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shown.map((server) => (
                  <tr
                    key={server.id}
                    className="relative border-b border-border transition-colors duration-[120ms] last:border-0 hover:bg-accent/40"
                  >
                    <td className="max-w-0 px-5 py-3.5 lg:w-[40%]">
                      <ServerName
                        server={server}
                        renaming={renamingId === server.id}
                        onSaved={(updated) => {
                          replace(updated);
                          setRenamingId(null);
                        }}
                        onCancel={() => setRenamingId(null)}
                      />
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5">
                      <ServerStatusBadge status={server.status} />
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 text-right text-[13px] tabular-nums text-muted-foreground">
                      <LastReport server={server} />
                    </td>
                    <td className="hidden whitespace-nowrap px-5 py-3.5 text-right text-[13px] tabular-nums text-muted-foreground lg:table-cell">
                      {formatDate(server.createdAt)}
                    </td>
                    <td className="px-3 py-3.5 text-right">{menuFor(server)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* phones: a stacked list */}
            <ul className="divide-y divide-border md:hidden">
              {shown.map((server) => (
                <li key={server.id} className="relative flex items-start gap-2 py-3 pl-4 pr-2 transition-colors active:bg-accent/40">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <ServerName
                        server={{ ...server, hostname: null }}
                        renaming={renamingId === server.id}
                        onSaved={(updated) => {
                          replace(updated);
                          setRenamingId(null);
                        }}
                        onCancel={() => setRenamingId(null)}
                      />
                      <ServerStatusBadge status={server.status} short className="shrink-0" />
                    </div>
                    <p className="mt-0.5 flex min-w-0 items-center gap-2 text-[12.5px] text-muted-foreground">
                      {server.hostname && <span className="truncate font-mono">{server.hostname}</span>}
                      {server.hostname && <span aria-hidden>·</span>}
                      <span className="shrink-0 whitespace-nowrap">
                        {server.lastHeartbeat ? 'Last report ' : ''}
                        <LastReport server={server} never="No report yet" />
                      </span>
                    </p>
                  </div>
                  <div className="-my-1">{menuFor(server)}</div>
                </li>
              ))}
            </ul>
          </>
        )}
        {servers && servers.length > 0 && !canManage && (
          <p className="border-t border-border px-4 py-3.5 text-[13.5px] text-muted-foreground sm:px-5">
            Only owners, admins and DevOps engineers can add or change servers.
          </p>
        )}
      </Panel>

      {actions.dialogs}
    </div>
  );
}

function ServersPageInner() {
  const { user } = useAuth();
  const canManage = canManageServers(user?.role);
  const openFromLink = useSearchParams().get('add') === '1';
  const list = useServerList();
  const [adding, setAdding] = useState(openFromLink && canManage);
  const [connect, setConnect] = useState<Connect>(null);
  const { servers, error, updatedAt } = list;
  const online = servers?.filter((s) => s.status === 'ONLINE').length ?? 0;

  return (
    <AppShell
      title="Servers"
      meta={
        servers &&
        servers.length > 0 && (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              {online} of {servers.length} online
            </span>
            <span aria-hidden className="h-3.5 w-px bg-border-strong" />
            <LiveIndicator state={error ? 'paused' : 'live'} every="10 s" updatedAt={updatedAt} />
          </span>
        )
      }
      actions={
        canManage &&
        !adding &&
        !connect &&
        !!servers &&
        servers.length > 0 && (
          <Button
            className="flex-1 sm:flex-none"
            onClick={() => {
              setConnect(null);
              setAdding(true);
            }}
          >
            <Plus />
            Add server
          </Button>
        )
      }
    >
      <ServersContent
        list={list}
        canManage={canManage}
        adding={adding}
        setAdding={setAdding}
        connect={connect}
        setConnect={setConnect}
      />
    </AppShell>
  );
}

export default function ServersPage() {
  return (
    <ProtectedRoute>
      {/* useSearchParams (?add=1 from the dashboard) needs a Suspense boundary */}
      <Suspense fallback={null}>
        <ServersPageInner />
      </Suspense>
    </ProtectedRoute>
  );
}
