import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { RagService } from './rag.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { IsString, MinLength, IsNotEmpty } from 'class-validator';

class RagQueryDto {
  @IsString()
  @MinLength(3)
  @IsNotEmpty()
  question!: string;
}

@Controller('rag')
@UseGuards(JwtAuthGuard)
export class RagController {
  constructor(private ragService: RagService) {}

  @Post('query')
  query(@CurrentUser() user: AuthenticatedUser, @Body() dto: RagQueryDto) {
    return this.ragService.query(user.organizationId, dto.question);
  }

  @Post('reindex')
  reindex(@CurrentUser() user: AuthenticatedUser) {
    return this.ragService.reindex(user.organizationId);
  }
}
