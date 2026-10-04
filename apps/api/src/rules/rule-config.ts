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
>;

// Fields the rule engine needs for each rule type; without them the rule is
// skipped on every tick and would silently never fire.
const REQUIRED_FIELDS: Record<RuleType, (keyof RuleConfig)[]> = {
  METRIC_THRESHOLD: ['metricField', 'operator', 'threshold'],
  EVENT_FREQUENCY: ['eventType', 'groupByField', 'maxCount', 'windowSeconds'],
  CREDENTIAL_STUFFING: ['maxCount', 'windowSeconds'],
  HEARTBEAT_MISSING: [], // durationSeconds has a default
  ANOMALY_DETECTION: [],
};

export function assertRuleIsComplete(
  rule: Partial<RuleConfig> & Pick<RuleConfig, 'ruleType'>,
) {
  const missing = REQUIRED_FIELDS[rule.ruleType].filter(
    (field) => rule[field] === null || rule[field] === undefined,
  );
  if (missing.length > 0) {
    throw new BadRequestException(
      `A ${rule.ruleType} rule needs: ${missing.join(', ')}`,
    );
  }
}
