import { IsEnum } from 'class-validator';
import { Role } from '@prisma/client';

export class UpdateMemberRoleDto {
  @IsEnum(Role)
  role: Role;
}
