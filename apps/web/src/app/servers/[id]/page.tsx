'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle, BrainCircuit, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/auth-context';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/app-shell';
import { ChartReadings, LegendKey, type Threshold } from '@/components/charts/chart-kit';
import { lastValue, RateChart, SingleChart, UsageCharts, type MetricRow } from '@/components/charts/server-charts';
import { agentSetupCommands, ConnectPanel } from '@/components/servers/connect-panel';
import { ServerMenu, useServerActions } from '@/components/servers/server-actions';
import { Button, buttonVariants } from '@/components/ui/button';
import { CodeBlock, CopyIconButton } from '@/components/ui/copy-button';
import { EmptyState } from '@/components/ui/empty-state';
import { LiveIndicator } from '@/components/ui/live-indicator';
import { UsageMeter } from '@/components/ui/meter';
import { Notice } from '@/components/ui/notice';
import { Panel } from '@/components/ui/panel';
import { RelativeTime } from '@/components/ui/relative-time';
import { Skeleton } from '@/components/ui/skeleton';
import { IncidentStatusBadge, SeverityBadge, ServerStatusBadge } from '@/components/ui/status';
import { FilterTabs } from '@/components/ui/tabs';
import { TONE_COLOR } from '@/components/ui/tone';
import { apiClient } from '@/lib/api-client';
import { downsample, withGaps } from '@/lib/chart-data';
import { chartColors } from '@/lib/chart-theme';
import { friendlyError, isNotFound } from '@/lib/errors';
import { formatDateTime, formatDuration, formatRate, plural } from '@/lib/format';
import { bySeverityThenRecent, incidentTitle, isOpenIncident } from '@/lib/incidents';
import { canManageServers } from '@/lib/permissions';
import { cn } from '@/lib/utils';

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
interface ServerInfo {
  id: string;
  name: string;
  hostname?: string | null;
  status: string;
  lastHeartbeat: string | null;
}
interface ServerDetail {
  server: ServerInfo;
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
interface IncidentRow {
  id: string;
  title: string;
  severity: string;
  status: string;
  createdAt: string;
  alerts: { id: string; serverId: string | null }[];
}

// Time ranges for the charts (the agent reports every 10 s). Longer ranges
// refresh less often and are thinned to about 300 points.
const RANGES = [
  { value: '10m', label: '10 min', minutes: 10, limit: 60, every: 10_000, everyLabel: '10 s' },
  { value: '1h', label: '1 h', minutes: 60, limit: 360, every: 30_000, everyLabel: '30 s' },
  { value: '6h', label: '6 h', minutes: 360, limit: 2160, every: 60_000, everyLabel: '1 min' },
];
// The anomaly score and the server's incidents change slowly.
const SLOW_REFRESH_MS = 30_000;
const INCIDENTS_SHOWN = 5;

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

/**
 * Metrics for the chosen range (refreshed at the range's pace), plus the
 * anomaly score, rules for thresholds and this server's incidents.
 */
function useServerDetail(serverId: string, range: (typeof RANGES)[number]) {
  const [data, setData] = useState<ServerDetail | null>(null);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [anomaly, setAnomaly] = useState<AnomalyScore | null>(null);
  const [anomalyChecked, setAnomalyChecked] = useState(false);
  const [rules, setRules] = useState<Rule[]>([]);
  const [incidents, setIncidents] = useState<IncidentRow[] | null>(null);
  const [attempt, setAttempt] = useState(0);
  const { limit, every } = range;

  useEffect(() => {
    apiClient
      .get<Rule[]>('/rules')
      .then(setRules)
      .catch(() => setRules([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    function load() {
      apiClient
        .get<ServerDetail>(`/servers/${serverId}/metrics?limit=${limit}`)
        .then((detail) => {
          if (cancelled) return;
          setData(detail);
          setError('');
          setUpdatedAt(Date.now());
        })
        .catch((err) => {
          if (cancelled) return;
          if (isNotFound(err)) setNotFound(true);
          else setError(friendlyError(err));
        });
    }
    load();
    const timer = window.setInterval(load, every);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [serverId, limit, every, attempt]);

  useEffect(() => {
    let cancelled = false;
    function load() {
      apiClient
        .get<AnomalyScore | null>(`/servers/${serverId}/anomaly-score`)
        .then((score) => !cancelled && setAnomaly(score))
        .catch(() => !cancelled && setAnomaly(null))
        .finally(() => !cancelled && setAnomalyChecked(true));
      apiClient
        .get<IncidentRow[]>('/incidents')
        .then((list) => !cancelled && setIncidents(list.filter((i) => i.alerts.some((a) => a.serverId === serverId))))
        .catch(() => undefined);
    }
    load();
    const timer = window.setInterval(load, SLOW_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [serverId]);

  return {
    data,
    setData,
    error,
    notFound,
    updatedAt,
    anomaly,
    anomalyChecked,
    rules,
    incidents,
    retry: () => setAttempt((n) => n + 1),
  };
}

// ---------------------------------------------------------------------------
// Tiles

function MetricTile({
  label,
  value,
  stale,
  children,
}: {
  label: string;
  value: ReactNode;
  stale: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-panel)] sm:p-5">
      <p className="text-[13px] font-medium text-muted-foreground">
        {label}
        {stale && <span className="font-normal"> · last reading</span>}
      </p>
      <div className={cn(stale && 'opacity-60')}>
        <p className="mt-2 text-[22px] font-semibold leading-none tracking-[-0.02em] text-foreground sm:text-[28px]">{value}</p>
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  );
}

function UsageTile({
  label,
  value,
  limit,
  stale,
}: {
  label: string;
  value: number;
  limit?: Threshold;
  stale: boolean;
}) {
  return (
    <MetricTile label={label} value={`${value.toFixed(0)}%`} stale={stale}>
      <UsageMeter value={value} label={`${label} usage`} limit={limit?.value} />
      <p className="mt-2 truncate text-[12.5px] text-muted-foreground">
        {limit ? `${limit.name} at ${limit.value}%` : 'No rule on this metric'}
      </p>
    </MetricTile>
  );
}

// ---------------------------------------------------------------------------
// Anomaly score

// The error against the model's threshold, on a scale from 0 to twice the
// threshold. Beyond 2× the bar is full and ends in an arrow.
function AnomalyGauge({ ratio, color }: { ratio: number; color: string }) {
  const overflow = ratio > 2;
  return (
    <div aria-hidden>
      <div className="relative h-2 rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full', overflow && 'rounded-r-none')}
          style={{ width: `${(Math.min(ratio, 2) / 2) * 100}%`, background: color }}
        />
        {overflow && (
          <span
            className="absolute -right-[7px] top-1/2 -translate-y-1/2 border-y-[6px] border-l-[8px] border-y-transparent"
            style={{ borderLeftColor: color }}
          />
        )}
        <span className="absolute left-1/2 top-1/2 h-4 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-foreground/60" />
      </div>
      <div className="relative mt-1.5 flex justify-between text-[11.5px] tabular-nums text-muted-foreground">
        <span>0</span>
        <span className="absolute left-1/2 -translate-x-1/2">Threshold</span>
        <span>2×</span>
      </div>
    </div>
  );
}

function AnomalyPanel({ score, checked, className }: { score: AnomalyScore | null; checked: boolean; className?: string }) {
  const hasScore = !!score && !score.error && score.reconstructionError != null && !!score.threshold;

  if (!checked) {
    return (
      <Panel title="Anomaly detection" className={className}>
        <div className="space-y-3" role="status" aria-label="Loading">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-8 w-1/3" />
          <Skeleton className="h-2 w-full" />
        </div>
      </Panel>
    );
  }

  if (!hasScore) {
    return (
      <Panel title="Anomaly detection" className={className}>
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground" aria-hidden>
            <BrainCircuit className="size-[18px]" strokeWidth={1.75} />
          </span>
          <div>
            <p className="text-[14.5px] font-semibold text-foreground">No anomaly score yet</p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
              A model is trained for each server from its own history. The score shows up here once the model is ready
              and the AI service can be reached.
            </p>
          </div>
        </div>
      </Panel>
    );
  }

  const error = score.reconstructionError as number;
  const threshold = score.threshold as number;
  const ratio = error / threshold;
  const anomalous = !!score.isAnomaly;
  const color = anomalous ? TONE_COLOR.critical : TONE_COLOR.online;
  const Icon = anomalous ? ShieldAlert : ShieldCheck;

  return (
    <Panel title="Anomaly detection" brackets className={className}>
      <p className="flex items-center gap-2 text-[14.5px] font-semibold" style={{ color }}>
        <Icon className="size-[18px]" strokeWidth={1.9} aria-hidden />
        {anomalous ? 'Anomaly detected' : 'Normal behavior'}
      </p>
      <p className="mt-3 flex items-baseline gap-2">
        <span className="text-[28px] font-semibold leading-none tracking-[-0.02em] text-foreground">
          {ratio >= 10 ? ratio.toFixed(0) : ratio.toFixed(ratio < 1 ? 2 : 1)}×
        </span>
        <span className="text-[14px] text-muted-foreground">its threshold</span>
      </p>
      <div className="mt-4">
        <AnomalyGauge ratio={ratio} color={color} />
      </div>
      <p className="mt-3 font-mono text-[12px] text-muted-foreground">
        Error {error.toFixed(4)} · threshold {threshold.toFixed(4)}
      </p>
      <p className="mt-3 text-[13.5px] leading-relaxed text-muted-foreground">
        {anomalous
          ? "Recent readings don't match what the model learned for this server."
          : 'Recent readings match what the model learned for this server.'}
      </p>
      <p className="mt-3 border-t border-border pt-3 text-[12.5px] text-muted-foreground">
        LSTM model trained on this server&apos;s own history. Checked every 30 s.
      </p>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Other panels

function ChartPanel({
  title,
  legend,
  className,
  stale,
  children,
  readings,
}: {
  title: string;
  legend?: ReactNode;
  className?: string;
  stale: boolean;
  children: ReactNode;
  readings?: ReactNode;
}) {
  return (
    <Panel title={title} className={className} flush>
      <div className={cn(stale && 'opacity-60')}>
        {/* the legend sits with the chart so panel headers line up across a row */}
        {legend && <div className="flex flex-wrap justify-end gap-x-4 gap-y-1 px-4 pt-3 sm:px-5">{legend}</div>}
        <div className={legend ? 'px-3 pb-3 pt-2 sm:px-4' : 'px-3 pb-3 pt-4 sm:px-4'}>{children}</div>
      </div>
      {readings}
    </Panel>
  );
}

function ServerIncidentsPanel({ incidents }: { incidents: IncidentRow[] | null }) {
  if (!incidents) return null;
  const open = incidents.filter((i) => isOpenIncident(i.status)).sort(bySeverityThenRecent);
  const resolved = incidents.filter((i) => !isOpenIncident(i.status)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const shown = [...open, ...resolved].slice(0, INCIDENTS_SHOWN);

  return (
    <Panel title="Incidents on this server" meta={open.length > 0 ? `${open.length} open` : undefined} flush>
      {shown.length === 0 ? (
        <p className="px-4 py-5 text-[13.5px] text-muted-foreground sm:px-5">No incidents on this server.</p>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {shown.map((incident) => (
              <li key={incident.id}>
                <Link
                  href={`/incidents?open=${incident.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition-colors duration-[120ms] hover:bg-accent/40 sm:gap-4 sm:px-5"
                >
                  <SeverityBadge severity={incident.severity} compact className="sm:hidden" />
                  <SeverityBadge severity={incident.severity} className="hidden w-[6.5rem] shrink-0 sm:inline-flex" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-foreground">{incidentTitle(incident.title)}</span>
                    <span className="block text-[12.5px] text-muted-foreground">
                      {plural(incident.alerts.length, 'alert')} · <RelativeTime value={incident.createdAt} />
                    </span>
                  </span>
                  <IncidentStatusBadge status={incident.status} className="shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
          {incidents.length > shown.length && (
            <Link
              href="/incidents"
              className="flex h-11 items-center justify-center border-t border-border text-[13.5px] font-semibold text-primary transition-colors duration-[120ms] hover:bg-accent/40"
            >
              All incidents
            </Link>
          )}
        </>
      )}
    </Panel>
  );
}

// Never reported: how to connect the agent, instead of empty charts.
function WaitingPanel({ server, canManage, onReplaceKey }: { server: ServerInfo; canManage: boolean; onReplaceKey: () => void }) {
  return (
    <Panel title="Connect this server">
      <ol className="space-y-5">
        <li className="flex gap-3.5">
          <StepNumber n={1} />
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-semibold text-foreground">Get the agent key</p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
              The key was shown once, when {server.name} was added.{' '}
              {canManage ? 'Lost it? Replace it to get a new one.' : 'Ask an owner, admin or DevOps engineer for it.'}
            </p>
            {canManage && (
              <Button size="sm" variant="outline" onClick={onReplaceKey} className="mt-3">
                Replace agent key
              </Button>
            )}
          </div>
        </li>
        <li className="flex gap-3.5">
          <StepNumber n={2} />
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-semibold text-foreground">Start the agent on the server</p>
            <p className="mb-2.5 mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
              From a copy of the InfraSentinel repository, with the key in place of YOUR_AGENT_KEY:
            </p>
            <CodeBlock code={agentSetupCommands('YOUR_AGENT_KEY')} ariaLabel="Agent setup commands" />
          </div>
        </li>
        <li className="flex gap-3.5">
          <StepNumber n={3} />
          <div className="min-w-0 flex-1">
            <p className="text-[14.5px] font-semibold text-foreground">Wait for the first report</p>
            <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
              The agent reports every 10 seconds. This page updates by itself and the charts appear with the first readings.
            </p>
          </div>
        </li>
      </ol>
    </Panel>
  );
}

function StepNumber({ n }: { n: number }) {
  return (
    <span
      aria-hidden
      className="flex size-7 shrink-0 items-center justify-center rounded-full border border-border-strong bg-surface-2 text-[13px] font-semibold tabular-nums text-foreground"
    >
      {n}
    </span>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-5 sm:space-y-6" role="status" aria-label="Loading">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-[7.5rem] rounded-xl" />
        ))}
      </div>
      <div className="grid gap-5 sm:gap-6 xl:grid-cols-3">
        <Skeleton className="h-80 rounded-xl xl:col-span-2" />
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function ServerDetailContent() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const serverId = params.id as string;
  const [rangeValue, setRangeValue] = useState('10m');
  const range = RANGES.find((r) => r.value === rangeValue) ?? RANGES[0];
  const detail = useServerDetail(serverId, range);
  const { data, setData, error, notFound, updatedAt, anomaly, anomalyChecked, rules, incidents, retry } = detail;
  const [newKey, setNewKey] = useState<string | null>(null);
  const canManage = canManageServers(user?.role);
  const name = data?.server.name;

  const actions = useServerActions({
    onRenamed: (server) => setData((d) => (d ? { ...d, server: { ...d.server, name: server.name } } : d)),
    onKeyReplaced: (_server, apiKey) => {
      setNewKey(apiKey);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    onDeleted: () => router.push('/servers'),
  });

  // the tab shows the server's name ("prod-web-01 | InfraSentinel")
  useEffect(() => {
    if (name) document.title = `${name} | InfraSentinel`;
  }, [name]);

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
  const { minutes } = range;
  const rows = useMemo(() => {
    const all = data ? toRows(data.metrics) : [];
    const end = all[all.length - 1]?.t ?? 0;
    return all.filter((r) => r.t >= end - minutes * 60_000);
  }, [data, minutes]);
  const chartRows = useMemo(() => withGaps(downsample(rows)) as MetricRow[], [rows]);
  const timeWindow: [number, number] | undefined = rows.length
    ? [rows[rows.length - 1].t - minutes * 60_000, rows[rows.length - 1].t]
    : undefined;

  const back = { href: '/servers', label: 'Servers' };

  if (notFound) {
    return (
      <AppShell title="Server not found" back={back}>
        <Panel flush>
          <EmptyState
            art="server"
            description="It may have been deleted, or the link is wrong."
            action={
              <Link href="/servers" className={buttonVariants({ size: 'sm', variant: 'outline' })}>
                Back to servers
              </Link>
            }
          />
        </Panel>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell title={error ? "Couldn't load this server" : <Skeleton className="h-8 w-56 max-w-full" />} back={back}>
        {error ? (
          <Panel flush>
            <EmptyState
              icon={AlertCircle}
              tone="error"
              description={error}
              action={
                <Button size="sm" variant="outline" onClick={retry}>
                  Try again
                </Button>
              }
            />
          </Panel>
        ) : (
          <PageSkeleton />
        )}
      </AppShell>
    );
  }

  const { server, metrics } = data;
  const latest = metrics[metrics.length - 1];
  const stale = server.status === 'OFFLINE' && !!latest;
  // the lowest "above" rule on a usage metric, drawn as a tick on its meter
  const ruleLimit = (key: string) =>
    [...(thresholds[key] ?? [])].filter((t) => t.operator !== 'LESS_THAN').sort((a, b) => a.value - b.value)[0];
  const latestRate = (key: 'netIn' | 'netOut' | 'read' | 'write') => {
    const v = lastValue(rows, key);
    return v === null ? undefined : formatRate(v);
  };
  const span = rows.length > 1 ? (rows[rows.length - 1].t - rows[0].t) / 1000 : 0;
  const rangeText =
    rows.length < 2
      ? 'Charts fill in as readings arrive.'
      : span < minutes * 60 - 60
        ? `Charts show all ${formatDuration(span)} of readings so far.`
        : `Charts show the last ${range.label} of readings.`;

  return (
    <AppShell
      title={server.name}
      back={back}
      meta={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <ServerStatusBadge status={server.status} />
          {server.lastHeartbeat && (
            <span>
              Last report <RelativeTime value={server.lastHeartbeat} withSeconds />
            </span>
          )}
          {server.hostname && (
            <span className="inline-flex min-w-0 items-center gap-0.5">
              <span className="truncate font-mono text-[12.5px]">{server.hostname}</span>
              <CopyIconButton value={server.hostname} label="Copy hostname" />
            </span>
          )}
          {/* an offline server has nothing new to show; the notice below says so */}
          {server.status !== 'OFFLINE' && (
            <>
              <span aria-hidden className="h-3.5 w-px bg-border-strong" />
              <LiveIndicator state={error ? 'paused' : 'live'} every={range.everyLabel} updatedAt={updatedAt} />
            </>
          )}
        </span>
      }
      actions={canManage && <ServerMenu server={server} onAction={(kind) => actions.open(kind, server)} />}
    >
      <div className="space-y-5 sm:space-y-6">
        {error && (
          <Notice
            tone="error"
            action={
              <Button size="xs" variant="outline" onClick={retry}>
                Try again
              </Button>
            }
          >
            {error}
          </Notice>
        )}

        {newKey && <ConnectPanel title={`New agent key for ${server.name}`} apiKey={newKey} onDone={() => setNewKey(null)} />}

        {stale && server.lastHeartbeat && (
          <Notice tone="warning">
            {server.name} hasn&apos;t reported since {formatDateTime(server.lastHeartbeat)} (
            <RelativeTime value={server.lastHeartbeat} />
            ). The figures below are its last readings; the page updates as soon as it reports again.
          </Notice>
        )}

        {!latest ? (
          <WaitingPanel server={server} canManage={canManage} onReplaceKey={() => actions.open('key', server)} />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
              <UsageTile label="CPU" value={latest.cpuUsage} limit={ruleLimit('cpu')} stale={stale} />
              <UsageTile label="Memory" value={latest.memUsage} limit={ruleLimit('mem')} stale={stale} />
              <UsageTile label="Disk" value={latest.diskUsage} limit={ruleLimit('disk')} stale={stale} />
              <MetricTile
                label="Load average"
                value={latest.loadAverage != null ? latest.loadAverage.toFixed(2) : '—'}
                stale={stale}
              >
                <p className="text-[12.5px] leading-snug text-muted-foreground">
                  {latest.loadAverage != null
                    ? latest.processCount != null
                      ? `${latest.processCount} processes`
                      : 'Processes not reported'
                    : 'Not reported by this agent. Windows agents don’t send it.'}
                </p>
              </MetricTile>
            </div>

            {/* one time range for every chart below */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13.5px] text-muted-foreground">{rangeText}</p>
              <FilterTabs label="Time range" value={rangeValue} onValueChange={setRangeValue} tabs={RANGES} />
            </div>

            <div className="grid gap-5 sm:gap-6 xl:grid-cols-3">
              <ChartPanel
                className="min-w-0 xl:col-span-2"
                title="CPU, memory and disk"
                stale={stale}
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
              <AnomalyPanel score={anomaly} checked={anomalyChecked} className="min-w-0 xl:self-start" />
            </div>

            <ChartPanel
              title="Network"
              className="min-w-0"
              stale={stale}
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

            <div className="grid gap-5 sm:gap-6 lg:grid-cols-3">
              <ChartPanel
                title="Disk activity"
                className="min-w-0"
                stale={stale}
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
                stale={stale}
                readings={
                  <ChartReadings
                    rows={rows}
                    caption="Latest load average readings"
                    columns={[{ key: 'load', label: 'Load', format: (v) => v.toFixed(2) }]}
                  />
                }
              >
                <SingleChart
                  rows={chartRows}
                  timeWindow={timeWindow}
                  dataKey="load"
                  label="Load"
                  format={loadFormat}
                  thresholds={thresholds.load}
                  height={200}
                />
              </ChartPanel>
              <ChartPanel
                title="Processes"
                className="min-w-0"
                stale={stale}
                readings={
                  <ChartReadings
                    rows={rows}
                    caption="Latest process counts"
                    columns={[{ key: 'processes', label: 'Processes', format: countFormat }]}
                  />
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
          </>
        )}

        <ServerIncidentsPanel incidents={incidents} />
      </div>
      {actions.dialogs}
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
