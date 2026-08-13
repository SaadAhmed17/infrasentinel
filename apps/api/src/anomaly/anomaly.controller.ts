import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AnomalyService } from './anomaly.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('servers')
@UseGuards(JwtAuthGuard)
export class AnomalyController {
  constructor(private anomalyService: AnomalyService) {}

  @Get(':id/anomaly-score')
  async getAnomalyScore(@Param('id') serverId: string) {
    const result = await this.anomalyService.getAnomalyScore(serverId);
    return result ?? { error: 'Anomaly score unavailable for this server' };
  }
}