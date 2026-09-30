import { IsEnum } from 'class-validator';
import { IncidentStatus } from '@prisma/client';

export class UpdateIncidentStatusDto {
  @IsEnum(IncidentStatus)
  status: IncidentStatus;
}
