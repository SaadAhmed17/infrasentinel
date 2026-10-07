'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BrainCircuit, Cpu, Gauge, HardDrive, MemoryStick, ShieldAlert, ShieldCheck } from 'lucide-react';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/app-shell';
import { apiClient } from '@/lib/api-client';
import { downsample, withGaps } from '@/lib/chart-data';
import { chartColors } from '@/lib/chart-theme';
import { formatRate } from '@/lib/format';
import { ChartReadings, LegendKey, type Threshold } from '@/components/charts/chart-kit';
import { lastValue, RateChart, SingleChart, UsageCharts, type MetricRow } from '@/components/charts/server-charts';
import { buttonVariants } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Notice } from '@/components/ui/notice';
import { Panel } from '@/components/ui/panel';
import { StatTile } from '@/components/ui/stat-tile';
import { ServerStatusBadge } from '@/components/ui/status';
import { FilterTabs } from '@/components/ui/tabs';
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
interface Rule {
  name: string;
  ruleType: string;
  metricField: string | null;
  operator: string | null;
  threshold: number | null;
  severity: string;
  isActive: boolean;
}

// Time ranges for the charts (the agent reports every 10 s). Longer ranges
// refresh less often and are thinned to about 300 points.
const RANGES = [
  { value: '10m', label: '10 min', minutes: 10, limit: 60, every: 10_000 },
  { value: '1h', label: '1 h', minutes: 60, limit: 360, every: 30_000 },
  { value: '6h', label: '6 h', minutes: 360, limit: 2160, every: 60_000 },
];

// Which chart each metric-threshold rule belongs to.
const METRIC_KEY: Record<string, keyof Omit<MetricRow, 't'>> = {
  CPU_USAGE: 'cpu',
  MEM_USAGE: 'mem',
  DISK_USAGE: 'disk',
  NETWORK_IN: 'netIn',
  NETWORK_OUT: 'netOut',
  DISK_READ_RATE: 'read',
  DISK_WRITE_RATE: 'write',
  PROCESS_COUNT: 'processes',
  LOAD_AVERAGE: 'load',
};

const percent = (v: number) => `${v.toFixed(1)}%`;
const loadFormat = (v: number) => (v >= 10 ? v.toFixed(0) : v.toFixed(1));
const countFormat = (v: number) => `${Math.round(v)}`;

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

