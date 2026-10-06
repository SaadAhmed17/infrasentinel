'use client';

import { useEffect, useState } from 'react';
import { Pencil, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { ProtectedRoute } from '@/components/protected-route';
import { AppShell } from '@/components/app-shell';
import { apiClient } from '@/lib/api-client';
import { canManageSecurity } from '@/lib/permissions';
import { useAuth } from '@/contexts/auth-context';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { fieldControlClass, fieldHintClass, fieldLabelClass, fieldSelectClass } from '@/components/ui/form-styles';
import { Notice } from '@/components/ui/notice';
import { Panel } from '@/components/ui/panel';
import { SeverityBadge } from '@/components/ui/status';
import { Switch } from '@/components/ui/switch';

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
  approvedUsernames: string | null;
  businessHourStartUTC: number | null;
  businessHourEndUTC: number | null;
  severity: string;
  isActive: boolean;
}

const RULE_TYPES = [
  {
    value: 'METRIC_THRESHOLD',
    label: 'Metric threshold',
    hint: 'Fires when a metric stays above or below a value for the whole duration, e.g. high CPU.',
  },
  {
    value: 'EVENT_FREQUENCY',
    label: 'Event frequency',
    hint: 'Fires when one IP, user or server produces too many events in a time window, e.g. brute-force logins.',
  },
  {
    value: 'HEARTBEAT_MISSING',
    label: 'Heartbeat missing',
    hint: 'Fires when a server stops reporting, e.g. after a crash.',
  },
  {
    value: 'CREDENTIAL_STUFFING',
    label: 'Credential stuffing',
    hint: 'Fires when an account fails to log in from several IP addresses and then succeeds.',
  },
  {
    value: 'ANOMALY_DETECTION',
    label: 'Anomaly detection',
    hint: "Fires when a server's LSTM model sees behaviour it did not learn as normal.",
  },
  {
    value: 'UNUSUAL_ACCESS',
    label: 'Unusual access',
    hint: 'Fires on sudo by users who are not approved, or outside business hours.',
  },
];

const METRIC_FIELDS = [
  { value: 'CPU_USAGE', label: 'CPU usage (%)' },
  { value: 'MEM_USAGE', label: 'Memory usage (%)' },
  { value: 'DISK_USAGE', label: 'Disk usage (%)' },
  { value: 'NETWORK_IN', label: 'Network in (bytes/s)' },
  { value: 'NETWORK_OUT', label: 'Network out (bytes/s)' },
  { value: 'DISK_READ_RATE', label: 'Disk read rate (bytes/s)' },
  { value: 'DISK_WRITE_RATE', label: 'Disk write rate (bytes/s)' },
  { value: 'PROCESS_COUNT', label: 'Process count' },
  { value: 'LOAD_AVERAGE', label: 'Load average' },
];

// The event types the platform records and the fields they carry; the API
// rejects anything else (KNOWN_EVENT_TYPES / GROUPABLE_EVENT_FIELDS in rule-config.ts).
const EVENT_TYPES = [
  { value: 'AUTH_LOGIN_FAILURE', label: 'Web login failed' },
  { value: 'AUTH_LOGIN_SUCCESS', label: 'Web login succeeded' },
  { value: 'SSH_LOGIN_FAILURE', label: 'SSH login failed' },
  { value: 'SSH_LOGIN_SUCCESS', label: 'SSH login succeeded' },
  { value: 'SUDO_COMMAND', label: 'Sudo command' },
  { value: 'API_REQUEST', label: 'API request' },
  { value: 'AUTH_PASSWORD_RESET_REQUESTED', label: 'Password reset requested' },
  { value: 'AUTH_PASSWORD_RESET_COMPLETED', label: 'Password reset completed' },
];

const GROUP_BY_FIELDS = [
  { value: 'ipAddress', label: 'IP address' },
  { value: 'email', label: 'E-mail (web logins)' },
  { value: 'username', label: 'Username (SSH)' },
  { value: 'serverId', label: 'Server (SSH)' },
];

