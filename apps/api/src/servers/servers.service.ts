import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServerDto } from './dto/create-server.dto';
import { IngestMetricDto } from './dto/ingest-metric.dto';
import * as crypto from 'crypto';
import { IngestLogEventDto } from './dto/ingest-log-event.dto';
import { EventsService } from '../events/events.service';

@Injectable()
export class ServersService {
  constructor(
    private prisma: PrismaService,
    private eventsService: EventsService,
  ) {}

  async createServer(organizationId: string, dto: CreateServerDto) {
    const apiKey = `isk_${crypto.randomBytes(24).toString('hex')}`;

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
    return await this.eventsService.record({
      eventType: dto.eventType,
      source: 'ssh-log-agent',
      severity: dto.outcome === 'FAILURE' ? 'WARNING' : 'INFO',
      message: `SSH ${dto.outcome} for user "${dto.username}" from ${dto.ipAddress}`,
      metadata: { username: dto.username, ipAddress: dto.ipAddress, serverId },
      organizationId,
    });
  }

  async listServers(organizationId: string) {
    return this.prisma.server.findMany({
      where: { organizationId },
      select: {
        id: true,
        name: true,
        hostname: true,
        status: true,
        lastHeartbeat: true,
        createdAt: true,
      },
    });
  }

  async getServerMetrics(organizationId: string, serverId: string, limit = 50) {
    const server = await this.prisma.server.findFirst({
      where: { id: serverId, organizationId },
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
      throw new NotFoundException('Invalid API key');
    }

    return server;
  }
}
