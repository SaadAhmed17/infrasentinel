'use client';

import { useEffect, useState } from 'react';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/app-shell';
import { apiClient } from '@/lib/api-client';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Info, ListChecks } from 'lucide-react';

interface Rule {
  id: string;
  name: string;
  ruleType: string;
  metricField: string | null;
  operator: string | null;
  threshold: number | null;
  durationSeconds: number;
  eventType: string | null;
  groupByField: string | null;
  maxCount: number | null;
  windowSeconds: number | null;
  severity: string;
  isActive: boolean;
}

const RULE_TYPES = [
  { value: 'METRIC_THRESHOLD', label: 'Metric Threshold (e.g. high CPU)' },
  { value: 'EVENT_FREQUENCY', label: 'Event Frequency (e.g. brute-force login)' },
  { value: 'HEARTBEAT_MISSING', label: 'Heartbeat Missing (e.g. service crash)' },
  { value: 'CREDENTIAL_STUFFING', label: 'Credential Stuffing (multi-IP failures then success)' },
  { value: 'ANOMALY_DETECTION', label: 'AI Anomaly Detection (LSTM-Autoencoder)' },
];

const METRIC_FIELDS = [
  { value: 'CPU_USAGE', label: 'CPU Usage (%)' },
  { value: 'MEM_USAGE', label: 'Memory Usage (%)' },
  { value: 'DISK_USAGE', label: 'Disk Usage (%)' },
  { value: 'NETWORK_IN', label: 'Network In (bytes/sec)' },
  { value: 'NETWORK_OUT', label: 'Network Out (bytes/sec)' },
  { value: 'DISK_READ_RATE', label: 'Disk Read Rate (bytes/sec)' },
  { value: 'DISK_WRITE_RATE', label: 'Disk Write Rate (bytes/sec)' },
  { value: 'PROCESS_COUNT', label: 'Process Count' },
  { value: 'LOAD_AVERAGE', label: 'Load Average' },
];

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: 'border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400',
  HIGH: 'border-orange-500/20 bg-orange-500/10 text-orange-600 dark:text-orange-400',
  MEDIUM: 'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  LOW: 'border-border bg-muted text-muted-foreground',
};

function describeCondition(r: Rule) {
  switch (r.ruleType) {
    case 'METRIC_THRESHOLD':
      return `${r.metricField} ${r.operator === 'GREATER_THAN' ? '>' : '<'} ${r.threshold}, sustained ${r.durationSeconds}s`;
    case 'EVENT_FREQUENCY':
      return `${r.maxCount}+ ${r.eventType} per ${r.groupByField} in ${r.windowSeconds}s`;
    case 'HEARTBEAT_MISSING':
      return `No heartbeat for ${r.durationSeconds}s`;
    case 'CREDENTIAL_STUFFING':
      return `${r.maxCount}+ distinct IPs failing then succeeding, within ${r.windowSeconds}s`;
    case 'ANOMALY_DETECTION':
      return 'LSTM reconstruction error exceeds per-server threshold';
    default:
      return '—';
  }
}

const inputClass =
  'mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2 text-[14px] text-foreground outline-none focus:border-[oklch(0.62_0.19_265)] focus:ring-2 focus:ring-[oklch(0.62_0.19_265)]/20';
const labelClass = 'block text-[12.5px] font-bold text-muted-foreground';

