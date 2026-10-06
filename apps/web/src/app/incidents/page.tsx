'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, ChevronDown, Search, Server as ServerIcon } from 'lucide-react';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/app-shell';
import { apiClient } from '@/lib/api-client';
import { canManageSecurity } from '@/lib/permissions';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Notice } from '@/components/ui/notice';
import { Panel } from '@/components/ui/panel';
import { IncidentStatusBadge, SeverityBadge } from '@/components/ui/status';
import { TONE_COLOR, type Tone } from '@/components/ui/tone';
import { cn } from '@/lib/utils';

interface Alert {
  id: string;
  status: string;
  details: Record<string, unknown>;
  rule: { name: string; ruleType: string };
  server: { name: string } | null;
  createdAt: string;
}

interface Incident {
  id: string;
  title: string;
  severity: string;
  status: string;
  alerts: Alert[];
  createdAt: string;
}

const SEVERITY_TONE: Record<string, Tone> = { LOW: 'low', MEDIUM: 'medium', HIGH: 'high', CRITICAL: 'critical' };
const FILTERS = [
  { value: 'ALL', label: 'All' },
  { value: 'OPEN', label: 'Open' },
  { value: 'INVESTIGATING', label: 'Investigating' },
  { value: 'RESOLVED', label: 'Resolved' },
];

