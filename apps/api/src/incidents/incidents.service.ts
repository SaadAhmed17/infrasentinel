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
