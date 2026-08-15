import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Post,
  UseGuards,
  Delete,
} from '@nestjs/common';
import { RulesService } from './rules.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';
import { CreateRuleDto } from './dto/create-rule.dto';

@Controller('rules')
@UseGuards(JwtAuthGuard)
export class RulesController {
  constructor(private rulesService: RulesService) {}

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'SECURITY_ANALYST')
  deleteRule(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.rulesService.deleteRule(user.organizationId, id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'SECURITY_ANALYST')
  createRule(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateRuleDto,
  ) {
    return this.rulesService.createRule(user.organizationId, dto);
  }

  @Get()
  listRules(@CurrentUser() user: AuthenticatedUser) {
    return this.rulesService.listRules(user.organizationId);
  }

  @Patch(':id/toggle')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'SECURITY_ANALYST')
  toggleRule(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.rulesService.toggleRule(user.organizationId, id, isActive);
  }
}
