import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RulesService } from './rules.service';
import { RulesController } from './rules.controller';
import { RuleEngineService } from './rule-engine.service';
import { AnomalyModule } from '../anomaly/anomaly.module';
import { RagModule } from '../rag/rag.module';

@Module({
  imports: [ScheduleModule.forRoot(), AnomalyModule, RagModule],
  controllers: [RulesController],
  providers: [RulesService, RuleEngineService],
})
export class RulesModule {}
