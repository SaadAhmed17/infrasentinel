import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateInvitationDto } from './dto/create-invitation.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private orgService: OrganizationsService) {}

  @Get('me')
  getMyOrg(@CurrentUser() user: any) {
    return this.orgService.getMyOrganization(user.organizationId);
  }

  @Get('members')
  listMembers(@CurrentUser() user: any) {
    return this.orgService.listMembers(user.organizationId);
  }

  @Patch('settings')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  updateSettings(@CurrentUser() user: any, @Body() dto: UpdateOrganizationDto) {
    return this.orgService.updateOrganization(user.organizationId, dto);
  }

  @Post('invitations')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  createInvitation(@CurrentUser() user: any, @Body() dto: CreateInvitationDto) {
    return this.orgService.createInvitation(user.organizationId, dto);
  }

  @Get('invitations')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN')
  listInvitations(@CurrentUser() user: any) {
    return this.orgService.listInvitations(user.organizationId);
  }
}