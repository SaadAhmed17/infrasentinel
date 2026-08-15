import { Injectable, NotFoundException } from '@nestjs/common';
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
  async deleteRule(organizationId: string, ruleId: string) {
    const rule = await this.prisma.rule.findFirst({
      where: {
        id: ruleId,
        organizationId,
      },
    });

    if (!rule) {
      throw new NotFoundException('Rule not found');
    }

    await this.prisma.alert.deleteMany({
      where: {
        ruleId,
      },
    });

    await this.prisma.rule.delete({
      where: {
        id: ruleId,
      },
    });

    return {
      deleted: true,
      ruleId,
    };
  }
}
