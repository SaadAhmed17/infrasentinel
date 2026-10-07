'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowLeft, BrainCircuit, Cpu, Gauge, HardDrive, MemoryStick, ShieldAlert, ShieldCheck } from 'lucide-react';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/app-shell';
import { apiClient } from '@/lib/api-client';
import { axisProps, gridProps, tooltipProps } from '@/lib/chart-theme';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Notice } from '@/components/ui/notice';
import { Panel } from '@/components/ui/panel';
import { StatTile } from '@/components/ui/stat-tile';
import { ServerStatusBadge } from '@/components/ui/status';
import { TONE_COLOR, type Tone } from '@/components/ui/tone';

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
  server: { id: string; name: string; hostname?: string | null; status: string; lastHeartbeat: string | null };
  metrics: Metric[];
}
interface AnomalyScore {
  reconstructionError?: number;
  threshold?: number;
  isAnomaly?: boolean;
  error?: string;
}

const SERIES = {
  cpu: 'var(--chart-1)',
  memory: 'var(--chart-2)',
  disk: 'var(--chart-3)',
  read: 'var(--chart-2)',
  write: 'var(--chart-3)',
  netIn: 'var(--chart-1)',
  netOut: 'var(--chart-4)',
  processes: 'var(--chart-2)',
  load: 'var(--chart-5)',
};

function formatRate(value: number | null | undefined) {
  if (value == null) return '—';
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  let v = value;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 || i === 0 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}

function timeSince(dateStr: string | null) {
  if (!dateStr) return 'never';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
}

function usageTone(value: number): Tone {
  if (value >= 90) return 'critical';
  if (value >= 75) return 'medium';
  return 'primary';
}

function Meter({ value, tone }: { value: number; tone: Tone }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
      <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: TONE_COLOR[tone] }} />
    </div>
  );
}

