// Ready-made detection rules: used by the rule form, the empty rules page and
// the dashboard's setup checklist. Values are what POST /rules expects.
export interface RuleTemplate {
  name: string;
  /** The condition in plain words, shown next to the name. */
  summary: string;
  ruleType: string;
  severity: string;
  metricField?: string;
  operator?: string;
  threshold?: number;
  durationSeconds?: number;
  eventType?: string;
  groupByField?: string;
  maxCount?: number;
  windowSeconds?: number;
  businessHourStartUTC?: number;
  businessHourEndUTC?: number;
}

export const RULE_TEMPLATES: RuleTemplate[] = [
  {
    name: 'SSH brute force',
    summary: '5+ failed SSH logins from one IP address within 1 min',
    ruleType: 'EVENT_FREQUENCY',
    eventType: 'SSH_LOGIN_FAILURE',
    groupByField: 'ipAddress',
    maxCount: 5,
    windowSeconds: 60,
    severity: 'CRITICAL',
  },
  {
    name: 'Web login brute force',
    summary: '10+ failed web logins from one IP address within 5 min',
    ruleType: 'EVENT_FREQUENCY',
    eventType: 'AUTH_LOGIN_FAILURE',
    groupByField: 'ipAddress',
    maxCount: 10,
    windowSeconds: 300,
    severity: 'HIGH',
  },
  {
    name: 'High CPU',
    summary: 'CPU usage above 85% for 1 min',
    ruleType: 'METRIC_THRESHOLD',
    metricField: 'CPU_USAGE',
    operator: 'GREATER_THAN',
    threshold: 85,
    durationSeconds: 60,
    severity: 'HIGH',
  },
  {
    name: 'Service crash',
    summary: 'No report from a server for 30 s',
    ruleType: 'HEARTBEAT_MISSING',
    durationSeconds: 30,
    severity: 'CRITICAL',
  },
  {
    name: 'API flood',
    summary: '100+ API requests from one IP address within 1 min',
    ruleType: 'EVENT_FREQUENCY',
    eventType: 'API_REQUEST',
    groupByField: 'ipAddress',
    maxCount: 100,
    windowSeconds: 60,
    severity: 'HIGH',
  },
  {
    name: 'Off-hours root access',
    summary: 'Any sudo outside 09:00–18:00 UTC',
    ruleType: 'UNUSUAL_ACCESS',
    businessHourStartUTC: 9,
    businessHourEndUTC: 18,
    severity: 'HIGH',
  },
];

/** The request body for creating a rule from a template. */
export function templatePayload(template: RuleTemplate) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- summary is display text, not part of the rule
  const { summary, ...rule } = template;
  return rule;
}
