import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AnomalyService } from './anomaly.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Controller('servers')
@UseGuards(JwtAuthGuard)
export class AnomalyController {
  constructor(private anomalyService: AnomalyService) {}

  @Get(':id/anomaly-score')
  async getAnomalyScore(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') serverId: string,
  ) {
    const result = await this.anomalyService.getAnomalyScoreForOrganization(
      user.organizationId,
      serverId,
    );
    return result ?? { error: 'Anomaly score unavailable for this server' };
  }
}