function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="hidden flex-wrap items-center gap-4 sm:flex">
      {items.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-1.5 font-mono text-[12px] text-muted-foreground">
          <span className="h-0.5 w-3.5 rounded-full" style={{ background: item.color }} aria-hidden />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function ChartPanel({
  label,
  title,
  legend,
  height,
  className,
  children,
}: {
  label: string;
  title: string;
  legend: { label: string; color: string }[];
  height: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Panel label={label} title={title} actions={<Legend items={legend} />} className={className} bodyClassName="px-3 pb-3 pt-5">
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}

function AnomalyPanel({ score, checked }: { score: AnomalyScore | null; checked: boolean }) {
  if (!checked) {
    return (
      <Panel label="LSTM model" title="Anomaly detection">
        <div className="h-36 animate-pulse rounded-lg bg-muted" />
      </Panel>
    );
  }

  if (!score || score.error || score.reconstructionError == null || score.threshold == null) {
    return (
      <Panel label="LSTM model" title="Anomaly detection">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <BrainCircuit className="size-[18px]" strokeWidth={1.8} />
          </span>
          <div>
            <p className="text-[14.5px] font-semibold text-foreground">Score not available yet</p>
            <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
              A score appears here once an LSTM model has been trained on this server&apos;s history and the AI
              service is reachable.
            </p>
          </div>
        </div>
      </Panel>
    );
  }

  const ratio = score.reconstructionError / score.threshold;
  const tone: Tone = score.isAnomaly ? 'critical' : 'online';
  const Icon = score.isAnomaly ? ShieldAlert : ShieldCheck;
  return (
    <Panel label="LSTM model" title="Anomaly detection" brackets>
      <div className="flex items-start gap-3">
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-lg"
          style={{ color: TONE_COLOR[tone], background: `color-mix(in oklab, ${TONE_COLOR[tone]} 14%, transparent)` }}
        >
          <Icon className="size-[18px]" strokeWidth={1.9} />
        </span>
        <div>
          <p className="text-[15px] font-semibold" style={{ color: TONE_COLOR[tone] }}>
            {score.isAnomaly ? 'Anomaly detected' : 'Normal behaviour'}
          </p>
          <p className="mt-1 text-[13.5px] text-muted-foreground">
            {score.isAnomaly
              ? 'Recent readings do not match what the model learned for this server.'
              : 'Recent readings match what the model learned for this server.'}
          </p>
        </div>
      </div>

      {/* error against threshold; the marker sits in the middle of the bar */}
      <div className="mt-6">
        <div className="relative h-2 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full" style={{ width: `${Math.min(100, ratio * 50)}%`, background: TONE_COLOR[tone] }} />
        </div>
        <div className="relative mt-1 h-3">
          <span className="absolute left-1/2 top-0 h-3 w-px -translate-x-1/2 bg-border-strong" aria-hidden />
        </div>
        <dl className="mt-1 grid grid-cols-2 gap-3 font-mono text-[12px]">
          <div>
            <dt className="text-muted-foreground">Reconstruction error</dt>
            <dd className="mt-0.5 text-[14px] text-foreground">{score.reconstructionError.toFixed(4)}</dd>
          </div>
          <div className="text-right">
            <dt className="text-muted-foreground">Threshold</dt>
            <dd className="mt-0.5 text-[14px] text-foreground">{score.threshold.toFixed(4)}</dd>
          </div>
        </dl>
      </div>
    </Panel>
  );
}

function BackToServers() {
  return (
    <Link href="/servers" className={buttonVariants({ variant: 'outline' })}>
      <ArrowLeft />
      All servers
    </Link>
  );
}

function ServerDetailContent() {
  const params = useParams();
  const serverId = params.id as string;
  const [data, setData] = useState<ServerDetail | null>(null);
  const [error, setError] = useState('');
  const [anomalyScore, setAnomalyScore] = useState<AnomalyScore | null>(null);
  const [anomalyChecked, setAnomalyChecked] = useState(false);

  useEffect(() => {
    function loadAnomalyScore() {
      apiClient
        .get<AnomalyScore>(`/servers/${serverId}/anomaly-score`)
        .then(setAnomalyScore)
        .catch(() => setAnomalyScore(null))
        .finally(() => setAnomalyChecked(true));
    }

    function loadData() {
      apiClient
        .get<ServerDetail>(`/servers/${serverId}/metrics?limit=50`)
        .then(setData)
        .catch((err) => setError(err.message));
    }

    loadData();
    loadAnomalyScore();
    const interval = setInterval(() => {
      loadData();
      loadAnomalyScore();
    }, 10000);
    return () => clearInterval(interval);
  }, [serverId]);

  if (error) {
    return (
      <AppShell title="Server" actions={<BackToServers />}>
        <Notice tone="error">{error}</Notice>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell title="Server" actions={<BackToServers />}>
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
          <div className="h-80 animate-pulse rounded-xl bg-muted" />
        </div>
      </AppShell>
    );
  }

  const chartData = data.metrics.map((m) => ({
    time: new Date(m.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }),
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
  const { server } = data;

  return (
    <AppShell
      title={server.name}
      description={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <ServerStatusBadge status={server.status} />
          <span className="font-mono text-[12.5px]">last report {timeSince(server.lastHeartbeat)}</span>
          {server.hostname && <span className="font-mono text-[12.5px]">{server.hostname}</span>}
        </span>
      }
      actions={<BackToServers />}
    >
      {data.metrics.length === 0 ? (
        <Panel flush>
          <EmptyState
            art="server"
            title="No metrics yet"
            description="Start the agent on this server with its key. Readings appear here within about 10 seconds."
          />
        </Panel>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
            <StatTile
              label="CPU"
              value={`${latest.cpuUsage.toFixed(0)}%`}
              tone={usageTone(latest.cpuUsage)}
              icon={Cpu}
              hint={<Meter value={latest.cpuUsage} tone={usageTone(latest.cpuUsage)} />}
            />
            <StatTile
              label="Memory"
              value={`${latest.memUsage.toFixed(0)}%`}
              tone={usageTone(latest.memUsage)}
              icon={MemoryStick}
              hint={<Meter value={latest.memUsage} tone={usageTone(latest.memUsage)} />}
            />
            <StatTile
              label="Disk"
              value={`${latest.diskUsage.toFixed(0)}%`}
              tone={usageTone(latest.diskUsage)}
              icon={HardDrive}
              hint={<Meter value={latest.diskUsage} tone={usageTone(latest.diskUsage)} />}
            />
            <StatTile
              label="Load average"
              value={latest.loadAverage != null ? latest.loadAverage.toFixed(2) : '—'}
              tone="primary"
              icon={Gauge}
              hint={latest.loadAverage != null ? `${latest.processCount ?? '—'} processes` : 'not reported by this agent'}
            />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <ChartPanel
              className="xl:col-span-2"
              label="Last 50 readings"
              title="Resource usage"
              height={260}
              legend={[
                { label: 'CPU', color: SERIES.cpu },
                { label: 'Memory', color: SERIES.memory },
                { label: 'Disk', color: SERIES.disk },
              ]}
            >
              <LineChart data={chartData} margin={{ top: 4, right: 28, bottom: 0, left: -12 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="time" {...axisProps} minTickGap={48} />
                <YAxis domain={[0, 100]} unit="%" {...axisProps} width={48} />
                <Tooltip {...tooltipProps} formatter={(v) => `${Number(v).toFixed(1)}%`} />
                <Line type="monotone" dataKey="CPU" stroke={SERIES.cpu} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="Memory" stroke={SERIES.memory} strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="Disk" stroke={SERIES.disk} strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ChartPanel>
            <AnomalyPanel score={anomalyScore} checked={anomalyChecked} />
          </div>

          <ChartPanel
            label="Network"
            title="Throughput"
            height={220}
            legend={[
              { label: 'In', color: SERIES.netIn },
              { label: 'Out', color: SERIES.netOut },
            ]}
          >
            <AreaChart data={chartData} margin={{ top: 4, right: 28, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="net-in" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES.netIn} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={SERIES.netIn} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="net-out" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES.netOut} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={SERIES.netOut} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...gridProps} />
              <XAxis dataKey="time" {...axisProps} minTickGap={48} />
              <YAxis {...axisProps} width={72} tickFormatter={(v) => formatRate(Number(v))} />
              <Tooltip {...tooltipProps} formatter={(v) => formatRate(Number(v))} />
              <Area type="monotone" dataKey="NetworkIn" name="In" stroke={SERIES.netIn} strokeWidth={2} fill="url(#net-in)" connectNulls isAnimationActive={false} />
              <Area type="monotone" dataKey="NetworkOut" name="Out" stroke={SERIES.netOut} strokeWidth={2} fill="url(#net-out)" connectNulls isAnimationActive={false} />
            </AreaChart>
          </ChartPanel>

          <div className="grid gap-6 xl:grid-cols-2">
            <ChartPanel
              label="Storage"
              title="Disk I/O"
              height={200}
              legend={[
                { label: 'Read', color: SERIES.read },
                { label: 'Write', color: SERIES.write },
              ]}
            >
              <LineChart data={chartData} margin={{ top: 4, right: 28, bottom: 0, left: 4 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="time" {...axisProps} minTickGap={48} />
                <YAxis {...axisProps} width={72} tickFormatter={(v) => formatRate(Number(v))} />
                <Tooltip {...tooltipProps} formatter={(v) => formatRate(Number(v))} />
                <Line type="monotone" dataKey="DiskRead" name="Read" stroke={SERIES.read} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                <Line type="monotone" dataKey="DiskWrite" name="Write" stroke={SERIES.write} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
              </LineChart>
            </ChartPanel>
            <ChartPanel
              label="System"
              title="Processes and load"
              height={200}
              legend={[
                { label: 'Processes', color: SERIES.processes },
                { label: 'Load', color: SERIES.load },
              ]}
            >
              <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
                <CartesianGrid {...gridProps} />
                <XAxis dataKey="time" {...axisProps} minTickGap={48} />
                <YAxis yAxisId="processes" {...axisProps} width={48} />
                <YAxis yAxisId="load" orientation="right" {...axisProps} width={40} />
                <Tooltip {...tooltipProps} />
                <Line yAxisId="processes" type="monotone" dataKey="Processes" stroke={SERIES.processes} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
                <Line yAxisId="load" type="monotone" dataKey="LoadAvg" name="Load" stroke={SERIES.load} strokeWidth={2} dot={false} connectNulls isAnimationActive={false} />
              </LineChart>
            </ChartPanel>
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
