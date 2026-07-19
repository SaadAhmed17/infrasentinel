'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/protected-route';
import { apiClient } from '@/lib/api-client';

interface Server {
  id: string;
  name: string;
  hostname: string | null;
  status: 'ONLINE' | 'OFFLINE' | 'UNKNOWN';
  lastHeartbeat: string | null;
  createdAt: string;
}

function statusColor(status: Server['status']) {
  switch (status) {
    case 'ONLINE':
      return 'bg-green-100 text-green-700';
    case 'OFFLINE':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-600';
  }
}

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

  function loadServers() {
    apiClient
      .get<Server[]>('/servers')
      .then(setServers)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    loadServers();
    const interval = setInterval(loadServers, 10000); // refresh every 10s to reflect live heartbeats
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
      loadServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create server');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">
              ← Dashboard
            </Link>
            <h1 className="mt-1 text-xl font-semibold">Servers</h1>
          </div>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Add Server
          </button>
        </div>

        {newApiKey && (
          <div className="mb-6 rounded-lg border border-yellow-300 bg-yellow-50 p-4">
            <p className="text-sm font-medium text-yellow-800">
              Server created. Copy this API key now — it won&apos;t be shown again.
            </p>
            <code className="mt-2 block break-all rounded bg-white p-2 text-xs">{newApiKey}</code>
            <button
              onClick={() => setNewApiKey(null)}
              className="mt-2 text-xs text-yellow-700 underline"
            >
              I&apos;ve saved it, dismiss
            </button>
          </div>
        )}

        {showCreateForm && (
          <form onSubmit={handleCreate} className="mb-6 rounded-lg border bg-white p-4 shadow-sm">
            <label className="block text-sm font-medium text-gray-700">Server name</label>
            <div className="mt-1 flex gap-2">
              <input
                type="text"
                required
                value={newServerName}
                onChange={(e) => setNewServerName(e.target.value)}
                placeholder="e.g. Production DB Server"
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={creating}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        )}

        <div className="rounded-lg border bg-white p-6 shadow-sm">
          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2">Name</th>
                <th className="pb-2">Status</th>
                <th className="pb-2">Last Heartbeat</th>
              </tr>
            </thead>
            <tbody>
              {servers.map((s) => (
                <tr key={s.id} className="border-b last:border-0">
                  <td className="py-2">
  <Link href={`/servers/${s.id}`} className="text-blue-600 hover:underline">
    {s.name}
  </Link>
</td>
                  <td className="py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(s.status)}`}>
                      {s.status}
                    </span>
                  </td>
                  <td className="py-2 text-gray-600">{timeSince(s.lastHeartbeat)}</td>
                </tr>
              ))}
              {servers.length === 0 && (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-gray-400">
                    No servers yet — add one above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function ServersPage() {
  return (
    <ProtectedRoute>
      <ServersContent />
    </ProtectedRoute>
  );
}