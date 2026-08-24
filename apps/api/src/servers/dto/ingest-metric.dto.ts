import { IsNumber, Min, Max, IsOptional, IsInt } from 'class-validator';

export class IngestMetricDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  cpuUsage!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  memUsage!: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  diskUsage!: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  networkIn?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  networkOut?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  diskReadRate?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  diskWriteRate?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  processCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  loadAverage?: number;
}
