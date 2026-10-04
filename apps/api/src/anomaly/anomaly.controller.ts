import {
  Controller,
  Get,
  Param,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import { AnomalyService } from './anomaly.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { PrismaService } from '../prisma/prisma.service';

@Controller('servers')
@UseGuards(JwtAuthGuard)
export class AnomalyController {
  constructor(
    private anomalyService: AnomalyService,
    private prisma: PrismaService,
  ) {}

  @Get(':id/anomaly-score')
  async getAnomalyScore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') serverId: string,
  ) {
    const server = await this.prisma.server.findFirst({
      where: { id: serverId, organizationId: user.organizationId },
    });
    if (!server) throw new NotFoundException('Server not found');

    const result = await this.anomalyService.getAnomalyScore(serverId);
    return result ?? { error: 'Anomaly score unavailable for this server' };
  }
}
