'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/protected-route';
import { apiClient } from '@/lib/api-client';

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

function severityColor(s: string) {
  switch (s) {
    case 'CRITICAL': return 'bg-red-100 text-red-700';
    case 'HIGH': return 'bg-orange-100 text-orange-700';
    case 'MEDIUM': return 'bg-yellow-100 text-yellow-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}

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

  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

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

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
            <h1 className="mt-1 text-xl font-semibold">Rules</h1>
          </div>
          <button onClick={() => { if (editingRuleId) resetForm(); else setShowForm(!showForm)}} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            + New Rule
          </button>
          <div className="mb-2 flex flex-wrap gap-2">
  <span className="text-xs text-gray-500 self-center">Quick presets:</span>
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
      }}
      className="rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-xs text-blue-700 hover:bg-blue-100"
    >
      {p.label}
    </button>
  ))}
</div>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="mb-6 space-y-3 rounded-lg border bg-white p-4 shadow-sm">
            <div>
              <label className="block text-sm font-medium text-gray-700">Rule name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Rule type</label>
              <select value={ruleType} onChange={(e) => setRuleType(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                {RULE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {ruleType === 'METRIC_THRESHOLD' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Metric</label>
                  <select value={metricField} onChange={(e) => setMetricField(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                    {METRIC_FIELDS.map((m) => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Operator</label>
                  <select value={operator} onChange={(e) => setOperator(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                    <option value="GREATER_THAN">Greater than</option>
                    <option value="LESS_THAN">Less than</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Threshold</label>
                  <input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Sustained for (seconds)</label>
                  <input type="number" value={durationSeconds} onChange={(e) => setDurationSeconds(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </div>
              </div>
            )}

            {ruleType === 'EVENT_FREQUENCY' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Event type</label>
                  <input value={eventType} onChange={(e) => setEventType(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Group by field</label>
                  <input value={groupByField} onChange={(e) => setGroupByField(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Max count</label>
                  <input type="number" value={maxCount} onChange={(e) => setMaxCount(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Window (seconds)</label>
                  <input type="number" value={windowSeconds} onChange={(e) => setWindowSeconds(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </div>
              </div>
            )}

            {ruleType === 'HEARTBEAT_MISSING' && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Missing for at least (seconds)</label>
                <input type="number" value={durationSeconds} onChange={(e) => setDurationSeconds(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
              </div>
            )}

            {ruleType === 'CREDENTIAL_STUFFING' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Min distinct IPs</label>
                  <input type="number" value={maxCount} onChange={(e) => setMaxCount(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Window (seconds)</label>
                  <input type="number" value={windowSeconds} onChange={(e) => setWindowSeconds(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </div>
              </div>
            )}

            {ruleType === 'ANOMALY_DETECTION' && (
              <p className="rounded-md bg-blue-50 p-3 text-xs text-blue-700">
                No extra configuration needed — this rule checks every server against its own trained LSTM-Autoencoder model on each evaluation cycle.
              </p>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700">Severity</label>
              <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={saving} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Saving...' : editingRuleId ? 'Update rule' : 'Create rule'}
            </button>
          </form>
        )}

        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2">Name</th>
                <th className="pb-2">Type</th>
                <th className="pb-2">Condition</th>
                <th className="pb-2">Severity</th>
                <th className="pb-2">Active</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2">{r.name}</td>
                  <td className="py-2 text-gray-600">{RULE_TYPES.find((t) => t.value === r.ruleType)?.label.split(' (')[0] ?? r.ruleType}</td>
                  <td className="py-2 text-gray-600">{describeCondition(r)}</td>
                  <td className="py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${severityColor(r.severity)}`}>{r.severity}</span>
                  </td>
                  <td className="py-2">
                    <button onClick={() => handleToggle(r)} className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {r.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="py-2">
                    <button onClick={() => startEdit(r)} className="text-xs text-blue-600 hover:underline">Edit</button>
                    <button onClick={() => handleDelete(r)} className="text-xs text-red-600 hover:underline">Delete</button>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr><td colSpan={6} className="py-4 text-center text-gray-400">No rules yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function RulesPage() {
  return (
    <ProtectedRoute>
      <RulesContent />
    </ProtectedRoute>
  );
}