'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ProtectedRoute } from '@/components/protected-route';
import { apiClient } from '@/lib/api-client';

interface Metric {
  id: string;
  cpuUsage: number;
  memUsage: number;
  diskUsage: number;
  timestamp: string;
}

interface ServerDetail {
  server: { id: string; name: string; status: string; lastHeartbeat: string | null };
  metrics: Metric[];
}

function ServerDetailContent() {
  const params = useParams();
  const serverId = params.id as string;
  const [data, setData] = useState<ServerDetail | null>(null);
  const [error, setError] = useState('');

  function loadData() {
    apiClient
      .get<ServerDetail>(`/servers/${serverId}/metrics?limit=50`)
      .then(setData)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [serverId]);

  if (error) {
    return <div className="p-8 text-red-600">{error}</div>;
  }

  if (!data) {
    return <div className="p-8">Loading...</div>;
  }

  const chartData = data.metrics.map((m) => ({
    time: new Date(m.timestamp).toLocaleTimeString(),
    CPU: m.cpuUsage,
    Memory: m.memUsage,
    Disk: m.diskUsage,
  }));

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/servers" className="text-sm text-blue-600 hover:underline">
          ← Servers
        </Link>
        <h1 className="mt-1 mb-6 text-xl font-semibold">{data.server.name}</h1>

        {data.metrics.length === 0 ? (
          <div className="rounded-lg border bg-white p-6 text-center text-gray-400 shadow-sm">
            No metrics yet — make sure the agent is running and pushing to this server&apos;s API key.
          </div>
        ) : (
          <div className="rounded-lg border bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-medium">Live Metrics (last {data.metrics.length} readings)</h2>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="CPU" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Memory" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Disk" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ServerDetailPage() {
  return (
    <ProtectedRoute>
      <ServerDetailContent />
    </ProtectedRoute>
  );
}