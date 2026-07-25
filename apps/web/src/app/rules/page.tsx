'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ProtectedRoute } from '@/components/protected-route';
import { apiClient } from '@/lib/api-client';

interface Rule {
  id: string;
  name: string;
  ruleType: 'METRIC_THRESHOLD' | 'EVENT_FREQUENCY';
  metricField: string | null;
  operator: string | null;
  threshold: number | null;
  eventType: string | null;
  groupByField: string | null;
  maxCount: number | null;
  windowSeconds: number | null;
  severity: string;
  isActive: boolean;
}

function severityColor(s: string) {
  switch (s) {
    case 'CRITICAL': return 'bg-red-100 text-red-700';
    case 'HIGH': return 'bg-orange-100 text-orange-700';
    case 'MEDIUM': return 'bg-yellow-100 text-yellow-700';
    default: return 'bg-gray-100 text-gray-600';
  }
}

function RulesContent() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [ruleType, setRuleType] = useState<'METRIC_THRESHOLD' | 'EVENT_FREQUENCY'>('METRIC_THRESHOLD');
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

  useEffect(() => {
    loadRules();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload =
        ruleType === 'METRIC_THRESHOLD'
          ? { name, ruleType, metricField, operator, threshold: Number(threshold), durationSeconds: Number(durationSeconds), severity }
          : { name, ruleType, eventType, groupByField, maxCount: Number(maxCount), windowSeconds: Number(windowSeconds), severity };
      await apiClient.post('/rules', payload);
      setName('');
      setShowForm(false);
      loadRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rule');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(rule: Rule) {
    await apiClient.patch(`/rules/${rule.id}/toggle`, { isActive: !rule.isActive });
    loadRules();
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <Link href="/dashboard" className="text-sm text-blue-600 hover:underline">← Dashboard</Link>
            <h1 className="mt-1 text-xl font-semibold">Rules</h1>
          </div>
          <button onClick={() => setShowForm(!showForm)} className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
            + New Rule
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="mb-6 space-y-3 rounded-lg border bg-white p-4 shadow-sm">
            <div>
              <label className="block text-sm font-medium text-gray-700">Rule name</label>
              <input value={name} onChange={(e) => setName(e.target.value)} required className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Rule type</label>
              <select value={ruleType} onChange={(e) => setRuleType(e.target.value as 'METRIC_THRESHOLD' | 'EVENT_FREQUENCY')} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                <option value="METRIC_THRESHOLD">Metric threshold (e.g. high CPU)</option>
                <option value="EVENT_FREQUENCY">Event frequency (e.g. brute-force login)</option>
              </select>
            </div>

            {ruleType === 'METRIC_THRESHOLD' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Metric</label>
                  <select value={metricField} onChange={(e) => setMetricField(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                    <option value="CPU_USAGE">CPU usage</option>
                    <option value="MEM_USAGE">Memory usage</option>
                    <option value="DISK_USAGE">Disk usage</option>
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
                  <label className="block text-sm font-medium text-gray-700">Threshold (%)</label>
                  <input type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Sustained for (seconds)</label>
                  <input type="number" value={durationSeconds} onChange={(e) => setDurationSeconds(e.target.value)} className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm" />
                </div>
              </div>
            ) : (
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
              {saving ? 'Creating...' : 'Create rule'}
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
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="py-2">{r.name}</td>
                  <td className="py-2 text-gray-600">{r.ruleType === 'METRIC_THRESHOLD' ? 'Metric' : 'Event'}</td>
                  <td className="py-2 text-gray-600">
                    {r.ruleType === 'METRIC_THRESHOLD'
                      ? `${r.metricField} ${r.operator === 'GREATER_THAN' ? '>' : '<'} ${r.threshold}%`
                      : `${r.maxCount}+ ${r.eventType} per ${r.groupByField} in ${r.windowSeconds}s`}
                  </td>
                  <td className="py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${severityColor(r.severity)}`}>{r.severity}</span>
                  </td>
                  <td className="py-2">
                    <button onClick={() => handleToggle(r)} className={`rounded-full px-2 py-0.5 text-xs font-medium ${r.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {r.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                </tr>
              ))}
              {rules.length === 0 && (
                <tr><td colSpan={5} className="py-4 text-center text-gray-400">No rules yet.</td></tr>
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