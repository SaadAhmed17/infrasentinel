import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { ServersModule } from './servers/servers.module';
import { EventsModule } from './events/events.module';
import { RulesModule } from './rules/rules.module';
import { IncidentsModule } from './incidents/incidents.module';
import { AnomalyModule } from './anomaly/anomaly.module';
import { RagModule } from './rag/rag.module';
import { ApiUsageMiddleware } from './events/api-usage.middleware';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    OrganizationsModule,
    ServersModule,
    EventsModule,
    RulesModule,
    IncidentsModule,
    AnomalyModule,
    RagModule,
    EventsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(ApiUsageMiddleware).forRoutes('*');
  }
}
