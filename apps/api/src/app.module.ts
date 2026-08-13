import { Module } from '@nestjs/common';
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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
