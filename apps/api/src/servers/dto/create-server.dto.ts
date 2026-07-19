import { IsString, MinLength, IsOptional } from 'class-validator';

export class CreateServerDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  hostname?: string;
}
