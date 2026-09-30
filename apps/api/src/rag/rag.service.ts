import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';

// Generous for LLM answers and bulk re-embedding, short for background indexing.
const QUERY_TIMEOUT_MS = 30_000;
const REINDEX_TIMEOUT_MS = 120_000;
const INDEX_TIMEOUT_MS = 10_000;

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
    let response: Response;
    try {
      response = await fetch(`${this.aiServiceUrl}/rag/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId, question }),
        signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
      });
    } catch (err) {
      this.logger.error(`RAG query could not reach the AI service: ${err}`);
      throw new ServiceUnavailableException(
        'Failed to process query: the AI assistant is temporarily unavailable',
      );
    }

    if (!response.ok) {
      this.logger.error(`RAG query failed with status ${response.status}`);
      throw new ServiceUnavailableException(
        'Failed to process query: the AI assistant is temporarily unavailable',
      );
    }

    return response.json() as Promise<RagQueryResponse>;
  }

  async reindex(organizationId: string): Promise<RagReindexResponse> {
    const response = await fetch(`${this.aiServiceUrl}/rag/reindex`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ organizationId }),
      signal: AbortSignal.timeout(REINDEX_TIMEOUT_MS),
    });

    if (!response.ok) {
      this.logger.error(`RAG reindex failed with status ${response.status}`);
      throw new ServiceUnavailableException('Failed to reindex incidents');
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
        signal: AbortSignal.timeout(INDEX_TIMEOUT_MS),
      });
    } catch (err) {
      // Auto-indexing failure should never block incident creation itself —
      // worst case, the incident just isn't searchable until the next manual reindex.
      this.logger.error(`Failed to auto-index incident ${incidentId}: ${err}`);
    }
  }
}
