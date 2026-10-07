'use client';

import { useState, useSyncExternalStore, type ReactNode } from 'react';
import { Check } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { friendlyError } from '@/lib/errors';
import { formatDuration } from '@/lib/format';
import {
  EVENT_TYPES,
  GROUP_BY_FIELDS,
  METRIC_FIELDS,
  RULE_TYPES,
  SEVERITIES,
  hourLabel,
  withCurrent,
  type Rule,
} from '@/lib/rule-format';
import { RULE_TEMPLATES, type RuleTemplate } from '@/lib/rule-templates';
import { Button } from '@/components/ui/button';
import { fieldControlClass, fieldHintClass, fieldInlineErrorClass, fieldLabelClass, fieldSelectClass } from '@/components/ui/form-styles';
import { Notice } from '@/components/ui/notice';
import { Panel } from '@/components/ui/panel';
import { SeverityLights, severityLabel } from '@/components/ui/status';
import { cn } from '@/lib/utils';

interface Values {
  name: string;
  ruleType: string;
  metricField: string;
  operator: string;
  threshold: string;
  durationSeconds: string;
  eventType: string;
  groupByField: string;
  maxCount: string;
  windowSeconds: string;
  approvedUsernames: string;
  businessHourStart: string;
  businessHourEnd: string;
  severity: string;
}

const EMPTY: Values = {
  name: '',
  ruleType: 'METRIC_THRESHOLD',
  metricField: 'CPU_USAGE',
  operator: 'GREATER_THAN',
  threshold: '80',
  durationSeconds: '60',
  eventType: 'AUTH_LOGIN_FAILURE',
  groupByField: 'ipAddress',
  maxCount: '5',
  windowSeconds: '300',
  approvedUsernames: '',
  businessHourStart: '9',
  businessHourEnd: '18',
  severity: 'MEDIUM',
};

const str = (v: number | null | undefined, fallback: string) => (v === null || v === undefined ? fallback : String(v));

function fromRule(r: Rule): Values {
  return {
    name: r.name,
    ruleType: r.ruleType,
    metricField: r.metricField ?? EMPTY.metricField,
    operator: r.operator ?? EMPTY.operator,
    threshold: str(r.threshold, EMPTY.threshold),
    durationSeconds: str(r.durationSeconds, EMPTY.durationSeconds),
    eventType: r.eventType ?? EMPTY.eventType,
    groupByField: r.groupByField ?? EMPTY.groupByField,
    maxCount: str(r.maxCount, EMPTY.maxCount),
    windowSeconds: str(r.windowSeconds, EMPTY.windowSeconds),
    approvedUsernames: r.approvedUsernames ?? '',
    businessHourStart: str(r.businessHourStartUTC, ''),
    businessHourEnd: str(r.businessHourEndUTC, ''),
    severity: r.severity,
  };
}

function fromTemplate(t: RuleTemplate): Values {
  return {
    ...EMPTY,
    name: t.name,
    ruleType: t.ruleType,
    metricField: t.metricField ?? EMPTY.metricField,
    operator: t.operator ?? EMPTY.operator,
    threshold: str(t.threshold, EMPTY.threshold),
    durationSeconds: str(t.durationSeconds, EMPTY.durationSeconds),
    eventType: t.eventType ?? EMPTY.eventType,
    groupByField: t.groupByField ?? EMPTY.groupByField,
    maxCount: str(t.maxCount, EMPTY.maxCount),
    windowSeconds: str(t.windowSeconds, EMPTY.windowSeconds),
    approvedUsernames: '',
    businessHourStart: str(t.businessHourStartUTC, ''),
    businessHourEnd: str(t.businessHourEndUTC, ''),
    severity: t.severity,
  };
}

type FieldErrors = Partial<Record<keyof Values, string>>;

