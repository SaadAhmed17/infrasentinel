import { Module } from '@nestjs/common';
import { ServersService } from './servers.service';
import { ServersController } from './servers.controller';
import { MetricsIngestionController } from './metrics-ingestion.controller';
import { ApiKeyGuard } from './guards/api-key.guard';
import { EventsModule } from '../events/events.module';

@Module({
  imports: [EventsModule],
  controllers: [ServersController, MetricsIngestionController],
  providers: [ServersService, ApiKeyGuard],
})
export class ServersModule {}
