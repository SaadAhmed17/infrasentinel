import { IsEnum, IsNumber, IsString, IsOptional, Min } from 'class-validator';
import {
  RuleType,
  MetricField,
  ComparisonOperator,
  Severity,
} from '@prisma/client';

// A real class (not the TypeScript type `Partial<CreateRuleDto>`) so the global
// ValidationPipe validates every field and strips anything else, such as
// organizationId. Same rules as CreateRuleDto, but every field is optional.
export class UpdateRuleDto {
  @IsOptional()
  @IsString()
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
  @Min(0)
  durationSeconds?: number;

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

  @IsOptional()
  @IsEnum(Severity)
  severity?: Severity;
}