function validate(v: Values): FieldErrors {
  const errors: FieldErrors = {};
  const positive = (key: keyof Values, label: string) => {
    const n = Number(v[key]);
    if (v[key].trim() === '' || !Number.isFinite(n) || n <= 0) errors[key] = `${label} must be a number above 0.`;
  };
  if (!v.name.trim()) errors.name = 'Give the rule a name.';
  if (v.ruleType === 'METRIC_THRESHOLD') {
    if (v.threshold.trim() === '' || !Number.isFinite(Number(v.threshold)) || Number(v.threshold) < 0)
      errors.threshold = 'Enter a number, 0 or more.';
    positive('durationSeconds', 'The duration');
  }
  if (v.ruleType === 'EVENT_FREQUENCY') {
    positive('maxCount', 'The count');
    positive('windowSeconds', 'The window');
  }
  if (v.ruleType === 'HEARTBEAT_MISSING') positive('durationSeconds', 'The time');
  if (v.ruleType === 'CREDENTIAL_STUFFING') {
    positive('maxCount', 'The number of IP addresses');
    positive('windowSeconds', 'The window');
  }
  if (v.ruleType === 'UNUSUAL_ACCESS' && (v.businessHourStart === '') !== (v.businessHourEnd === '')) {
    errors.businessHourEnd = 'Pick both hours, or "Any time" for both.';
  }
  return errors;
}

function payloadOf(v: Values): Record<string, unknown> {
  const base = { name: v.name.trim(), ruleType: v.ruleType, severity: v.severity };
  switch (v.ruleType) {
    case 'METRIC_THRESHOLD':
      return {
        ...base,
        metricField: v.metricField,
        operator: v.operator,
        threshold: Number(v.threshold),
        durationSeconds: Number(v.durationSeconds),
      };
    case 'EVENT_FREQUENCY':
      return {
        ...base,
        eventType: v.eventType,
        groupByField: v.groupByField,
        maxCount: Number(v.maxCount),
        windowSeconds: Number(v.windowSeconds),
      };
    case 'HEARTBEAT_MISSING':
      return { ...base, durationSeconds: Number(v.durationSeconds) };
    case 'CREDENTIAL_STUFFING':
      return { ...base, windowSeconds: Number(v.windowSeconds), maxCount: Number(v.maxCount) };
    case 'UNUSUAL_ACCESS':
      // empty fields go as null so they can be cleared when editing
      return {
        ...base,
        approvedUsernames: v.approvedUsernames.trim() || null,
        businessHourStartUTC: v.businessHourStart === '' ? null : Number(v.businessHourStart),
        businessHourEndUTC: v.businessHourEnd === '' ? null : Number(v.businessHourEnd),
      };
    default:
      return base;
  }
}

// The UTC clock for the business-hours hint, minutes only.
function subscribeToClock(onChange: () => void) {
  const timer = window.setInterval(onChange, 15_000);
  return () => window.clearInterval(timer);
}
const utcNow = () => new Date().toISOString().slice(11, 16);

/** A template as a small card: name, condition and severity. */
export function TemplateCard({
  template,
  selected = false,
  onClick,
  action,
}: {
  template: RuleTemplate;
  selected?: boolean;
  onClick?: () => void;
  /** Replaces the click target with a button inside the card (empty state). */
  action?: ReactNode;
}) {
  const body = (
    <>
      <span className="flex items-center justify-between gap-3">
        <span className="text-[14px] font-semibold text-foreground">{template.name}</span>
        <SeverityLights severity={template.severity} />
      </span>
      <span className="mt-1 block text-[13px] leading-snug text-muted-foreground">{template.summary}</span>
    </>
  );
  const frame = cn(
    'rounded-lg border p-3.5 text-left transition-colors duration-[120ms]',
    selected ? 'border-primary bg-primary/8' : 'border-border bg-surface-2',
  );
  if (action) {
    return (
      <div className={cn(frame, 'flex flex-col')}>
        {body}
        <div className="mt-3">{action}</div>
      </div>
    );
  }
  return (
    <button type="button" onClick={onClick} aria-pressed={selected} className={cn(frame, 'flex w-full flex-col justify-start hover:border-primary/50')}>
      {body}
    </button>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  className,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className={fieldLabelClass}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className={fieldInlineErrorClass}>
          {error}
        </p>
      ) : (
        hint && <p className={fieldHintClass}>{hint}</p>
      )}
    </div>
  );
}

/** A number input with its unit inside, e.g. "60 | s". */
function NumberInput({
  id,
  value,
  onChange,
  unit,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  invalid?: boolean;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        className={cn(fieldControlClass, unit && 'pr-16')}
      />
      {unit && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-muted-foreground">{unit}</span>
      )}
    </div>
  );
}

const durationHint = (value: string) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 60 ? `= ${formatDuration(n)}` : undefined;
};

