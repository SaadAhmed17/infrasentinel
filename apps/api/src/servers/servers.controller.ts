import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  Patch,
  Delete,
} from '@nestjs/common';
import { ServersService } from './servers.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateServerDto } from './dto/create-server.dto';
import type { AuthenticatedUser } from '../auth/types/authenticated-user.type';

@Controller('servers')
@UseGuards(JwtAuthGuard)
export class ServersController {
  constructor(private serversService: ServersService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'DEVOPS_ENGINEER')
  createServer(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateServerDto,
  ) {
    return this.serversService.createServer(user.organizationId, dto);
  }

  @Get()
  listServers(@CurrentUser() user: AuthenticatedUser) {
    return this.serversService.listServers(user.organizationId);
  }
  @Get(':id/metrics')
  getServerMetrics(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') serverId: string,
    @Query('limit') limit?: string,
  ) {
    return this.serversService.getServerMetrics(
      user.organizationId,
      serverId,
      limit ? parseInt(limit) : 50,
    );
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'DEVOPS_ENGINEER')
  updateServer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body('name') name: string,
  ) {
    return this.serversService.updateServer(user.organizationId, id, name);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles('OWNER', 'ADMIN', 'DEVOPS_ENGINEER')
  deleteServer(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.serversService.deleteServer(user.organizationId, id);
  }
}
