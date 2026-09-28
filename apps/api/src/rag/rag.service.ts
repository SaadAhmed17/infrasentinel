import { Injectable, Logger } from '@nestjs/common';

export interface RagQueryResponse {
  answer: string;
  sources: {
    incidentId: string;
    title: string;
    severity: string;
    status: string;
    relevance: number;
  }[];
}

export interface RagReindexResponse {
  indexed: number;
}

@Injectable()
export class RagService {
  private readonly logger = new Logger(RagService.name);
  private readonly aiServiceUrl =
    process.env.AI_SERVICE_URL || 'http://localhost:8000';

  async query(
    organizationId: string,
    question: string,
  ): Promise<RagQueryResponse> {
    const response = await fetch(`${this.aiServiceUrl}/rag/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId, question }),
    });

    if (!response.ok) {
      this.logger.error(`RAG query failed with status ${response.status}`);
      throw new Error('Failed to process query');
    }

    return response.json() as Promise<RagQueryResponse>;
  }

  async reindex(organizationId: string): Promise<RagReindexResponse> {
    const response = await fetch(`${this.aiServiceUrl}/rag/reindex`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId }),
    });

    if (!response.ok) {
      this.logger.error(`RAG reindex failed with status ${response.status}`);
      throw new Error('Failed to reindex incidents');
    }

    return response.json() as Promise<RagReindexResponse>;
  }

  async indexIncident(
    incidentId: string,
    organizationId: string,
  ): Promise<void> {
    try {
      await fetch(`${this.aiServiceUrl}/rag/index-incident`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidentId, organizationId }),
      });
    } catch (err) {
      // Auto-indexing failure should never block incident creation itself —
      // worst case, the incident just isn't searchable until the next manual reindex.
      this.logger.error(`Failed to auto-index incident ${incidentId}: ${err}`);
    }
  }
}
