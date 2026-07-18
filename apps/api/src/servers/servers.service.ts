import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServerDto } from './dto/create-server.dto';
import * as crypto from 'crypto';
import { IngestMetricDto } from './dto/ingest-metric.dto';
@Injectable()
export class ServersService {
  constructor(private prisma: PrismaService) {}

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
      },
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
        // deliberately NOT selecting apiKey — never re-expose it after creation
      },
    });
  }

  async findByApiKey(apiKey: string) {
    const server = await this.prisma.server.findUnique({ where: { apiKey } });
    if (!server) throw new NotFoundException('Invalid API key');
    return server;
  }
}
