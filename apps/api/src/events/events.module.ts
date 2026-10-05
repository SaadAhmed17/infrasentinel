import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { EventsService } from './events.service';
import { ApiUsageMiddleware } from './api-usage.middleware';

@Module({
  imports: [JwtModule.register({})],
  providers: [EventsService, ApiUsageMiddleware],
  // JwtModule is exported because AppModule applies the middleware, so its
  // JwtService dependency must be resolvable there.
  exports: [EventsService, ApiUsageMiddleware, JwtModule],
})
export class EventsModule {}
