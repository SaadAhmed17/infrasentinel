import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { JwtModule } from '@nestjs/jwt';
import { ApiUsageMiddleware } from './api-usage.middleware';

@Module({
  imports: [JwtModule.register({})],
  providers: [EventsService, ApiUsageMiddleware],
  exports: [EventsService, ApiUsageMiddleware, JwtModule],
})
export class EventsModule {}
