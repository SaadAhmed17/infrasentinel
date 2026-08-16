import { Test, TestingModule } from '@nestjs/testing';
import { RuleEngineService } from './rule-engine.service';
import { PrismaService } from '../prisma/prisma.service';
import { AnomalyService } from '../anomaly/anomaly.service';
import { beforeEach, describe, it } from 'node:test';

describe('RuleEngineService', () => {
  let service: RuleEngineService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      rule: { findMany: jest.fn().mockResolvedValue([]) },
      server: { findMany: jest.fn().mockResolvedValue([]) },
      alert: { findFirst: jest.fn(), create: jest.fn() },
      metric: { findMany: jest.fn() },
      event: { findMany: jest.fn() },
      incident: { create: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RuleEngineService,
        { provide: PrismaService, useValue: prisma },
        { provide: AnomalyService, useValue: { getAnomalyScore: jest.fn() } },
      ],
    }).compile();

    service = module.get<RuleEngineService>(RuleEngineService);
  });

  it('does nothing when no active rules exist', async () => {
    await service.evaluateRules();
    expect(prisma.alert.create).not.toHaveBeenCalled();
  });

  it('does not create a duplicate alert if one is already OPEN for the same rule and server', async () => {
    prisma.rule.findMany.mockResolvedValueOnce([
      {
        id: 'rule-1',
        organizationId: 'org-1',
        metricField: 'CPU_USAGE',
        operator: 'GREATER_THAN',
        threshold: 80,
        durationSeconds: 60,
        severity: 'HIGH',
      },
    ]);
    prisma.server.findMany.mockResolvedValue([
      { id: 'server-1', name: 'Test Server', organizationId: 'org-1' },
    ]);
    prisma.metric.findMany.mockResolvedValue([
      { cpuUsage: 95, memUsage: 50, diskUsage: 50, timestamp: new Date() },
    ]);
    prisma.alert.findFirst.mockResolvedValue({ id: 'existing-alert' }); // simulate an alert already OPEN

    await service.evaluateRules();

    expect(prisma.alert.create).not.toHaveBeenCalled();
  });
});
