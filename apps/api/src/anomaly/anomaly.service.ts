import { Injectable, Logger } from '@nestjs/common';

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

  async getAnomalyScore(
    serverId: string,
  ): Promise<AnomalyScoreResponse | null> {
    try {
      const response = await fetch(
        `${this.aiServiceUrl}/anomaly-score/${serverId}`,
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
