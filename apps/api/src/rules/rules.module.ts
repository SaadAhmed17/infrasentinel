import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { RulesService } from './rules.service';
import { RulesController } from './rules.controller';
import { RuleEngineService } from './rule-engine.service';

@Module({
  imports: [ScheduleModule.forRoot()],
  controllers: [RulesController],
  providers: [RulesService, RuleEngineService],
})
export class RulesModule {}
