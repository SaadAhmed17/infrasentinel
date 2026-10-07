import { Test, TestingModule } from '@nestjs/testing';
import { RuleEngineService } from './rule-engine.service';
import { PrismaService } from '../prisma/prisma.service';
import { AnomalyService } from '../anomaly/anomaly.service';
import { RagService } from '../rag/rag.service';

describe('RuleEngineService', () => {
  let service: RuleEngineService;
  let prisma: {
    rule: { findMany: jest.Mock };
    server: { findMany: jest.Mock };
    alert: { findFirst: jest.Mock; create: jest.Mock };
    metric: { findMany: jest.Mock };
    event: { findMany: jest.Mock };
    incident: { create: jest.Mock };
  };

  // CPU readings every 10 s covering the whole 60 s window, all breaching,
  // so the breach counts as sustained for the rule's duration.
  const sustainedBreach = () =>
    [55, 45, 35, 25, 15, 5].map((secondsAgo) => ({
      cpuUsage: 95,
      memUsage: 50,
      diskUsage: 50,
      timestamp: new Date(Date.now() - secondsAgo * 1000),
    }));

  const cpuRule = {
    id: 'rule-1',
    organizationId: 'org-1',
    metricField: 'CPU_USAGE',
    operator: 'GREATER_THAN',
    threshold: 80,
    durationSeconds: 60,
    severity: 'HIGH',
  };

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
        { provide: RagService, useValue: { indexIncident: jest.fn() } },
      ],
    }).compile();

    service = module.get<RuleEngineService>(RuleEngineService);
  });

  it('does nothing when no active rules exist', async () => {
    await service.evaluateRules();
    expect(prisma.alert.create).not.toHaveBeenCalled();
  });

  // Positive control for the de-duplication test below: without it, that test
  // would still pass if the engine never created any alert at all.
  it('creates an alert when every reading breaches and none is already OPEN', async () => {
    prisma.rule.findMany.mockResolvedValueOnce([cpuRule]);
    prisma.server.findMany.mockResolvedValue([
      { id: 'server-1', name: 'Test Server', organizationId: 'org-1' },
    ]);
    prisma.metric.findMany.mockResolvedValue(sustainedBreach());
    prisma.alert.findFirst.mockResolvedValue(null);

    await service.evaluateRules();

    expect(prisma.alert.create).toHaveBeenCalledTimes(1);
    const [[createArgs]] = prisma.alert.create.mock.calls as [[unknown]];
    expect(createArgs).toMatchObject({
      data: { ruleId: 'rule-1', serverId: 'server-1', status: 'OPEN' },
    });
  });

  it('does not create a duplicate alert if one is already OPEN for the same rule and server', async () => {
    prisma.rule.findMany.mockResolvedValueOnce([cpuRule]);
    prisma.server.findMany.mockResolvedValue([
      { id: 'server-1', name: 'Test Server', organizationId: 'org-1' },
    ]);
    prisma.metric.findMany.mockResolvedValue(sustainedBreach());
    prisma.alert.findFirst.mockResolvedValue({ id: 'existing-alert' }); // simulate an alert already OPEN

    await service.evaluateRules();

    expect(prisma.alert.create).not.toHaveBeenCalled();
  });
});