// How each event type and group-by field reads inside a sentence.
const EVENT_PHRASES: Record<string, string> = {
  AUTH_LOGIN_FAILURE: 'failed web logins',
  AUTH_LOGIN_SUCCESS: 'web logins',
  SSH_LOGIN_FAILURE: 'failed SSH logins',
  SSH_LOGIN_SUCCESS: 'SSH logins',
  SUDO_COMMAND: 'sudo commands',
  API_REQUEST: 'API requests',
  AUTH_PASSWORD_RESET_REQUESTED: 'password reset requests',
  AUTH_PASSWORD_RESET_COMPLETED: 'completed password resets',
};
const GROUP_PHRASES: Record<string, string> = {
  ipAddress: 'one IP address',
  email: 'one e-mail address',
  username: 'one username',
  serverId: 'one server',
};

const PRESETS = [
  { label: 'SSH Brute-Force', ruleType: 'EVENT_FREQUENCY', eventType: 'SSH_LOGIN_FAILURE', groupByField: 'ipAddress', maxCount: '5', windowSeconds: '60', severity: 'CRITICAL' },
  { label: 'Web Login Brute-Force', ruleType: 'EVENT_FREQUENCY', eventType: 'AUTH_LOGIN_FAILURE', groupByField: 'ipAddress', maxCount: '10', windowSeconds: '300', severity: 'HIGH' },
  { label: 'High CPU', ruleType: 'METRIC_THRESHOLD', metricField: 'CPU_USAGE', operator: 'GREATER_THAN', threshold: '85', durationSeconds: '60', severity: 'HIGH' },
  { label: 'Service Crash', ruleType: 'HEARTBEAT_MISSING', durationSeconds: '30', severity: 'CRITICAL' },
  { label: 'API Flood', ruleType: 'EVENT_FREQUENCY', eventType: 'API_REQUEST', groupByField: 'ipAddress', maxCount: '100', windowSeconds: '60', severity: 'HIGH' },
];

// Keeps a value that is no longer in the list (e.g. an older rule) selectable.
function withCurrent(options: { value: string; label: string }[], current: string) {
  return options.some((o) => o.value === current) ? options : [...options, { value: current, label: current }];
}

function labelOf(options: { value: string; label: string }[], value: string | null) {
  return options.find((o) => o.value === value)?.label ?? value ?? '?';
}

function hour(h: number | null) {
  return `${String(h ?? 0).padStart(2, '0')}:00`;
}

// The rule's condition in plain words.
function describeCondition(r: Rule) {
  switch (r.ruleType) {
    case 'METRIC_THRESHOLD': {
      const metric = labelOf(METRIC_FIELDS, r.metricField).replace(/ \(.*\)$/, '');
      const unit = r.metricField?.endsWith('_USAGE') ? '%' : '';
      const direction = r.operator === 'GREATER_THAN' ? 'above' : 'below';
      return `${metric} ${direction} ${r.threshold}${unit} for ${r.durationSeconds} s`;
    }
    case 'EVENT_FREQUENCY': {
      const events = EVENT_PHRASES[r.eventType ?? ''] ?? `${r.eventType} events`;
      const group = GROUP_PHRASES[r.groupByField ?? ''] ?? `one ${r.groupByField}`;
      return `${r.maxCount}+ ${events} from ${group} within ${r.windowSeconds} s`;
    }
    case 'HEARTBEAT_MISSING':
      return `No report for ${r.durationSeconds} s`;
    case 'CREDENTIAL_STUFFING':
      return `Failed logins from ${r.maxCount}+ IP addresses, then a success, within ${r.windowSeconds} s`;
    case 'ANOMALY_DETECTION':
      return "LSTM error above the server's threshold";
    case 'UNUSUAL_ACCESS':
      return [
        r.approvedUsernames ? `sudo by anyone except ${r.approvedUsernames}` : null,
        r.businessHourStartUTC !== null
          ? `sudo outside ${hour(r.businessHourStartUTC)}–${hour(r.businessHourEndUTC)} UTC`
          : null,
      ]
        .filter(Boolean)
        .join(', or ');
    default:
      return '—';
  }
}

