import {
  IsEnum,
  IsIn,
  IsInt,
  Max,
  MaxLength,
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

// A real class (not the TypeScript type `Partial<CreateRuleDto>`) so the global
// ValidationPipe validates every field and strips anything else, such as
// organizationId. Same rules as CreateRuleDto, but every field is optional.
export class UpdateRuleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsEnum(RuleType)
  ruleType?: RuleType;

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

  // Unusual-access fields (only used when ruleType = UNUSUAL_ACCESS)
  @IsOptional()
  @IsString()
  @MaxLength(500)
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

  @IsOptional()
  @IsEnum(Severity)
  severity?: Severity;
}
