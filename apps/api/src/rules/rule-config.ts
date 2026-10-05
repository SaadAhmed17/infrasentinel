import { BadRequestException } from '@nestjs/common';
import type { Rule, RuleType } from '@prisma/client';

// Event types the platform actually records (auth-service and the SSH agent).
// A rule on any other type could never fire, so it is rejected. Add new types
// here when a new event source is added.
export const KNOWN_EVENT_TYPES = [
  'AUTH_LOGIN_FAILURE',
  'AUTH_LOGIN_SUCCESS',
  'AUTH_PASSWORD_RESET_REQUESTED',
  'AUTH_PASSWORD_RESET_COMPLETED',
  'SSH_LOGIN_FAILURE',
  'SSH_LOGIN_SUCCESS',
  'SUDO_COMMAND',
  'API_REQUEST',
] as const;

// Metadata fields those events carry, so they can be used to group events.
export const GROUPABLE_EVENT_FIELDS = [
  'ipAddress',
  'email',
  'username',
  'serverId',
] as const;

type RuleConfig = Pick<
  Rule,
  | 'ruleType'
  | 'metricField'
  | 'operator'
  | 'threshold'
  | 'eventType'
  | 'groupByField'
  | 'maxCount'
  | 'windowSeconds'
  | 'approvedUsernames'
  | 'businessHourStartUTC'
  | 'businessHourEndUTC'
>;

// Fields the rule engine needs for each rule type; without them the rule is
// skipped on every tick and would silently never fire.
const REQUIRED_FIELDS: Record<RuleType, (keyof RuleConfig)[]> = {
  METRIC_THRESHOLD: ['metricField', 'operator', 'threshold'],
  EVENT_FREQUENCY: ['eventType', 'groupByField', 'maxCount', 'windowSeconds'],
  CREDENTIAL_STUFFING: ['maxCount', 'windowSeconds'],
  HEARTBEAT_MISSING: [], // durationSeconds has a default
  ANOMALY_DETECTION: [],
  UNUSUAL_ACCESS: [], // checked below: approved users and/or business hours
};

const isSet = (value: unknown) => value !== null && value !== undefined;

export function assertRuleIsComplete(
  rule: Partial<RuleConfig> & Pick<RuleConfig, 'ruleType'>,
) {
  const missing = REQUIRED_FIELDS[rule.ruleType].filter(
    (field) => !isSet(rule[field]),
  );
  if (missing.length > 0) {
    throw new BadRequestException(
      `${rule.ruleType} rules need: ${missing.join(', ')}`,
    );
  }

  if (rule.ruleType === 'UNUSUAL_ACCESS') {
    const hasStart = isSet(rule.businessHourStartUTC);
    const hasEnd = isSet(rule.businessHourEndUTC);
    if (hasStart !== hasEnd) {
      throw new BadRequestException(
        'UNUSUAL_ACCESS rules need both businessHourStartUTC and businessHourEndUTC, or neither',
      );
    }
    if (hasStart && rule.businessHourStartUTC! >= rule.businessHourEndUTC!) {
      throw new BadRequestException(
        'businessHourStartUTC must be earlier than businessHourEndUTC',
      );
    }
    if (!rule.approvedUsernames?.trim() && !hasStart) {
      throw new BadRequestException(
        'UNUSUAL_ACCESS rules need approvedUsernames, business hours, or both',
      );
    }
  }
}
