// Turns an alert's raw `details` JSON (written by the rule engine) into rows
// people can read: "Time since last report: 27 min" instead of
// "secondsSinceLastHeartbeat 1633".
import { formatDateTime, formatDuration, formatNumber } from './format';
import { EVENT_TYPES, GROUP_BY_FIELDS, METRIC_FIELDS, labelOf } from './rule-format';

export interface DetailRow {
  label: string;
  value: string;
  /** Machine data (IPs, usernames, commands) is shown in the mono face. */
  mono?: boolean;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;

const REASONS: Record<string, string> = {
  unapproved_user: 'User is not on the approved list',
  outside_business_hours: 'Outside business hours',
};

// Known keys, in the order they read best. Anything else falls back to a
// generic label and value below.
const KNOWN: Record<string, { label: string; format?: (value: unknown, all: Record<string, unknown>) => string; mono?: boolean }> = {
  value: { label: 'Value', format: (v, all) => `${trim(v)}${unitOf(all)}` },
  threshold: { label: 'Threshold', format: (v, all) => (all.metricField ? `${trim(v)}${unitOf(all)}` : trim(v)) },
  metricField: { label: 'Metric', format: (v) => labelOf(METRIC_FIELDS, String(v)) },
  reconstructionError: { label: 'Reconstruction error', format: (v) => trim(v), mono: true },
  detectionMethod: { label: 'Model', format: (v) => (v === 'LSTM-Autoencoder' ? 'LSTM autoencoder' : String(v)) },
  lastHeartbeat: { label: 'Last report', format: (v) => formatDateTime(String(v), true) },
  secondsSinceLastHeartbeat: { label: 'Time since last report', format: (v) => formatDuration(Number(v)) },
  eventType: { label: 'Event', format: (v) => labelOf(EVENT_TYPES, String(v)) },
  groupByField: { label: 'Counted per', format: (v) => labelOf(GROUP_BY_FIELDS, String(v)) },
  groupValue: { label: 'From', mono: true },
  count: { label: 'Events', format: (v) => formatNumber(Number(v)) },
  totalFailures: { label: 'Failed logins', format: (v) => formatNumber(Number(v)) },
  distinctIpCount: { label: 'IP addresses', format: (v) => formatNumber(Number(v)) },
  ipAddresses: { label: 'From', format: (v) => (Array.isArray(v) ? v.join(', ') : String(v)), mono: true },
  email: { label: 'Account', mono: true },
  username: { label: 'User', mono: true },
  command: { label: 'Command', mono: true },
  reason: { label: 'Why', format: (v) => REASONS[String(v)] ?? String(v) },
  outcome: { label: 'Outcome', format: (v) => (v === 'SUCCESS' ? 'Succeeded' : v === 'FAILURE' ? 'Failed' : String(v)) },
  lastEventAt: { label: 'Last event', format: (v) => formatDateTime(String(v), true) },
};
// internal ids that mean nothing to a reader
const HIDDEN = new Set(['eventId']);

function trim(v: unknown) {
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(n < 1 ? 4 : 1)));
}

function unitOf(all: Record<string, unknown>) {
  const unit = METRIC_FIELDS.find((m) => m.value === all.metricField)?.unit;
  return unit === '%' ? '%' : unit ? ` ${unit}` : '';
}

function sentenceCase(key: string) {
  const words = key.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').trim().toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function genericValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'number') return trim(value);
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'string' && ISO_DATE.test(value)) return formatDateTime(value, true);
  if (Array.isArray(value)) return value.map((v) => (typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function alertDetailRows(details: Record<string, unknown> | null | undefined): DetailRow[] {
  if (!details) return [];
  const known = Object.keys(KNOWN).filter((key) => key in details);
  const rest = Object.keys(details).filter((key) => !(key in KNOWN) && !HIDDEN.has(key));
  return [
    ...known.map((key) => {
      const { label, format, mono } = KNOWN[key];
      const value = details[key];
      return { label, value: value === null || value === undefined ? '—' : format ? format(value, details) : String(value), mono };
    }),
    ...rest.map((key) => ({ label: sentenceCase(key), value: genericValue(details[key]) })),
  ];
}
