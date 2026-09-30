import {
  IsEnum,
  IsInt,
  IsNumber,
  IsString,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import {
  RuleType,
  MetricField,
  ComparisonOperator,
  Severity,
} from '@prisma/client';

export class CreateRuleDto {
  @IsString()
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
  @Min(0)
  durationSeconds?: number;

  // Event-frequency fields (optional — only used when ruleType = EVENT_FREQUENCY)
  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsString()
  groupByField?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  windowSeconds?: number;

  // Unusual-access fields (optional — only used when ruleType = UNUSUAL_ACCESS)
  @IsOptional()
  @IsString()
  approvedUsernames?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  businessHourStartUTC?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  businessHourEndUTC?: number;

  @IsEnum(Severity)
  severity: Severity;
}
