import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ServersService } from './servers.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { IngestMetricDto } from './dto/ingest-metric.dto';

interface RequestWithMonitoredServer {
  monitoredServer: { id: string };
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
}
