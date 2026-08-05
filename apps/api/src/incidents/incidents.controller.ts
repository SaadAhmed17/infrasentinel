import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { IncidentsService } from './incidents.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Controller('incidents')
@UseGuards(JwtAuthGuard)
export class IncidentsController {
  constructor(private incidentsService: IncidentsService) {}

  @Get()
  listIncidents(@CurrentUser() user: AuthenticatedUser) {
    return this.incidentsService.listIncidents(user.organizationId);
  }

  @Patch(':id/status')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'SECURITY_ANALYST')
  updateStatus(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('status') status: string,
  ) {
    return this.incidentsService.updateIncidentStatus(
      user.organizationId,
      id,
      status,
    );
  }
}
