import { IsString, MinLength } from 'class-validator';

export class UpdateServerDto {
  @IsString()
  @MinLength(2)
  name: string;
}