function formatKey(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

function formatDateTime(value: string | Date, withSeconds = false) {
  return new Date(value).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: withSeconds ? '2-digit' : undefined,
    hour12: false,
  });
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  // up to 4 decimals, without trailing zeros (93.6, 0.0123)
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(4)));
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' && ISO_DATE.test(value)) return formatDateTime(value, true);
  if (Array.isArray(value)) return value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function timeAgo(dateStr: string) {
  const mins = Math.floor((Date.now() - new Date(dateStr).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function DetailsGrid({ details }: { details: Record<string, unknown> }) {
  const entries = Object.entries(details);
  if (entries.length === 0) {
    return <p className="text-[13px] text-muted-foreground">No additional details.</p>;
  }
  return (
    <dl className="grid overflow-hidden rounded-lg border border-border sm:grid-cols-[minmax(9rem,auto)_1fr]">
      {entries.map(([key, value], i) => (
        <div key={key} className={cn('contents', i > 0 && '[&>*]:border-t [&>*]:border-border')}>
          <dt className="bg-surface-2/70 px-3 py-2 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            {formatKey(key)}
          </dt>
          <dd className="break-all px-3 py-2 font-mono text-[12.5px] text-foreground">{formatValue(value)}</dd>
        </div>
      ))}
    </dl>
  );
}

function AlertItem({ alert, last }: { alert: Alert; last: boolean }) {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <li className="relative pl-7">
      {/* timeline */}
      {!last && <span className="absolute left-[7px] top-5 h-full w-px bg-border-strong" aria-hidden />}
      <span
        className={cn(
          'absolute left-0 top-1.5 size-[15px] rounded-[4px] border-2',
          alert.status === 'RESOLVED' ? 'border-status-online/60 bg-status-online/20' : 'border-sev-critical/60 bg-sev-critical/20',
        )}
        aria-hidden
      />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[14px] font-semibold text-foreground">{alert.rule.name}</p>
          <p className="mt-0.5 font-mono text-[12px] text-muted-foreground">
            {alert.server ? alert.server.name : 'no server'}
            <span className="mx-2 text-border-strong">/</span>
            {formatDateTime(alert.createdAt, true)}
            <span className="mx-2 text-border-strong">/</span>
            {alert.status.toLowerCase()}
          </p>
        </div>
        <Button size="xs" variant={showDetails ? 'secondary' : 'outline'} onClick={() => setShowDetails((v) => !v)} aria-expanded={showDetails}>
          {showDetails ? 'Hide details' : 'Details'}
        </Button>
      </div>
      {showDetails && (
        <div className="mt-3">
          <DetailsGrid details={alert.details} />
        </div>
      )}
    </li>
  );
}

function IncidentsContent() {
  const { user } = useAuth();
  const canChangeStatus = canManageSecurity(user?.role);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState('ALL');
  const [error, setError] = useState('');

  function loadIncidents() {
    apiClient
      .get<Incident[]>('/incidents')
      .then(setIncidents)
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true));
  }

  useEffect(() => {
    loadIncidents();
    const interval = setInterval(loadIncidents, 15000);
    return () => clearInterval(interval);
  }, []);

  async function updateStatus(incidentId: string, status: string) {
    setError('');
    try {
      await apiClient.patch(`/incidents/${incidentId}/status`, { status });
      loadIncidents();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update the incident');
    }
  }

  const counts: Record<string, number> = {
    ALL: incidents.length,
    OPEN: incidents.filter((i) => i.status === 'OPEN').length,
    INVESTIGATING: incidents.filter((i) => i.status === 'INVESTIGATING').length,
    RESOLVED: incidents.filter((i) => i.status === 'RESOLVED').length,
  };
  const shown = filter === 'ALL' ? incidents : incidents.filter((i) => i.status === filter);
  const openCount = incidents.filter((i) => i.status !== 'RESOLVED').length;

  return (
    <div className="space-y-6">
      {error && <Notice tone="error">{error}</Notice>}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="inline-flex rounded-lg border border-border bg-surface-2/60 p-1" role="tablist" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              role="tab"
              aria-selected={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                'inline-flex h-8 items-center gap-2 rounded-md px-3 text-[13px] font-medium transition-colors',
                filter === f.value ? 'bg-card text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {f.label}
              <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{counts[f.value]}</span>
            </button>
          ))}
        </div>
        <p className="font-mono text-[12.5px] text-muted-foreground">
          {loaded ? `${openCount} of ${incidents.length} still open` : 'Loading incidents...'}
        </p>
      </div>

      {!canChangeStatus && (
        <Notice tone="info">You can view incidents. Only owners, admins and security analysts can change their status.</Notice>
      )}

      {!loaded ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <Panel bodyClassName="p-0">
          <EmptyState
            art="incidents"
            title={incidents.length === 0 ? 'No incidents yet' : 'Nothing here'}
            description={
              incidents.length === 0
                ? 'Incidents are created automatically when a rule fires.'
                : 'No incidents have this status right now.'
            }
          />
        </Panel>
      ) : (
        <ul className="space-y-3">
          {shown.map((inc) => {
            const expanded = expandedId === inc.id;
            const tone = SEVERITY_TONE[inc.severity] ?? 'unknown';
            const serverNames = Array.from(
              new Set(inc.alerts.map((a) => a.server?.name).filter((n): n is string => Boolean(n))),
            );
            return (
              <li
                key={inc.id}
                className={cn(
                  'relative overflow-hidden rounded-xl border bg-card/90 shadow-[var(--shadow-panel)] transition-colors',
                  expanded ? 'border-border-strong' : 'border-border',
                  inc.status === 'RESOLVED' && 'opacity-80',
                )}
              >
                <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: TONE_COLOR[tone] }} />
                <button
                  onClick={() => setExpandedId(expanded ? null : inc.id)}
                  aria-expanded={expanded}
                  className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition-colors hover:bg-accent/30"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-foreground">{inc.title}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[12px] text-muted-foreground">
                      <span title={formatDateTime(inc.createdAt)}>{timeAgo(inc.createdAt)}</span>
                      <span className="text-border-strong">/</span>
                      <span>
                        {inc.alerts.length} alert{inc.alerts.length === 1 ? '' : 's'}
                      </span>
                      {serverNames.length > 0 && (
                        <>
                          <span className="text-border-strong">/</span>
                          <span className="inline-flex items-center gap-1.5">
                            <ServerIcon className="size-3" strokeWidth={2} aria-hidden />
                            {serverNames.join(', ')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <SeverityBadge severity={inc.severity} className="hidden sm:inline-flex" />
                    <IncidentStatusBadge status={inc.status} />
                    <ChevronDown
                      className={cn('size-4 text-muted-foreground transition-transform', expanded && 'rotate-180')}
                      strokeWidth={2}
                      aria-hidden
                    />
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-border px-5 py-5">
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                      <p className="font-mono text-[12px] text-muted-foreground">Opened {formatDateTime(inc.createdAt)}</p>
                      {canChangeStatus && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            aria-pressed={inc.status === 'INVESTIGATING'}
                            onClick={() => updateStatus(inc.id, 'INVESTIGATING')}
                            className={cn(inc.status === 'INVESTIGATING' && 'border-sev-medium/40 bg-sev-medium/10 text-sev-medium')}
                          >
                            <Search />
                            Investigating
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            aria-pressed={inc.status === 'RESOLVED'}
                            onClick={() => updateStatus(inc.id, 'RESOLVED')}
                            className={cn(inc.status === 'RESOLVED' && 'border-status-online/40 bg-status-online/10 text-status-online')}
                          >
                            <CheckCircle2 />
                            Resolved
                          </Button>
                        </div>
                      )}
                    </div>

                    <p className="hud-label mb-4">Alerts in this incident ({inc.alerts.length})</p>
                    <ul className="space-y-5">
                      {inc.alerts.map((a, i) => (
                        <AlertItem key={a.id} alert={a} last={i === inc.alerts.length - 1} />
                      ))}
                    </ul>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function IncidentsPage() {
  return (
    <ProtectedRoute>
      <AppShell
        title="Incidents"
        description="Alerts grouped into incidents. Resolve an incident once its cause is handled; if the problem continues, a new alert is raised."
      >
        <IncidentsContent />
      </AppShell>
    </ProtectedRoute>
  );
}
