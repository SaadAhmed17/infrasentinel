import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventSeverity, Prisma } from '@prisma/client';

interface RecordEventInput {
  eventType: string;
  source: string;
  severity?: EventSeverity;
  message: string;
  metadata: Record<string, unknown>;
  organizationId?: string;
}

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async record(input: RecordEventInput) {
    return this.prisma.event.create({
      data: {
        eventType: input.eventType,
        source: input.source,
        severity: input.severity ?? 'INFO',
        message: input.message,
        metadata: input.metadata as Prisma.InputJsonValue,
        organizationId: input.organizationId,
      },
    });
  }
}