function RulesContent() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [ruleType, setRuleType] = useState('METRIC_THRESHOLD');
  const [name, setName] = useState('');
  const [metricField, setMetricField] = useState('CPU_USAGE');
  const [operator, setOperator] = useState('GREATER_THAN');
  const [threshold, setThreshold] = useState('80');
  const [durationSeconds, setDurationSeconds] = useState('60');
  const [eventType, setEventType] = useState('AUTH_LOGIN_FAILURE');
  const [groupByField, setGroupByField] = useState('ipAddress');
  const [maxCount, setMaxCount] = useState('5');
  const [windowSeconds, setWindowSeconds] = useState('600');
  const [severity, setSeverity] = useState('MEDIUM');
  const [saving, setSaving] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  function loadRules() {
    apiClient.get<Rule[]>('/rules').then(setRules).catch((err) => setError(err.message));
  }

  const PRESETS = [
    { label: 'SSH Brute-Force', ruleType: 'EVENT_FREQUENCY', eventType: 'SSH_LOGIN_FAILURE', groupByField: 'ipAddress', maxCount: '5', windowSeconds: '60', severity: 'CRITICAL' },
    { label: 'Web Login Brute-Force', ruleType: 'EVENT_FREQUENCY', eventType: 'AUTH_LOGIN_FAILURE', groupByField: 'ipAddress', maxCount: '10', windowSeconds: '300', severity: 'HIGH' },
    { label: 'High CPU', ruleType: 'METRIC_THRESHOLD', metricField: 'CPU_USAGE', operator: 'GREATER_THAN', threshold: '85', durationSeconds: '60', severity: 'HIGH' },
    { label: 'Service Crash', ruleType: 'HEARTBEAT_MISSING', durationSeconds: '30', severity: 'CRITICAL' },
  ];

  useEffect(() => {
    loadRules();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      let payload: Record<string, unknown> = { name, ruleType, severity };

      if (ruleType === 'METRIC_THRESHOLD') {
        payload = { ...payload, metricField, operator, threshold: Number(threshold), durationSeconds: Number(durationSeconds) };
      } else if (ruleType === 'EVENT_FREQUENCY') {
        payload = { ...payload, eventType, groupByField, maxCount: Number(maxCount), windowSeconds: Number(windowSeconds) };
      } else if (ruleType === 'HEARTBEAT_MISSING') {
        payload = { ...payload, durationSeconds: Number(durationSeconds) };
      } else if (ruleType === 'CREDENTIAL_STUFFING') {
        payload = { ...payload, windowSeconds: Number(windowSeconds), maxCount: Number(maxCount) };
      }

      if (editingRuleId) {
        await apiClient.patch(`/rules/${editingRuleId}`, payload);
      } else {
        await apiClient.post('/rules', payload);
      }
      resetForm();
      loadRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(rule: Rule) {
    await apiClient.patch(`/rules/${rule.id}/toggle`, { isActive: !rule.isActive });
    loadRules();
  }

  async function handleDelete(rule: Rule) {
    if (confirm(`Delete rule "${rule.name}"? This also removes its alert history.`)) {
      await apiClient.delete(`/rules/${rule.id}`);
      loadRules();
    }
  }

  function startEdit(r: Rule) {
    setEditingRuleId(r.id);
    setName(r.name);
    setRuleType(r.ruleType);
    setMetricField(r.metricField ?? 'CPU_USAGE');
    setOperator(r.operator ?? 'GREATER_THAN');
    setThreshold(String(r.threshold ?? '80'));
    setDurationSeconds(String(r.durationSeconds ?? '60'));
    setEventType(r.eventType ?? 'AUTH_LOGIN_FAILURE');
    setGroupByField(r.groupByField ?? 'ipAddress');
    setMaxCount(String(r.maxCount ?? '5'));
    setWindowSeconds(String(r.windowSeconds ?? '600'));
    setSeverity(r.severity);
    setShowForm(true);
  }

  function resetForm() {
    setEditingRuleId(null);
    setName('');
    setShowForm(false);
  }

  const activeCount = rules.filter((r) => r.isActive).length;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[14.5px] font-semibold text-muted-foreground">
          {rules.length === 0 ? 'No rules configured yet' : `${activeCount} of ${rules.length} rules active`}
        </p>
        <button
          onClick={() => (editingRuleId ? resetForm() : setShowForm(!showForm))}
          className="flex h-9.5 items-center gap-1.5 rounded-lg bg-[oklch(0.62_0.19_265)] px-3.5 text-[14px] font-bold text-white hover:bg-[oklch(0.66_0.19_265)]"
        >
          <Plus className="size-4" strokeWidth={2.25} />
          New Rule
        </button>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="text-[12.5px] font-bold text-muted-foreground">Quick presets:</span>
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setName(p.label);
              setRuleType(p.ruleType);
              if (p.metricField) setMetricField(p.metricField);
              if (p.operator) setOperator(p.operator);
              if (p.threshold) setThreshold(p.threshold);
              if (p.durationSeconds) setDurationSeconds(p.durationSeconds);
              if (p.eventType) setEventType(p.eventType);
              if (p.groupByField) setGroupByField(p.groupByField);
              if (p.maxCount) setMaxCount(p.maxCount);
              if (p.windowSeconds) setWindowSeconds(p.windowSeconds);
              setSeverity(p.severity);
              setShowForm(true);
            }}
            className="rounded-full border border-[oklch(0.62_0.19_265)]/25 bg-[oklch(0.62_0.19_265)]/10 px-3 py-1 text-[12.5px] font-semibold text-[oklch(0.55_0.19_265)] hover:bg-[oklch(0.62_0.19_265)]/20 dark:text-[oklch(0.72_0.15_265)]"
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-red-500/20 bg-red-500/10 px-3.5 py-2.5 text-[14px] font-medium text-red-600 dark:text-red-400">
          {error}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-5 space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm">
          <div>
            <label className={labelClass}>Rule name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Rule type</label>
            <select value={ruleType} onChange={(e) => setRuleType(e.target.value)} className={inputClass}>
              {RULE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          {ruleType === 'METRIC_THRESHOLD' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Metric</label>
                <select value={metricField} onChange={(e) => setMetricField(e.target.value)} className={inputClass}>
                  {METRIC_FIELDS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Operator</label>
                <select value={operator} onChange={(e) => setOperator(e.target.value)} className={inputClass}>
                  <option value="GREATER_THAN">Greater than</option>
                  <option value="LESS_THAN">Less than</option>
                </select>
              </div>
              <div>
                <label className={labelClass}>Threshold</label>
                <input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Sustained for (seconds)</label>
                <input type="number" value={durationSeconds} onChange={(e) => setDurationSeconds(e.target.value)} className={inputClass} />
              </div>
            </div>
          )}

          {ruleType === 'EVENT_FREQUENCY' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Event type</label>
                <input value={eventType} onChange={(e) => setEventType(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Group by field</label>
                <input value={groupByField} onChange={(e) => setGroupByField(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Max count</label>
                <input type="number" value={maxCount} onChange={(e) => setMaxCount(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Window (seconds)</label>
                <input type="number" value={windowSeconds} onChange={(e) => setWindowSeconds(e.target.value)} className={inputClass} />
              </div>
            </div>
          )}

          {ruleType === 'HEARTBEAT_MISSING' && (
            <div>
              <label className={labelClass}>Missing for at least (seconds)</label>
              <input type="number" value={durationSeconds} onChange={(e) => setDurationSeconds(e.target.value)} className={inputClass} />
            </div>
          )}

          {ruleType === 'CREDENTIAL_STUFFING' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Min distinct IPs</label>
                <input type="number" value={maxCount} onChange={(e) => setMaxCount(e.target.value)} className={inputClass} />
              </div>
              <div>
                <label className={labelClass}>Window (seconds)</label>
                <input type="number" value={windowSeconds} onChange={(e) => setWindowSeconds(e.target.value)} className={inputClass} />
              </div>
            </div>
          )}

          {ruleType === 'ANOMALY_DETECTION' && (
            <div className="flex items-start gap-2.5 rounded-lg border border-[oklch(0.62_0.19_265)]/20 bg-[oklch(0.62_0.19_265)]/10 p-3">
              <Info className="mt-0.5 size-4 shrink-0 text-[oklch(0.55_0.19_265)] dark:text-[oklch(0.72_0.15_265)]" strokeWidth={2} />
              <p className="text-[13px] text-foreground">
                No extra configuration needed — this rule checks every server against its own trained LSTM-Autoencoder model on each evaluation cycle.
              </p>
            </div>
          )}

          <div>
            <label className={labelClass}>Severity</label>
            <select value={severity} onChange={(e) => setSeverity(e.target.value)} className={inputClass}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="submit"
              disabled={saving}
              className="h-9.5 rounded-md bg-[oklch(0.62_0.19_265)] px-4 text-[14px] font-bold text-white hover:bg-[oklch(0.66_0.19_265)] disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingRuleId ? 'Update rule' : 'Create rule'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="h-9.5 rounded-md border border-border px-4 text-[14px] font-semibold text-foreground hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-border bg-card shadow-sm">
        {rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 px-5 py-14 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-muted">
              <ListChecks className="size-5 text-muted-foreground" strokeWidth={1.75} />
            </div>
            <p className="text-[15px] font-bold text-foreground">No rules yet</p>
            <p className="text-[14px] text-muted-foreground">
              Create a rule above, or start from a quick preset.
            </p>
          </div>
        ) : (
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-border text-left text-[12px] font-bold uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3">Name</th>
                <th className="px-5 py-3">Type</th>
                <th className="px-5 py-3">Condition</th>
                <th className="px-5 py-3">Severity</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-muted/50">
                  <td className="px-5 py-3.5 font-bold text-foreground">{r.name}</td>
                  <td className="px-5 py-3.5 text-[13px] font-medium text-muted-foreground">
                    {RULE_TYPES.find((t) => t.value === r.ruleType)?.label.split(' (')[0] ?? r.ruleType}
                  </td>
                  <td className="px-5 py-3.5 font-mono text-[12.5px] text-muted-foreground">{describeCondition(r)}</td>
                  <td className="px-5 py-3.5">
                    <Badge className={SEVERITY_STYLES[r.severity] ?? SEVERITY_STYLES.LOW}>{r.severity}</Badge>
                  </td>
                                    <td className="px-5 py-3.5">
                    <button
                      onClick={() => handleToggle(r)}
                      className={`relative inline-block shrink-0 rounded-full transition-colors ${
                        r.isActive ? 'bg-emerald-500' : 'bg-muted-foreground/25'
                      }`}
                      style={{ width: 36, height: 20 }}
                      aria-label={r.isActive ? 'Deactivate rule' : 'Activate rule'}
                    >
                      <span
                        className="absolute rounded-full bg-white shadow transition-transform"
                        style={{
                          width: 16,
                          height: 16,
                          top: 2,
                          left: 2,
                          transform: r.isActive ? 'translateX(16px)' : 'translateX(0)',
                        }}
                      />
                    </button>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => startEdit(r)}
                        className="flex size-7.5 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-[oklch(0.62_0.19_265)] hover:text-[oklch(0.55_0.19_265)] dark:hover:text-[oklch(0.72_0.15_265)]"
                        aria-label="Edit rule"
                      >
                        <Pencil className="size-3.5" strokeWidth={2} />
                      </button>
                      <button
                        onClick={() => handleDelete(r)}
                        className="flex size-7.5 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-red-500/40 hover:text-red-600 dark:hover:text-red-400"
                        aria-label="Delete rule"
                      >
                        <Trash2 className="size-3.5" strokeWidth={2} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function RulesPage() {
  return (
    <ProtectedRoute>
      <AppShell title="Rules">
        <RulesContent />
      </AppShell>
    </ProtectedRoute>
  );
}