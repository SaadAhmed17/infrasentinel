import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRuleDto } from './dto/create-rule.dto';

@Injectable()
export class RulesService {
  constructor(private prisma: PrismaService) {}

  async createRule(organizationId: string, dto: CreateRuleDto) {
    return this.prisma.rule.create({
      data: { ...dto, organizationId },
    });
  }

  async listRules(organizationId: string) {
    return this.prisma.rule.findMany({ where: { organizationId } });
  }

  async toggleRule(organizationId: string, ruleId: string, isActive: boolean) {
    return this.prisma.rule.updateMany({
      where: { id: ruleId, organizationId },
      data: { isActive },
    });
  }
}