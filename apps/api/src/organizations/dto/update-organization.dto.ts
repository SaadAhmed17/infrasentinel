import { IsString, MinLength } from 'class-validator';

export class UpdateOrganizationDto {
  @IsString()
  @MinLength(2)
  name: string;
}
