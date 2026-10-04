import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRuleDto } from './dto/create-rule.dto';
import { UpdateRuleDto } from './dto/update-rule.dto';
import { assertRuleIsComplete } from './rule-config';

@Injectable()
export class RulesService {
  constructor(private prisma: PrismaService) {}

  async createRule(organizationId: string, dto: CreateRuleDto) {
    assertRuleIsComplete(dto);
    return this.prisma.rule.create({
      data: { ...dto, organizationId },
    });
  }

  async listRules(organizationId: string) {
    return this.prisma.rule.findMany({ where: { organizationId } });
  }

  async toggleRule(organizationId: string, ruleId: string, isActive: boolean) {
    const rule = await this.prisma.rule.findFirst({
      where: { id: ruleId, organizationId },
    });
    if (!rule) throw new NotFoundException('Rule not found');

    return this.prisma.rule.update({
      where: { id: ruleId },
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
  async updateRule(organizationId: string, ruleId: string, dto: UpdateRuleDto) {
    const rule = await this.prisma.rule.findFirst({
      where: { id: ruleId, organizationId },
    });
    if (!rule) throw new NotFoundException('Rule not found');

    // The rule as it will be after this update must still be able to fire.
    assertRuleIsComplete({ ...rule, ...dto });

    return this.prisma.rule.update({
      where: { id: ruleId },
      data: dto,
    });
  }
}
