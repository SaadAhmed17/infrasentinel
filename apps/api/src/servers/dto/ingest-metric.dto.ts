import { IsNumber, Min, Max } from 'class-validator';

export class IngestMetricDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  cpuUsage: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  memUsage: number;

  @IsNumber()
  @Min(0)
  @Max(100)
  diskUsage: number;
}
