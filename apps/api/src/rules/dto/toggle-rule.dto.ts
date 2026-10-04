import { IsBoolean } from 'class-validator';

export class ToggleRuleDto {
  @IsBoolean()
  isActive: boolean;
}
