import {
  Body,
  Controller,
  Get,
  Patch,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import type { AuthenticatedUser } from 'src/auth/types/authenticated-user.type';
import { Role } from '@prisma/client';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private orgService: OrganizationsService) {}

  @Get('me')
  getMyOrg(@CurrentUser() user: AuthenticatedUser) {
    return this.orgService.getMyOrganization(user.organizationId);
  }

  @Get('members')
  listMembers(@CurrentUser() user: AuthenticatedUser) {
    return this.orgService.listMembers(user.organizationId);
  }

  @Patch('settings')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  updateSettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.orgService.updateOrganization(user.organizationId, dto);
  }

  @Patch('members/:userId/role')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  updateMemberRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('userId') userId: string,
    @Body('role') role: Role,
  ) {
    return this.orgService.updateMemberRole(user.organizationId, userId, role);
  }

  @Post('invitations')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  createInvitation(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.orgService.createInvitation(user.organizationId, dto);
  }

  @Get('invitations')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  listInvitations(@CurrentUser() user: AuthenticatedUser) {
    return this.orgService.listInvitations(user.organizationId);
  }
}
