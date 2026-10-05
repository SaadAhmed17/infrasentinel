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
    return this.prisma.rule.findMany({
      where: { organizationId, deletedAt: null },
    });
  }

  async toggleRule(organizationId: string, ruleId: string, isActive: boolean) {
    const rule = await this.prisma.rule.findFirst({
      where: { id: ruleId, organizationId, deletedAt: null },
    });
    if (!rule) throw new NotFoundException('Rule not found');

    return this.prisma.rule.update({
      where: { id: ruleId },
      data: { isActive },
    });
  }
  // Deleting hides the rule and switches it off, but keeps it in the database
  // so its alerts and incidents (the security history) stay intact.
  async deleteRule(organizationId: string, ruleId: string) {
    const rule = await this.prisma.rule.findFirst({
      where: { id: ruleId, organizationId, deletedAt: null },
    });
    if (!rule) throw new NotFoundException('Rule not found');

    await this.prisma.rule.update({
      where: { id: ruleId },
      data: { deletedAt: new Date(), isActive: false },
    });

    return { deleted: true, ruleId };
  }
  async updateRule(organizationId: string, ruleId: string, dto: UpdateRuleDto) {
    const rule = await this.prisma.rule.findFirst({
      where: { id: ruleId, organizationId, deletedAt: null },
    });
    if (!rule) throw new NotFoundException('Rule not found');

    // Fields the request did not send are present on the DTO as undefined;
    // they must not overwrite the rule's current values in the check below.
    const changes = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    ) as UpdateRuleDto;

    // The rule as it will be after this update must still be able to fire.
    assertRuleIsComplete({ ...rule, ...changes });

    return this.prisma.rule.update({
      where: { id: ruleId },
      data: changes,
    });
  }
}
