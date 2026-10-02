import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { aiServiceAuthHeaders } from '../common/ai-service-auth';

export interface AnomalyScoreResponse {
  serverId: string;
  reconstructionError: number;
  threshold: number;
  isAnomaly: boolean;
  windowSize: number;
  error?: string;
}

@Injectable()
export class AnomalyService {
  private readonly logger = new Logger(AnomalyService.name);
  private readonly aiServiceUrl =
    process.env.AI_SERVICE_URL || 'http://localhost:8000';

  constructor(private prisma: PrismaService) {}

  // For dashboard requests: only servers that belong to the caller's organization.
  async getAnomalyScoreForOrganization(
    organizationId: string,
    serverId: string,
  ): Promise<AnomalyScoreResponse | null> {
    const server = await this.prisma.server.findFirst({
      where: { id: serverId, organizationId },
      select: { id: true },
    });
    if (!server) throw new NotFoundException('Server not found');
    return this.getAnomalyScore(serverId);
  }

  async getAnomalyScore(
    serverId: string,
  ): Promise<AnomalyScoreResponse | null> {
    try {
      const response = await fetch(
        `${this.aiServiceUrl}/anomaly-score/${serverId}`,
        { headers: aiServiceAuthHeaders() },
      );
      if (!response.ok) {
        this.logger.warn(
          `AI service returned ${response.status} for server ${serverId}`,
        );
        return null;
      }
      const data = (await response.json()) as AnomalyScoreResponse;
      if (data.error) {
        this.logger.debug(
          `No anomaly score available for ${serverId}: ${data.error}`,
        );
        return null;
      }
      return data;
    } catch (err) {
      this.logger.error(
        `Failed to reach AI service for server ${serverId}: ${err}`,
      );
      return null;
    }
  }
}