export function RuleForm({ rule, onSaved, onCancel }: { rule: Rule | null; onSaved: (rule: Rule) => void; onCancel: () => void }) {
  const [values, setValues] = useState<Values>(() => (rule ? fromRule(rule) : EMPTY));
  const [template, setTemplate] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const now = useSyncExternalStore(subscribeToClock, utcNow, () => '');
  const editing = !!rule;
  const set = (key: keyof Values) => (value: string) => setValues((v) => ({ ...v, [key]: value }));
  const typeHint = RULE_TYPES.find((t) => t.value === values.ruleType)?.hint;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    if (Object.keys(found).length) return;
    setSaving(true);
    setSaveError('');
    try {
      const saved = editing
        ? await apiClient.patch<Rule>(`/rules/${rule.id}`, payloadOf(values))
        : await apiClient.post<Rule>('/rules', payloadOf(values));
      onSaved(saved);
    } catch (err) {
      setSaveError(friendlyError(err, "Couldn't save the rule. Try again."));
      setSaving(false);
    }
  }

  const hours = [{ value: '', label: 'Any time' }, ...Array.from({ length: 24 }, (_, h) => ({ value: String(h), label: hourLabel(h) }))];

  return (
    <Panel brackets title={editing ? `Edit rule: ${rule.name}` : 'New rule'} className="animate-fade-up">
      <form
        onSubmit={submit}
        noValidate
        onKeyDown={(e) => e.key === 'Escape' && !saving && onCancel()}
        className="space-y-6"
      >
        {!editing && (
          <fieldset>
            <legend className="text-[14px] font-semibold text-foreground">Start from a template</legend>
            <p className="mt-0.5 text-[13px] text-muted-foreground">Or fill in the fields below yourself.</p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {RULE_TEMPLATES.map((t) => (
                <TemplateCard
                  key={t.name}
                  template={t}
                  selected={template === t.name}
                  onClick={() => {
                    setTemplate(t.name);
                    setValues(fromTemplate(t));
                    setErrors({});
                  }}
                />
              ))}
            </div>
          </fieldset>
        )}

        <div className={cn('grid gap-5 lg:grid-cols-2', !editing && 'border-t border-border pt-6')}>
          <Field id="rule-name" label="Name" error={errors.name}>
            <input
              id="rule-name"
              value={values.name}
              onChange={(e) => set('name')(e.target.value)}
              autoFocus={editing}
              autoComplete="off"
              maxLength={100}
              aria-invalid={!!errors.name || undefined}
              aria-describedby={errors.name ? 'rule-name-error' : undefined}
              className={fieldControlClass}
            />
          </Field>
          <Field id="rule-type" label="Type" hint={typeHint}>
            <select id="rule-type" value={values.ruleType} onChange={(e) => set('ruleType')(e.target.value)} className={fieldSelectClass}>
              {RULE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {values.ruleType === 'METRIC_THRESHOLD' && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field id="rule-metric" label="Metric">
              <select id="rule-metric" value={values.metricField} onChange={(e) => set('metricField')(e.target.value)} className={fieldSelectClass}>
                {METRIC_FIELDS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="rule-operator" label="Fires when it is">
              <select id="rule-operator" value={values.operator} onChange={(e) => set('operator')(e.target.value)} className={fieldSelectClass}>
                <option value="GREATER_THAN">Above</option>
                <option value="LESS_THAN">Below</option>
              </select>
            </Field>
            <Field id="rule-threshold" label="Threshold" error={errors.threshold}>
              <NumberInput
                id="rule-threshold"
                value={values.threshold}
                onChange={set('threshold')}
                unit={METRIC_FIELDS.find((m) => m.value === values.metricField)?.unit}
                invalid={!!errors.threshold}
              />
            </Field>
            <Field id="rule-duration" label="For at least" error={errors.durationSeconds} hint={durationHint(values.durationSeconds)}>
              <NumberInput id="rule-duration" value={values.durationSeconds} onChange={set('durationSeconds')} unit="s" invalid={!!errors.durationSeconds} />
            </Field>
          </div>
        )}

        {values.ruleType === 'EVENT_FREQUENCY' && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field id="rule-event" label="Event">
              <select id="rule-event" value={values.eventType} onChange={(e) => set('eventType')(e.target.value)} className={fieldSelectClass}>
                {withCurrent(EVENT_TYPES, values.eventType).map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="rule-group" label="Counted per">
              <select id="rule-group" value={values.groupByField} onChange={(e) => set('groupByField')(e.target.value)} className={fieldSelectClass}>
                {withCurrent(GROUP_BY_FIELDS, values.groupByField).map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="rule-count" label="Fires at" error={errors.maxCount}>
              <NumberInput id="rule-count" value={values.maxCount} onChange={set('maxCount')} unit="events" invalid={!!errors.maxCount} />
            </Field>
            <Field id="rule-window" label="Within" error={errors.windowSeconds} hint={durationHint(values.windowSeconds)}>
              <NumberInput id="rule-window" value={values.windowSeconds} onChange={set('windowSeconds')} unit="s" invalid={!!errors.windowSeconds} />
            </Field>
          </div>
        )}

        {values.ruleType === 'HEARTBEAT_MISSING' && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field id="rule-missing" label="No report for" error={errors.durationSeconds} hint={durationHint(values.durationSeconds)}>
              <NumberInput id="rule-missing" value={values.durationSeconds} onChange={set('durationSeconds')} unit="s" invalid={!!errors.durationSeconds} />
            </Field>
          </div>
        )}

        {values.ruleType === 'CREDENTIAL_STUFFING' && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field id="rule-ips" label="Failed from at least" error={errors.maxCount}>
              <NumberInput id="rule-ips" value={values.maxCount} onChange={set('maxCount')} unit="IPs" invalid={!!errors.maxCount} />
            </Field>
            <Field id="rule-stuffing-window" label="Within" error={errors.windowSeconds} hint={durationHint(values.windowSeconds)}>
              <NumberInput
                id="rule-stuffing-window"
                value={values.windowSeconds}
                onChange={set('windowSeconds')}
                unit="s"
                invalid={!!errors.windowSeconds}
              />
            </Field>
          </div>
        )}

        {values.ruleType === 'UNUSUAL_ACCESS' && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              id="rule-approved"
              label="Approved sudo users"
              className="sm:col-span-2"
              hint="Comma-separated usernames. Leave empty to allow anyone."
            >
              <input
                id="rule-approved"
                value={values.approvedUsernames}
                onChange={(e) => set('approvedUsernames')(e.target.value)}
                placeholder="deploy, alice"
                autoComplete="off"
                className={cn(fieldControlClass, 'font-mono text-[13.5px]')}
              />
            </Field>
            <Field id="rule-hours-start" label="Business hours from (UTC)" hint={now ? `It's ${now} UTC now.` : undefined}>
              <select
                id="rule-hours-start"
                value={values.businessHourStart}
                onChange={(e) => set('businessHourStart')(e.target.value)}
                className={fieldSelectClass}
              >
                {hours.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field id="rule-hours-end" label="To (UTC)" error={errors.businessHourEnd}>
              <select
                id="rule-hours-end"
                value={values.businessHourEnd}
                onChange={(e) => set('businessHourEnd')(e.target.value)}
                aria-invalid={!!errors.businessHourEnd || undefined}
                className={fieldSelectClass}
              >
                {hours.map((h) => (
                  <option key={h.value} value={h.value}>
                    {h.label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}

        {values.ruleType === 'ANOMALY_DETECTION' && (
          <Notice tone="info">No settings needed. Each server is checked against the LSTM model trained on its own history.</Notice>
        )}

        <fieldset>
          <legend className={fieldLabelClass}>Severity</legend>
          <div role="radiogroup" aria-label="Severity" className="grid grid-cols-2 gap-2 sm:inline-grid sm:grid-cols-4">
            {SEVERITIES.map((s) => {
              const checked = values.severity === s;
              return (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => set('severity')(s)}
                  className={cn(
                    'flex h-10 items-center justify-center gap-2 rounded-lg border px-3.5 text-[13.5px] font-medium transition-colors duration-[120ms] sm:justify-start pointer-coarse:h-11',
                    checked ? 'border-primary bg-primary/10 text-foreground' : 'border-border-strong bg-surface-2 text-muted-foreground hover:text-foreground',
                  )}
                >
                  <SeverityLights severity={s} />
                  {severityLabel(s)}
                  {checked && <Check className="size-3.5 text-primary-bright" aria-hidden />}
                </button>
              );
            })}
          </div>
        </fieldset>

        {saveError && <Notice tone="error">{saveError}</Notice>}

        <div className="flex flex-col-reverse gap-2 border-t border-border pt-5 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Saving…' : editing ? 'Save changes' : 'Create rule'}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