function ChartPanel({
  title,
  legend,
  className,
  children,
  readings,
}: {
  title: string;
  legend?: ReactNode;
  className?: string;
  children: ReactNode;
  readings?: ReactNode;
}) {
  return (
    <Panel title={title} className={className} flush>
      {/* the legend sits with the chart so panel headers line up across a row */}
      {legend && <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 px-4 pt-3 sm:px-5">{legend}</div>}
      <div className={legend ? 'px-3 pb-3 pt-2 sm:px-4' : 'px-3 pb-3 pt-4 sm:px-4'}>{children}</div>
      {readings}
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
            {score.isAnomaly ? 'Anomaly detected' : 'Normal behavior'}
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

function toRows(metrics: Metric[]): MetricRow[] {
  return metrics.map((m) => ({
    t: new Date(m.timestamp).getTime(),
    cpu: m.cpuUsage,
    mem: m.memUsage,
    disk: m.diskUsage,
    netIn: m.networkIn,
    netOut: m.networkOut,
    read: m.diskReadRate,
    write: m.diskWriteRate,
    processes: m.processCount,
    load: m.loadAverage,
  }));
}

function ServerDetailContent() {
  const params = useParams();
  const serverId = params.id as string;
  const [range, setRange] = useState('10m');
  const [data, setData] = useState<ServerDetail | null>(null);
  const [error, setError] = useState('');
  const [anomalyScore, setAnomalyScore] = useState<AnomalyScore | null>(null);
  const [anomalyChecked, setAnomalyChecked] = useState(false);
  const [rules, setRules] = useState<Rule[]>([]);

  useEffect(() => {
    apiClient
      .get<Rule[]>('/rules')
      .then(setRules)
      .catch(() => setRules([]));
  }, []);

  useEffect(() => {
    const { limit, every } = RANGES.find((r) => r.value === range) ?? RANGES[0];

    function loadAnomalyScore() {
      apiClient
        .get<AnomalyScore>(`/servers/${serverId}/anomaly-score`)
        .then(setAnomalyScore)
        .catch(() => setAnomalyScore(null))
        .finally(() => setAnomalyChecked(true));
    }

    function loadData() {
      apiClient
        .get<ServerDetail>(`/servers/${serverId}/metrics?limit=${limit}`)
        .then(setData)
        .catch((err) => setError(err.message));
    }

    loadData();
    loadAnomalyScore();
    const interval = setInterval(() => {
      loadData();
      loadAnomalyScore();
    }, every);
    return () => clearInterval(interval);
  }, [serverId, range]);

  // Active metric-threshold rules, drawn as dashed lines on the matching chart.
  const thresholds = useMemo(() => {
    const byKey: Record<string, Threshold[]> = {};
    for (const r of rules) {
      if (!r.isActive || r.ruleType !== 'METRIC_THRESHOLD' || r.threshold === null || !r.metricField) continue;
      const key = METRIC_KEY[r.metricField];
      if (!key) continue;
      (byKey[key] ??= []).push({
        name: r.name,
        value: r.threshold,
        severity: r.severity,
        operator: r.operator === 'LESS_THAN' ? 'LESS_THAN' : 'GREATER_THAN',
      });
    }
    return byKey;
  }, [rules]);

  // The window ends at the latest reading, so an offline server still shows
  // its last readings, and a server that just started shows a short line.
  const { label: rangeLabel, minutes } = RANGES.find((r) => r.value === range) ?? RANGES[0];
  const rows = useMemo(() => {
    const all = data ? toRows(data.metrics) : [];
    const end = all[all.length - 1]?.t ?? 0;
    return all.filter((r) => r.t >= end - minutes * 60_000);
  }, [data, minutes]);
  const chartRows = useMemo(() => withGaps(downsample(rows)) as MetricRow[], [rows]);
  const timeWindow: [number, number] | undefined = rows.length
    ? [rows[rows.length - 1].t - minutes * 60_000, rows[rows.length - 1].t]
    : undefined;

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

  const latest = data.metrics[data.metrics.length - 1];
  const { server } = data;
  const latestRate = (key: 'netIn' | 'netOut' | 'read' | 'write') => {
    const v = lastValue(rows, key);
    return v === null ? undefined : formatRate(v);
  };

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

          {/* one time range for every chart below */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13.5px] text-muted-foreground">
              {rows.length > 1 ? `Charts show the last ${rangeLabel} of readings.` : 'Charts fill in as readings arrive.'}
            </p>
            <FilterTabs label="Time range" value={range} onValueChange={setRange} tabs={RANGES} />
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <ChartPanel
              className="min-w-0 xl:col-span-2"
              title="CPU, memory and disk"
              readings={
                <ChartReadings
                  rows={rows}
                  caption="Latest CPU, memory and disk readings"
                  columns={[
                    { key: 'cpu', label: 'CPU', format: percent },
                    { key: 'mem', label: 'Memory', format: percent },
                    { key: 'disk', label: 'Disk', format: percent },
                  ]}
                />
              }
            >
              <UsageCharts rows={chartRows} thresholds={thresholds} timeWindow={timeWindow} />
            </ChartPanel>
            <AnomalyPanel score={anomalyScore} checked={anomalyChecked} />
          </div>

          <ChartPanel
            title="Network"
            className="min-w-0"
            legend={
              <>
                <LegendKey color={chartColors.series[0]} label="In" value={latestRate('netIn')} />
                <LegendKey color={chartColors.series[1]} label="Out" value={latestRate('netOut')} />
              </>
            }
            readings={
              <ChartReadings
                rows={rows}
                caption="Latest network readings"
                columns={[
                  { key: 'netIn', label: 'In', format: formatRate },
                  { key: 'netOut', label: 'Out', format: formatRate },
                ]}
              />
            }
          >
            <RateChart
              rows={chartRows}
              timeWindow={timeWindow}
              height={220}
              series={[
                { key: 'netIn', label: 'In' },
                { key: 'netOut', label: 'Out' },
              ]}
              thresholds={[...(thresholds.netIn ?? []), ...(thresholds.netOut ?? [])]}
            />
          </ChartPanel>

          <div className="grid gap-6 lg:grid-cols-3">
            <ChartPanel
              title="Disk activity"
              className="min-w-0"
              legend={
                <>
                  <LegendKey color={chartColors.series[0]} label="Read" value={latestRate('read')} />
                  <LegendKey color={chartColors.series[1]} label="Write" value={latestRate('write')} />
                </>
              }
              readings={
                <ChartReadings
                  rows={rows}
                  caption="Latest disk activity readings"
                  columns={[
                    { key: 'read', label: 'Read', format: formatRate },
                    { key: 'write', label: 'Write', format: formatRate },
                  ]}
                />
              }
            >
              <RateChart
                rows={chartRows}
                timeWindow={timeWindow}
                series={[
                  { key: 'read', label: 'Read' },
                  { key: 'write', label: 'Write' },
                ]}
                thresholds={[...(thresholds.read ?? []), ...(thresholds.write ?? [])]}
              />
            </ChartPanel>
            <ChartPanel
              title="Load average"
              className="min-w-0"
              readings={
                <ChartReadings rows={rows} caption="Latest load average readings" columns={[{ key: 'load', label: 'Load', format: (v) => v.toFixed(2) }]} />
              }
            >
              <SingleChart rows={chartRows} timeWindow={timeWindow} dataKey="load" label="Load" format={loadFormat} thresholds={thresholds.load} height={200} />
            </ChartPanel>
            <ChartPanel
              title="Processes"
              className="min-w-0"
              readings={
                <ChartReadings rows={rows} caption="Latest process counts" columns={[{ key: 'processes', label: 'Processes', format: countFormat }]} />
              }
            >
              <SingleChart
                rows={chartRows}
                timeWindow={timeWindow}
                dataKey="processes"
                label="Processes"
                format={countFormat}
                thresholds={thresholds.processes}
                height={200}
              />
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
