import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EventsService } from './events.service';
import { ApiUsageMiddleware } from './api-usage.middleware';

@Module({
  imports: [JwtModule.register({})],
  providers: [EventsService, ApiUsageMiddleware],
  exports: [EventsService, ApiUsageMiddleware],
})
export class EventsModule {}
