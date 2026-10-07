// Labels and plain-language descriptions for detection rules.
import { formatDuration } from './format';

export interface Rule {
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

export interface Option {
  value: string;
  label: string;
}

export const RULE_TYPES: (Option & { hint: string })[] = [
  {
    value: 'METRIC_THRESHOLD',
    label: 'Metric threshold',
    hint: 'Fires when a metric stays above or below a value for the whole duration, e.g. high CPU.',
  },
  {
    value: 'EVENT_FREQUENCY',
    label: 'Event frequency',
    hint: 'Fires when one IP address, user or server produces too many events in a time window, e.g. brute-force logins.',
  },
  { value: 'HEARTBEAT_MISSING', label: 'Heartbeat missing', hint: 'Fires when a server stops reporting, e.g. after a crash.' },
  {
    value: 'CREDENTIAL_STUFFING',
    label: 'Credential stuffing',
    hint: 'Fires when an account fails to log in from several IP addresses and then succeeds.',
  },
  {
    value: 'ANOMALY_DETECTION',
    label: 'Anomaly detection',
    hint: "Fires when a server's LSTM model sees behavior it didn't learn as normal.",
  },
  { value: 'UNUSUAL_ACCESS', label: 'Unusual access', hint: 'Fires on sudo by users who are not approved, or outside business hours.' },
];

export const METRIC_FIELDS: (Option & { unit: string })[] = [
  { value: 'CPU_USAGE', label: 'CPU usage', unit: '%' },
  { value: 'MEM_USAGE', label: 'Memory usage', unit: '%' },
  { value: 'DISK_USAGE', label: 'Disk usage', unit: '%' },
  { value: 'NETWORK_IN', label: 'Network in', unit: 'bytes/s' },
  { value: 'NETWORK_OUT', label: 'Network out', unit: 'bytes/s' },
  { value: 'DISK_READ_RATE', label: 'Disk read rate', unit: 'bytes/s' },
  { value: 'DISK_WRITE_RATE', label: 'Disk write rate', unit: 'bytes/s' },
  { value: 'PROCESS_COUNT', label: 'Process count', unit: '' },
  { value: 'LOAD_AVERAGE', label: 'Load average', unit: '' },
];

// The event types the platform records and the fields they carry; the API
// rejects anything else (KNOWN_EVENT_TYPES / GROUPABLE_EVENT_FIELDS in rule-config.ts).
export const EVENT_TYPES: Option[] = [
  { value: 'AUTH_LOGIN_FAILURE', label: 'Web login failed' },
  { value: 'AUTH_LOGIN_SUCCESS', label: 'Web login succeeded' },
  { value: 'SSH_LOGIN_FAILURE', label: 'SSH login failed' },
  { value: 'SSH_LOGIN_SUCCESS', label: 'SSH login succeeded' },
  { value: 'SUDO_COMMAND', label: 'Sudo command' },
  { value: 'API_REQUEST', label: 'API request' },
  { value: 'AUTH_PASSWORD_RESET_REQUESTED', label: 'Password reset requested' },
  { value: 'AUTH_PASSWORD_RESET_COMPLETED', label: 'Password reset completed' },
];

export const GROUP_BY_FIELDS: Option[] = [
  { value: 'ipAddress', label: 'IP address' },
  { value: 'email', label: 'Email (web logins)' },
  { value: 'username', label: 'Username (SSH)' },
  { value: 'serverId', label: 'Server (SSH)' },
];

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
  email: 'one email address',
  username: 'one username',
  serverId: 'one server',
};

export const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const SEVERITY_RANK: Record<string, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

export function labelOf(options: Option[], value: string | null) {
  return options.find((o) => o.value === value)?.label ?? value ?? '?';
}

/** Keeps a value that is no longer in the list (e.g. an older rule) selectable. */
export function withCurrent(options: Option[], current: string) {
  return options.some((o) => o.value === current) ? options : [...options, { value: current, label: current }];
}

export function hourLabel(h: number | null) {
  return `${String(h ?? 0).padStart(2, '0')}:00`;
}

/** "within 1 min" instead of "within 60 s". */
const span = (seconds: number | null) => formatDuration(seconds ?? 0);

/** The rule's condition in plain words. */
export function describeCondition(r: Pick<Rule, Exclude<keyof Rule, 'id' | 'name' | 'severity' | 'isActive'>>) {
  switch (r.ruleType) {
    case 'METRIC_THRESHOLD': {
      const field = METRIC_FIELDS.find((m) => m.value === r.metricField);
      const unit = field?.unit === '%' ? '%' : field?.unit ? ` ${field.unit}` : '';
      const direction = r.operator === 'LESS_THAN' ? 'below' : 'above';
      return `${field?.label ?? r.metricField} ${direction} ${r.threshold}${unit} for ${span(r.durationSeconds)}`;
    }
    case 'EVENT_FREQUENCY': {
      const events = EVENT_PHRASES[r.eventType ?? ''] ?? `${r.eventType} events`;
      const group = GROUP_PHRASES[r.groupByField ?? ''] ?? `one ${r.groupByField}`;
      return `${r.maxCount}+ ${events} from ${group} within ${span(r.windowSeconds)}`;
    }
    case 'HEARTBEAT_MISSING':
      return `No report for ${span(r.durationSeconds)}`;
    case 'CREDENTIAL_STUFFING':
      return `Failed logins from ${r.maxCount}+ IP addresses, then a success, within ${span(r.windowSeconds)}`;
    case 'ANOMALY_DETECTION':
      return "LSTM error above the server's own threshold";
    case 'UNUSUAL_ACCESS': {
      const users = r.approvedUsernames
        ?.split(',')
        .map((u) => u.trim())
        .filter(Boolean);
      const parts = [
        users?.length ? `Sudo by anyone except ${users.length > 1 ? `${users.slice(0, -1).join(', ')} or ${users[users.length - 1]}` : users[0]}` : null,
        r.businessHourStartUTC !== null
          ? `${users?.length ? 'any sudo' : 'Any sudo'} outside ${hourLabel(r.businessHourStartUTC)}–${hourLabel(r.businessHourEndUTC)} UTC`
          : null,
      ].filter(Boolean);
      return parts.length ? parts.join(', or ') : 'Any sudo';
    }
    default:
      return '—';
  }
}

/** On first, then most severe, then by name. */
export function byRuleOrder(a: Rule, b: Rule) {
  return (
    Number(b.isActive) - Number(a.isActive) ||
    (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0) ||
    a.name.localeCompare(b.name)
  );
}
