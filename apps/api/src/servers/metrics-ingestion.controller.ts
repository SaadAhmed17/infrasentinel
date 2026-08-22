import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ServersService } from './servers.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { IngestMetricDto } from './dto/ingest-metric.dto';
import { IngestLogEventDto } from './dto/ingest-log-event.dto';

interface RequestWithMonitoredServer {
  monitoredServer: {
    organizationId: string;
    id: string;
  };
}

@Controller('agent')
@UseGuards(ApiKeyGuard)
export class MetricsIngestionController {
  constructor(private serversService: ServersService) {}

  @Post('metrics')
  ingestMetric(
    @Req() req: RequestWithMonitoredServer,
    @Body() dto: IngestMetricDto,
  ) {
    return this.serversService.ingestMetric(req.monitoredServer.id, dto);
  }
  @Post('log-event')
  async ingestLogEvent(
    @Req() req: RequestWithMonitoredServer,
    @Body() dto: IngestLogEventDto,
  ) {
    return this.serversService.ingestLogEvent(
      req.monitoredServer.id,
      req.monitoredServer.organizationId,
      dto,
    );
  }
}
