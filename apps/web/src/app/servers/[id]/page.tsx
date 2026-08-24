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
  networkIn: number | null;
  networkOut: number | null;
  diskReadRate: number | null;
  diskWriteRate: number | null;
  processCount: number | null;
  loadAverage: number | null;
  timestamp: string;
}

interface ServerDetail {
  server: { id: string; name: string; status: string; lastHeartbeat: string | null };
  metrics: Metric[];
}
interface AnomalyScore {
  reconstructionError?: number;
  threshold?: number;
  isAnomaly?: boolean;
  error?: string;
}

function ServerDetailContent() {
  const params = useParams();
  const serverId = params.id as string;
  const [data, setData] = useState<ServerDetail | null>(null);
  const [error, setError] = useState('');
  const [anomalyScore, setAnomalyScore] = useState<AnomalyScore | null>(null);

  function loadAnomalyScore() {
    apiClient
      .get<AnomalyScore>(`/servers/${serverId}/anomaly-score`)
      .then(setAnomalyScore)
      .catch(() => setAnomalyScore(null));
  }
  
  function loadData() {
    apiClient
      .get<ServerDetail>(`/servers/${serverId}/metrics?limit=50`)
      .then(setData)
      .catch((err) => setError(err.message));
  }

  useEffect(() => {
    loadData();
    loadAnomalyScore();
    const interval = setInterval(() => {
      loadData();
      loadAnomalyScore();
    }, 10000);
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
    NetworkIn: m.networkIn,
    NetworkOut: m.networkOut,
    DiskRead: m.diskReadRate,
    DiskWrite: m.diskWriteRate,
    Processes: m.processCount,
    LoadAvg: m.loadAverage,
  }));

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/servers" className="text-sm text-blue-600 hover:underline">
          ← Servers
        </Link>
        <h1 className="mt-1 mb-6 text-xl font-semibold">{data.server.name}</h1>
        
        {anomalyScore && !anomalyScore.error && (
          <div
            className={`mb-4 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium ${
              anomalyScore.isAnomaly ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${anomalyScore.isAnomaly ? 'bg-red-500' : 'bg-green-500'}`} />
            {anomalyScore.isAnomaly ? 'LSTM: Anomaly Detected' : 'LSTM: Normal'}
            <span className="text-xs opacity-70">
              (error: {anomalyScore.reconstructionError?.toFixed(4)} / threshold: {anomalyScore.threshold?.toFixed(4)})
            </span>
          </div>
        )}

        {data.metrics.length === 0 ? (
          <div className="rounded-lg border bg-white p-6 text-center text-gray-400 shadow-sm">
            No metrics yet — make sure the agent is running and pushing to this server&apos;s API key.
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-lg border bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-medium">Resource Usage (%)</h2>
              <ResponsiveContainer width="100%" height={300}>
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
          <div className="rounded-lg border bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-medium">Network Throughput (bytes/sec)</h2>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="NetworkIn" stroke="#8b5cf6" strokeWidth={2} dot={false} connectNulls />
                  <Line type="monotone" dataKey="NetworkOut" stroke="#ec4899" strokeWidth={2} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div className="rounded-lg border bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-medium">Disk I/O (bytes/sec)</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="DiskRead" stroke="#06b6d4" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="DiskWrite" stroke="#f97316" strokeWidth={2} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="rounded-lg border bg-white p-6 shadow-sm">
                <h2 className="mb-4 text-lg font-medium">Processes &amp; Load</h2>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="Processes" stroke="#6366f1" strokeWidth={2} dot={false} connectNulls />
                    <Line type="monotone" dataKey="LoadAvg" stroke="#84cc16" strokeWidth={2} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              </div>
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