function RulesContent() {
  const { user } = useAuth();
  const canEdit = canManageSecurity(user?.role);
  const [showForm, setShowForm] = useState(false);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
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
  const [approvedUsernames, setApprovedUsernames] = useState('');
  const [businessHourStart, setBusinessHourStart] = useState('9');
  const [businessHourEnd, setBusinessHourEnd] = useState('18');
  const [severity, setSeverity] = useState('MEDIUM');
  const [saving, setSaving] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  function loadRules() {
    apiClient
      .get<Rule[]>('/rules')
      .then(setRules)
      .catch((err) => setError(err.message))
      .finally(() => setLoaded(true));
  }

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
      } else if (ruleType === 'UNUSUAL_ACCESS') {
        // Empty fields are sent as null so they can also be cleared when editing.
        payload = {
          ...payload,
          approvedUsernames: approvedUsernames.trim() || null,
          businessHourStartUTC: businessHourStart === '' ? null : Number(businessHourStart),
          businessHourEndUTC: businessHourEnd === '' ? null : Number(businessHourEnd),
        };
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
    setError('');
    try {
      await apiClient.patch(`/rules/${rule.id}/toggle`, { isActive: !rule.isActive });
      loadRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to change the rule');
    }
  }

  async function handleDelete(rule: Rule) {
    if (confirm(`Delete rule "${rule.name}"? Its past alerts and incidents are kept.`)) {
      setError('');
      try {
        await apiClient.delete(`/rules/${rule.id}`);
        loadRules();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete the rule');
      }
    }
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    setEditingRuleId(null);
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
    setApprovedUsernames(r.approvedUsernames ?? '');
    setBusinessHourStart(r.businessHourStartUTC === null ? '' : String(r.businessHourStartUTC));
    setBusinessHourEnd(r.businessHourEndUTC === null ? '' : String(r.businessHourEndUTC));
    setSeverity(r.severity);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function resetForm() {
    setEditingRuleId(null);
    setName('');
    setShowForm(false);
    setError('');
  }

  const activeCount = rules.filter((r) => r.isActive).length;
  const typeHint = RULE_TYPES.find((t) => t.value === ruleType)?.hint;

  return (
    <AppShell
      title="Rules"
      description="Detection rules the engine checks every 30 seconds. A rule that matches raises an alert."
      actions={
        canEdit && (
          <Button variant={showForm ? 'outline' : 'default'} onClick={() => (showForm ? resetForm() : setShowForm(true))}>
            {showForm ? <X /> : <Plus />}
            {showForm ? 'Close' : 'New rule'}
          </Button>
        )
      }
    >
      <div className="space-y-6">
        {canEdit ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 inline-flex items-center gap-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
              <Sparkles className="size-3.5 text-primary-bright" strokeWidth={2} aria-hidden />
              Quick presets
            </span>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => applyPreset(p)}
                className="inline-flex h-8 items-center gap-2 rounded-full border border-border-strong bg-surface-2/60 px-3 text-[13px] font-medium text-foreground transition-colors hover:border-primary/50 hover:bg-primary/10"
              >
                {p.label}
              </button>
            ))}
          </div>
        ) : (
          <Notice tone="info">You can view the rules. Only owners, admins and security analysts can change them.</Notice>
        )}

        {error && <Notice tone="error">{error}</Notice>}

        {canEdit && showForm && (
          <Panel
            label={editingRuleId ? 'Edit rule' : 'New rule'}
            title={name || 'Untitled rule'}
            brackets
            actions={
              <Button size="icon-sm" variant="ghost" onClick={resetForm} aria-label="Close the form">
                <X />
              </Button>
            }
          >
            <form onSubmit={handleCreate} className="space-y-5">
              <div className="grid gap-5 lg:grid-cols-2">
                <div>
                  <label htmlFor="rule-name" className={fieldLabelClass}>
                    Rule name
                  </label>
                  <input id="rule-name" value={name} onChange={(e) => setName(e.target.value)} required className={fieldControlClass} />
                </div>
                <div>
                  <label htmlFor="rule-type" className={fieldLabelClass}>
                    Rule type
                  </label>
                  <select id="rule-type" value={ruleType} onChange={(e) => setRuleType(e.target.value)} className={fieldSelectClass}>
                    {RULE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                  {typeHint && <p className={fieldHintClass}>{typeHint}</p>}
                </div>
              </div>

              {ruleType === 'METRIC_THRESHOLD' && (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label htmlFor="rule-metric" className={fieldLabelClass}>
                      Metric
                    </label>
                    <select id="rule-metric" value={metricField} onChange={(e) => setMetricField(e.target.value)} className={fieldSelectClass}>
                      {METRIC_FIELDS.map((m) => (
                        <option key={m.value} value={m.value}>
                          {m.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="rule-operator" className={fieldLabelClass}>
                      Operator
                    </label>
                    <select id="rule-operator" value={operator} onChange={(e) => setOperator(e.target.value)} className={fieldSelectClass}>
                      <option value="GREATER_THAN">Greater than</option>
                      <option value="LESS_THAN">Less than</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="rule-threshold" className={fieldLabelClass}>
                      Threshold
                    </label>
                    <input id="rule-threshold" type="number" value={threshold} onChange={(e) => setThreshold(e.target.value)} className={fieldControlClass} />
                  </div>
                  <div>
                    <label htmlFor="rule-duration" className={fieldLabelClass}>
                      Sustained for (seconds)
                    </label>
                    <input id="rule-duration" type="number" value={durationSeconds} onChange={(e) => setDurationSeconds(e.target.value)} className={fieldControlClass} />
                  </div>
                </div>
              )}

              {ruleType === 'EVENT_FREQUENCY' && (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label htmlFor="rule-event" className={fieldLabelClass}>
                      Event type
                    </label>
                    <select id="rule-event" value={eventType} onChange={(e) => setEventType(e.target.value)} className={fieldSelectClass}>
                      {withCurrent(EVENT_TYPES, eventType).map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="rule-group" className={fieldLabelClass}>
                      Group by field
                    </label>
                    <select id="rule-group" value={groupByField} onChange={(e) => setGroupByField(e.target.value)} className={fieldSelectClass}>
                      {withCurrent(GROUP_BY_FIELDS, groupByField).map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="rule-count" className={fieldLabelClass}>
                      Max count
                    </label>
                    <input id="rule-count" type="number" value={maxCount} onChange={(e) => setMaxCount(e.target.value)} className={fieldControlClass} />
                  </div>
                  <div>
                    <label htmlFor="rule-window" className={fieldLabelClass}>
                      Window (seconds)
                    </label>
                    <input id="rule-window" type="number" value={windowSeconds} onChange={(e) => setWindowSeconds(e.target.value)} className={fieldControlClass} />
                  </div>
                </div>
              )}

              {ruleType === 'HEARTBEAT_MISSING' && (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label htmlFor="rule-missing" className={fieldLabelClass}>
                      Missing for at least (seconds)
                    </label>
                    <input id="rule-missing" type="number" value={durationSeconds} onChange={(e) => setDurationSeconds(e.target.value)} className={fieldControlClass} />
                  </div>
                </div>
              )}

              {ruleType === 'CREDENTIAL_STUFFING' && (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  <div>
                    <label htmlFor="rule-ips" className={fieldLabelClass}>
                      Min distinct IPs
                    </label>
                    <input id="rule-ips" type="number" value={maxCount} onChange={(e) => setMaxCount(e.target.value)} className={fieldControlClass} />
                  </div>
                  <div>
                    <label htmlFor="rule-stuffing-window" className={fieldLabelClass}>
                      Window (seconds)
                    </label>
                    <input id="rule-stuffing-window" type="number" value={windowSeconds} onChange={(e) => setWindowSeconds(e.target.value)} className={fieldControlClass} />
                  </div>
                </div>
              )}

              {ruleType === 'UNUSUAL_ACCESS' && (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="sm:col-span-2">
                    <label htmlFor="rule-approved" className={fieldLabelClass}>
                      Approved sudo users
                    </label>
                    <input
                      id="rule-approved"
                      value={approvedUsernames}
                      onChange={(e) => setApprovedUsernames(e.target.value)}
                      placeholder="saad, hashim"
                      className={fieldControlClass}
                    />
                    <p className={fieldHintClass}>Comma-separated. Leave empty to allow anyone.</p>
                  </div>
                  <div>
                    <label htmlFor="rule-hours-start" className={fieldLabelClass}>
                      Business hours start
                    </label>
                    <input
                      id="rule-hours-start"
                      type="number"
                      min={0}
                      max={23}
                      value={businessHourStart}
                      onChange={(e) => setBusinessHourStart(e.target.value)}
                      className={fieldControlClass}
                    />
                    <p className={fieldHintClass}>UTC hour, 0–23. Empty = any time.</p>
                  </div>
                  <div>
                    <label htmlFor="rule-hours-end" className={fieldLabelClass}>
                      Business hours end
                    </label>
                    <input
                      id="rule-hours-end"
                      type="number"
                      min={0}
                      max={23}
                      value={businessHourEnd}
                      onChange={(e) => setBusinessHourEnd(e.target.value)}
                      className={fieldControlClass}
                    />
                    <p className={fieldHintClass}>UTC hour, 0–23.</p>
                  </div>
                </div>
              )}

              {ruleType === 'ANOMALY_DETECTION' && (
                <Notice tone="info">
                  No extra settings needed. Each server is checked against its own trained LSTM-Autoencoder model on every
                  evaluation.
                </Notice>
              )}

              <div className="flex flex-wrap items-end justify-between gap-4 border-t border-border pt-5">
                <div className="w-full sm:w-56">
                  <label htmlFor="rule-severity" className={fieldLabelClass}>
                    Severity
                  </label>
                  <select id="rule-severity" value={severity} onChange={(e) => setSeverity(e.target.value)} className={fieldSelectClass}>
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="ghost" onClick={resetForm}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? 'Saving...' : editingRuleId ? 'Update rule' : 'Create rule'}
                  </Button>
                </div>
              </div>
            </form>
          </Panel>
        )}

        <Panel
          label="Detection"
          title={
            !loaded
              ? 'Loading rules...'
              : rules.length === 0
                ? 'No rules configured yet'
                : `${activeCount} of ${rules.length} rules active`
          }
          bodyClassName="p-0"
        >
          {!loaded ? (
            <div className="space-y-3 p-5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
              ))}
            </div>
          ) : rules.length === 0 ? (
            <EmptyState
              art="rules"
              title="No rules yet"
              description={canEdit ? 'Create a rule above, or start from a quick preset.' : 'Rules your team creates will appear here.'}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-[14px]">
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="hud-label px-5 py-3 font-medium">Rule</th>
                    <th className="hud-label px-5 py-3 font-medium">Condition</th>
                    <th className="hud-label px-5 py-3 font-medium">Severity</th>
                    <th className="hud-label px-5 py-3 font-medium">Active</th>
                    <th className="px-5 py-3">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr
                      key={r.id}
                      className={`border-b border-border/70 transition-colors last:border-0 hover:bg-accent/40 ${r.isActive ? '' : 'opacity-60'}`}
                    >
                      <td className="min-w-[13rem] px-5 py-3.5">
                        <p className="font-semibold text-foreground">{r.name}</p>
                        <p className="font-mono text-[11.5px] uppercase tracking-[0.08em] text-muted-foreground">
                          {labelOf(RULE_TYPES, r.ruleType)}
                        </p>
                      </td>
                      <td className="max-w-[26rem] px-5 py-3.5 text-[13.5px] text-muted-foreground">{describeCondition(r)}</td>
                      <td className="px-5 py-3.5">
                        <SeverityBadge severity={r.severity} />
                      </td>
                      <td className="px-5 py-3.5">
                        <Switch
                          checked={r.isActive}
                          onChange={() => handleToggle(r)}
                          disabled={!canEdit}
                          label={`${r.name} active`}
                        />
                      </td>
                      <td className="px-5 py-3.5">
                        {canEdit && (
                          <div className="flex items-center justify-end gap-1">
                            <Button size="icon-sm" variant="ghost" onClick={() => startEdit(r)} aria-label={`Edit ${r.name}`} title="Edit">
                              <Pencil />
                            </Button>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              onClick={() => handleDelete(r)}
                              aria-label={`Delete ${r.name}`}
                              title="Delete"
                              className="hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </AppShell>
  );
}

export default function RulesPage() {
  return (
    <ProtectedRoute>
      <RulesContent />
    </ProtectedRoute>
  );
}
