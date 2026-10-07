import {
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServerDto } from './dto/create-server.dto';
import { IngestMetricDto } from './dto/ingest-metric.dto';
import * as crypto from 'crypto';
import { IngestLogEventDto } from './dto/ingest-log-event.dto';
import { EventsService } from '../events/events.service';

// Everything the dashboard needs about a server — deliberately without apiKey.
// The key is shown exactly once, in the response that creates (or regenerates) it.
const SERVER_PUBLIC_FIELDS = {
  id: true,
  name: true,
  hostname: true,
  status: true,
  lastHeartbeat: true,
  createdAt: true,
} as const;

const newApiKey = () => `isk_${crypto.randomBytes(24).toString('hex')}`;

@Injectable()
export class ServersService {
  // Agent health (as in Wazuh): a server that has not reported for this long is
  // shown OFFLINE until its agent sends data again (ingestMetric sets ONLINE).
  private readonly offlineAfterSeconds = Number(
    process.env.SERVER_OFFLINE_AFTER_SECONDS ?? 60,
  );

  constructor(
    private prisma: PrismaService,
    private eventsService: EventsService,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async markSilentServersOffline(): Promise<number> {
    const cutoff = new Date(Date.now() - this.offlineAfterSeconds * 1000);
    const { count } = await this.prisma.server.updateMany({
      where: { status: 'ONLINE', lastHeartbeat: { lt: cutoff } },
      data: { status: 'OFFLINE' },
    });
    return count;
  }

  async createServer(organizationId: string, dto: CreateServerDto) {
    const apiKey = newApiKey();

    return this.prisma.server.create({
      data: {
        name: dto.name,
        hostname: dto.hostname,
        apiKey,
        organizationId,
      },
    });
  }

  async ingestMetric(serverId: string, dto: IngestMetricDto) {
    await this.prisma.server.update({
      where: { id: serverId },
      data: { status: 'ONLINE', lastHeartbeat: new Date() },
    });

    return this.prisma.metric.create({
      data: {
        serverId,
        cpuUsage: dto.cpuUsage,
        memUsage: dto.memUsage,
        diskUsage: dto.diskUsage,
        networkIn: dto.networkIn,
        networkOut: dto.networkOut,
        diskReadRate: dto.diskReadRate,
        diskWriteRate: dto.diskWriteRate,
        processCount: dto.processCount,
        loadAverage: dto.loadAverage,
      },
    });
  }

  async ingestLogEvent(
    serverId: string,
    organizationId: string,
    dto: IngestLogEventDto,
  ) {
    return this.eventsService.record({
      eventType: dto.eventType,
      source: 'ssh-log-agent',
      severity: dto.outcome === 'FAILURE' ? 'WARNING' : 'INFO',
      message: dto.command
        ? `${dto.eventType} (${dto.outcome}) by "${dto.username}": ${dto.command}`
        : `SSH ${dto.outcome} for user "${dto.username}" from ${dto.ipAddress}`,
      metadata: {
        username: dto.username,
        ipAddress: dto.ipAddress,
        serverId,
        outcome: dto.outcome,
        ...(dto.command && { command: dto.command }),
      },
      organizationId,
    });
  }

  async listServers(organizationId: string) {
    return this.prisma.server.findMany({
      where: { organizationId },
      select: SERVER_PUBLIC_FIELDS,
      // A stable order, so rows don't jump around after an edit.
      orderBy: { createdAt: 'asc' },
    });
  }

  async getServerMetrics(organizationId: string, serverId: string, limit = 50) {
    const server = await this.prisma.server.findFirst({
      where: { id: serverId, organizationId },
      select: SERVER_PUBLIC_FIELDS,
    });
    if (!server) throw new NotFoundException('Server not found');

    const metrics = await this.prisma.metric.findMany({
      where: { serverId },
      orderBy: { timestamp: 'desc' },
      take: limit,
    });

    return { server, metrics: metrics.reverse() };
  }

  async findByApiKey(apiKey: string) {
    const server = await this.prisma.server.findUnique({
      where: { apiKey },
    });

    if (!server) {
      throw new UnauthorizedException('Invalid API key');
    }

    return server;
  }

  async updateServer(organizationId: string, serverId: string, name: string) {
    const server = await this.prisma.server.findFirst({
      where: { id: serverId, organizationId },
    });
    if (!server) throw new NotFoundException('Server not found');

    return this.prisma.server.update({
      where: { id: serverId },
      data: { name },
      select: SERVER_PUBLIC_FIELDS,
    });
  }

  async deleteServer(organizationId: string, serverId: string) {
    const server = await this.prisma.server.findFirst({
      where: { id: serverId, organizationId },
    });
    if (!server) throw new NotFoundException('Server not found');

    // Its metrics go with it, but its alerts stay (unlinked) so incidents
    // keep their history, as with deleted rules.
    await this.prisma.$transaction([
      this.prisma.metric.deleteMany({ where: { serverId } }),
      this.prisma.alert.updateMany({
        where: { serverId },
        data: { serverId: null },
      }),
      this.prisma.server.delete({ where: { id: serverId } }),
    ]);

    return { deleted: true, serverId };
  }

  // Replaces a (possibly leaked) agent key; the old key stops working at once.
  async regenerateApiKey(organizationId: string, serverId: string) {
    const server = await this.prisma.server.findFirst({
      where: { id: serverId, organizationId },
    });
    if (!server) throw new NotFoundException('Server not found');

    return this.prisma.server.update({
      where: { id: serverId },
      data: { apiKey: newApiKey() },
      select: { id: true, apiKey: true },
    });
  }
}
