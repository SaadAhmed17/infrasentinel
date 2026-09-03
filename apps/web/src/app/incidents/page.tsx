'use client';

import { useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/app-shell';
import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ShieldAlert, Search, CheckCircle2, ClipboardList, Server as ServerIcon } from 'lucide-react';

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

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400',
  HIGH: 'border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400',
  MEDIUM: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  LOW: 'border-border bg-muted text-muted-foreground',
};

const STATUS_STYLES: Record<string, string> = {
  RESOLVED: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  INVESTIGATING: 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  OPEN: 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400',
};

function formatKey(key: string) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(2);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

function DetailsTable({ details }: { details: Record<string, unknown> }) {
  const entries = Object.entries(details);
  if (entries.length === 0) {
    return <p className="text-[12.5px] text-muted-foreground">No additional details.</p>;
  }
  return (
    <table className="w-full overflow-hidden rounded-md border border-border text-[12.5px]">
      <tbody>
        {entries.map(([key, value], i) => (
          <tr key={key} className={i !== entries.length - 1 ? 'border-b border-border' : ''}>
            <td className="w-2/5 bg-muted/60 px-3 py-1.5 font-semibold text-muted-foreground">
              {formatKey(key)}
            </td>
            <td className="px-3 py-1.5 font-mono text-foreground">{formatValue(value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  const [showDetails, setShowDetails] = useState(false);
  const created = new Date(alert.createdAt);

  return (
    <li className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13.5px] font-bold text-foreground">{alert.rule.name}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            <span className="font-semibold text-foreground/70">Server:</span>{' '}
            {alert.server ? alert.server.name : 'None'}
            <span className="mx-1.5">·</span>
            <span className="font-semibold text-foreground/70">Date:</span> {created.toLocaleDateString()}
            <span className="mx-1.5">·</span>
            <span className="font-semibold text-foreground/70">Time:</span> {created.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={() => setShowDetails((v) => !v)}
          className={`flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-[12px] font-semibold transition-colors ${
            showDetails
              ? 'border-[oklch(0.62_0.19_265)]/30 bg-[oklch(0.62_0.19_265)]/10 text-[oklch(0.55_0.19_265)] dark:text-[oklch(0.72_0.15_265)]'
              : 'border-border text-foreground hover:bg-muted'
          }`}
        >
          <ClipboardList className="size-3.5" strokeWidth={2} />
          {showDetails ? 'Hide Details' : 'Details'}
        </button>
      </div>

      {showDetails && (
        <div className="mt-3">
          <DetailsTable details={alert.details} />
        </div>
      )}
    </li>
  );
}

function IncidentsContent() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState('');

  function loadIncidents() {
    apiClient.get<Incident[]>('/incidents').then(setIncidents).catch((err) => setError(err.message));
  }

  useEffect(() => {
    loadIncidents();
    const interval = setInterval(loadIncidents, 15000);
    return () => clearInterval(interval);
  }, []);

  async function updateStatus(incidentId: string, status: string) {
    await apiClient.patch(`/incidents/${incidentId}/status`, { status });
    loadIncidents();
  }

  const openCount = incidents.filter((i) => i.status !== 'RESOLVED').length;

  return (
    <div>
      <p className="mb-5 text-[14.5px] font-semibold text-muted-foreground">
        {incidents.length === 0 ? 'No incidents recorded' : `${openCount} of ${incidents.length} incidents open`}
      </p>

      {error && (
        <div className="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-[14px] font-medium text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {incidents.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-14 text-center shadow-sm">
          <div className="flex size-11 items-center justify-center rounded-full bg-muted">
            <ShieldAlert className="size-5 text-muted-foreground" strokeWidth={1.75} />
          </div>
          <p className="text-[15px] font-bold text-foreground">No incidents yet</p>
          <p className="text-[14px] text-muted-foreground">
            Incidents are created automatically when a SIEM rule fires.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map((inc) => {
            const expanded = expandedId === inc.id;
            const created = new Date(inc.createdAt);
            const serverNames = Array.from(
              new Set(inc.alerts.map((a) => a.server?.name).filter((n): n is string => Boolean(n)))
            );
            return (
              <div key={inc.id} className="rounded-xl border border-border bg-card shadow-sm">
                <button
                  onClick={() => setExpandedId(expanded ? null : inc.id)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-left"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <ChevronDown
                      className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
                      strokeWidth={2.25}
                    />
                    <div className="min-w-0">
                      <p className="truncate text-[14.5px] font-bold text-foreground">{inc.title}</p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-muted-foreground">
                        <span>
                          <span className="font-semibold text-foreground/70">Date:</span> {created.toLocaleDateString()}
                        </span>
                        <span>
                          <span className="font-semibold text-foreground/70">Time:</span> {created.toLocaleTimeString()}
                        </span>
                        {serverNames.length > 0 && (
                          <span className="flex items-center gap-1">
                            <ServerIcon className="size-3" strokeWidth={2} />
                            <span className="font-semibold text-foreground/70">Server:</span> {serverNames.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge className={SEVERITY_STYLES[inc.severity] ?? SEVERITY_STYLES.LOW}>{inc.severity}</Badge>
                    <Badge className={STATUS_STYLES[inc.status] ?? STATUS_STYLES.OPEN}>{inc.status}</Badge>
                  </div>
                </button>

                {expanded && (
                  <div className="border-t border-border p-4">
                    <div className="mb-4 flex gap-2">
                      <button
                        onClick={() => updateStatus(inc.id, 'INVESTIGATING')}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                          inc.status === 'INVESTIGATING'
                            ? 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                            : 'border-border text-foreground hover:bg-muted'
                        }`}
                      >
                        <Search className="size-3.5" strokeWidth={2} />
                        Investigating
                      </button>
                      <button
                        onClick={() => updateStatus(inc.id, 'RESOLVED')}
                        className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-semibold transition-colors ${
                          inc.status === 'RESOLVED'
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'border-border text-foreground hover:bg-muted'
                        }`}
                      >
                        <CheckCircle2 className="size-3.5" strokeWidth={2} />
                        Resolved
                      </button>
                    </div>

                    <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
                      Alerts in this incident ({inc.alerts.length})
                    </p>
                    <ul className="space-y-2">
                      {inc.alerts.map((a) => (
                        <AlertRow key={a.id} alert={a} />
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function IncidentsPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Incidents">
        <IncidentsContent />
      </AppShell>
    </ProtectedRoute>
  );
} 