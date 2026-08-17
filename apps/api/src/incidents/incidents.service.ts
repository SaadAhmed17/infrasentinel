import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class IncidentsService {
  constructor(private prisma: PrismaService) {}

  async listIncidents(organizationId: string) {
    return this.prisma.incident.findMany({
      where: { organizationId },
      include: {
        alerts: {
          include: {
            rule: { select: { name: true, ruleType: true } },
            server: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getDashboardSummary(organizationId: string) {
    const [servers, openIncidents, recentAlerts, activeRules] =
      await Promise.all([
        this.prisma.server.findMany({
          where: { organizationId },
          select: { id: true, name: true, status: true, lastHeartbeat: true },
        }),
        this.prisma.incident.count({
          where: { organizationId, status: { in: ['OPEN', 'INVESTIGATING'] } },
        }),
        this.prisma.alert.findMany({
          where: { rule: { organizationId } },
          orderBy: { createdAt: 'desc' },
          take: 5,
          include: {
            rule: { select: { name: true, severity: true } },
            server: { select: { name: true } },
          },
        }),
        this.prisma.rule.count({ where: { organizationId, isActive: true } }),
      ]);

    const onlineCount = servers.filter((s) => s.status === 'ONLINE').length;

    return {
      servers: {
        total: servers.length,
        online: onlineCount,
        offline: servers.length - onlineCount,
      },
      openIncidents,
      activeRules,
      recentAlerts,
    };
  }

  async updateIncidentStatus(
    organizationId: string,
    incidentId: string,
    status: string,
  ) {
    return this.prisma.incident.updateMany({
      where: { id: incidentId, organizationId },
      data: {
        status: status as 'OPEN' | 'INVESTIGATING' | 'RESOLVED',
        resolvedAt: status === 'RESOLVED' ? new Date() : null,
      },
    });
  }
}
