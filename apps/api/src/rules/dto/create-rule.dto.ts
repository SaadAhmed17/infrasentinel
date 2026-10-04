import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsString,
  IsOptional,
  Min,
} from 'class-validator';
import {
  RuleType,
  MetricField,
  ComparisonOperator,
  Severity,
} from '@prisma/client';
import { GROUPABLE_EVENT_FIELDS, KNOWN_EVENT_TYPES } from '../rule-config';

export class CreateRuleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(RuleType)
  ruleType: RuleType;

  // Metric-threshold fields (optional — only used when ruleType = METRIC_THRESHOLD)
  @IsOptional()
  @IsEnum(MetricField)
  metricField?: MetricField;

  @IsOptional()
  @IsEnum(ComparisonOperator)
  operator?: ComparisonOperator;

  @IsOptional()
  @IsNumber()
  threshold?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  durationSeconds?: number;

  // Event-frequency fields (optional — only used when ruleType = EVENT_FREQUENCY)
  @IsOptional()
  @IsIn(KNOWN_EVENT_TYPES)
  eventType?: string;

  @IsOptional()
  @IsIn(GROUPABLE_EVENT_FIELDS)
  groupByField?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  windowSeconds?: number;

  @IsEnum(Severity)
  severity: Severity;
}
