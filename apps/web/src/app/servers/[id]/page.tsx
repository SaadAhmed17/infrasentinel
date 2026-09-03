'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/app-shell';
import { apiClient } from '@/lib/api-client';
import {
  ArrowLeft,
  Cpu,
  MemoryStick,
  HardDrive,
  Gauge,
  ShieldAlert,
  ShieldCheck,
  Activity,
} from 'lucide-react';

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

const GRID_STROKE = 'var(--border)';
const AXIS_STYLE = { fontSize: 11, fill: 'var(--muted-foreground)' };

function ChartCard({ title, height, children }: { title: string; height: number; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="mb-4 text-[16px] font-bold text-foreground">{title}</h2>
      <ResponsiveContainer width="100%" height={height}>
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  );
}

function SnapshotCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="size-4.5" strokeWidth={2.1} />
      </div>
      <div>
        <p className="text-[24px] font-bold leading-none tracking-tight text-foreground">{value}</p>
        <p className="mt-1 text-[13.5px] font-bold text-muted-foreground">{label}</p>
      </div>
    </div>
  );
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

  const title = data?.server.name ?? 'Server';

  if (error) {
    return (
      <AppShell title="Server">
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-[14px] font-medium text-red-600 dark:text-red-400">
          {error}
        </div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell title="Server">
        <div className="space-y-4">
          <div className="h-10 w-64 animate-pulse rounded-lg bg-muted" />
          <div className="h-64 animate-pulse rounded-xl bg-muted" />
        </div>
      </AppShell>
    );
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

  const latest = data.metrics[data.metrics.length - 1];

  return (
    <AppShell title={title}>
      <Link
        href="/servers"
        className="mb-4 inline-flex items-center gap-1.5 text-[14px] font-bold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" strokeWidth={2.25} />
        Servers
      </Link>

      {anomalyScore && !anomalyScore.error && (
        <div
          className={`mb-5 flex items-center gap-3 rounded-xl border p-4 ${
            anomalyScore.isAnomaly
              ? 'border-red-500/20 bg-red-500/10'
              : 'border-emerald-500/20 bg-emerald-500/10'
          }`}
        >
          <div
            className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
              anomalyScore.isAnomaly
                ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
            }`}
          >
            {anomalyScore.isAnomaly ? (
              <ShieldAlert className="size-4.5" strokeWidth={2} />
            ) : (
              <ShieldCheck className="size-4.5" strokeWidth={2} />
            )}
          </div>
          <div>
            <p className="text-[15px] font-bold text-foreground">
              {anomalyScore.isAnomaly ? 'Anomaly Detected' : 'Normal Behavior'}
            </p>
            <p className="text-[13px] font-medium text-muted-foreground">
              LSTM reconstruction error: {anomalyScore.reconstructionError?.toFixed(4)} · threshold:{' '}
              {anomalyScore.threshold?.toFixed(4)}
            </p>
          </div>
        </div>
      )}

      {data.metrics.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-14 text-center shadow-sm">
          <div className="flex size-10 items-center justify-center rounded-full bg-muted">
            <Activity className="size-4.5 text-muted-foreground" strokeWidth={1.75} />
          </div>
          <p className="text-[15px] font-bold text-foreground">No metrics yet</p>
          <p className="text-[14px] text-muted-foreground">
            Make sure the agent is running and pushing to this server&apos;s API key.
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Latest snapshot */}
          <div className="grid grid-cols-4 gap-4">
            <SnapshotCard
              icon={Cpu}
              label="CPU Usage"
              value={`${latest.cpuUsage.toFixed(0)}%`}
              tone="bg-blue-500/15 text-blue-600 dark:text-blue-400"
            />
            <SnapshotCard
              icon={MemoryStick}
              label="Memory Usage"
              value={`${latest.memUsage.toFixed(0)}%`}
              tone="bg-amber-500/15 text-amber-600 dark:text-amber-400"
            />
            <SnapshotCard
              icon={HardDrive}
              label="Disk Usage"
              value={`${latest.diskUsage.toFixed(0)}%`}
              tone="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
            />
            <SnapshotCard
              icon={Gauge}
              label="Load Average"
              value={latest.loadAverage != null ? latest.loadAverage.toFixed(2) : '—'}
              tone="bg-[oklch(0.62_0.19_265)]/15 text-[oklch(0.55_0.19_265)] dark:text-[oklch(0.72_0.15_265)]"
            />
          </div>

          <ChartCard title="Resource Usage (%)" height={280}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
              <XAxis dataKey="time" tick={AXIS_STYLE} />
              <YAxis domain={[0, 100]} tick={AXIS_STYLE} unit="%" />
              <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="CPU" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Memory" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Disk" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartCard>

          <ChartCard title="Network Throughput (bytes/sec)" height={240}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
              <XAxis dataKey="time" tick={AXIS_STYLE} />
              <YAxis tick={AXIS_STYLE} />
              <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="NetworkIn" stroke="#8b5cf6" strokeWidth={2} dot={false} connectNulls />
              <Line type="monotone" dataKey="NetworkOut" stroke="#ec4899" strokeWidth={2} dot={false} connectNulls />
            </LineChart>
          </ChartCard>

          <div className="grid grid-cols-2 gap-5">
            <ChartCard title="Disk I/O (bytes/sec)" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis dataKey="time" tick={AXIS_STYLE} />
                <YAxis tick={AXIS_STYLE} />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="DiskRead" stroke="#06b6d4" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="DiskWrite" stroke="#f97316" strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ChartCard>
            <ChartCard title="Processes & Load" height={220}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={GRID_STROKE} />
                <XAxis dataKey="time" tick={AXIS_STYLE} />
                <YAxis tick={AXIS_STYLE} />
                <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Processes" stroke="#6366f1" strokeWidth={2} dot={false} connectNulls />
                <Line type="monotone" dataKey="LoadAvg" stroke="#84cc16" strokeWidth={2} dot={false} connectNulls />
              </LineChart>
            </ChartCard>
          </div>
        </div>
      )}
    </AppShell>
  );
}

export default function ServerDetailPage() {
  return (
    <ProtectedRoute>
      <ServerDetailContent />
    </ProtectedRoute>
  );
}