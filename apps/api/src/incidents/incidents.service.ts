import { Injectable, NotFoundException } from '@nestjs/common';
import { IncidentStatus } from '@prisma/client';
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
    status: IncidentStatus,
  ) {
    const incident = await this.prisma.incident.findFirst({
      where: { id: incidentId, organizationId },
    });
    if (!incident) throw new NotFoundException('Incident not found');

    const resolved = status === 'RESOLVED';
    return this.prisma.$transaction(async (tx) => {
      // Resolving the incident resolves its alerts too. Alert de-duplication
      // only blocks while an alert is OPEN, so once the problem is handled a
      // recurrence raises a fresh alert instead of being suppressed forever.
      if (resolved) {
        await tx.alert.updateMany({
          where: { incidentId, status: { not: 'RESOLVED' } },
          data: { status: 'RESOLVED' },
        });
      }
      return tx.incident.update({
        where: { id: incidentId },
        data: { status, resolvedAt: resolved ? new Date() : null },
      });
    });
  }
}
