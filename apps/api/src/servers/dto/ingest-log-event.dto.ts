import { IsIn, IsString, IsOptional } from 'class-validator';

export class IngestLogEventDto {
  @IsString()
  eventType!: string;

  @IsIn(['SUCCESS', 'FAILURE'])
  outcome!: 'SUCCESS' | 'FAILURE';

  @IsString()
  username!: string;

  @IsString()
  ipAddress!: string;

  @IsOptional()
  @IsString()
  command?: string;
}
