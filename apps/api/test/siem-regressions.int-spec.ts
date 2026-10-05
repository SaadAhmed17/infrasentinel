import { Prisma, Rule } from '@prisma/client';
import { AnomalyService } from '../src/anomaly/anomaly.service';
import { RuleEngineService } from '../src/rules/rule-engine.service';
import {
  createRule,
  createServer,
  createTenant,
  resetDatabase,
  Tenant,
} from './helpers/factory';
import { createTestApp, request, TestApp } from './helpers/test-app';

// Regression tests for the SIEM fixes of October 2026 (REG-xxx): duration of
// metric rules, no duplicate event alerts after resolving, SSH/sudo alerts linked
// to their server, correlation into open incidents, engine robustness, rule
// validation and rule deletion keeping the alert history.
const REAL_TIMERS = [
  'hrtime',
  'nextTick',
  'performance',
  'queueMicrotask',
  'setImmediate',
  'clearImmediate',
  'setInterval',
  'clearInterval',
  'setTimeout',
  'clearTimeout',
] as const;

let NOW = new Date('2026-09-01T12:00:00.000Z');
const freezeClockAt = (iso: string) => {
  NOW = new Date(iso);
  jest.useFakeTimers({ now: NOW, doNotFake: [...REAL_TIMERS] });
};
const ago = (seconds: number) => new Date(NOW.getTime() - seconds * 1000);

describe('SIEM regression tests (REG)', () => {
  let t: TestApp;
  let engine: RuleEngineService;
  const anomaly = { getAnomalyScore: jest.fn() };
  let A: Tenant;
  let B: Tenant;

  beforeAll(async () => {
    t = await createTestApp((b) =>
      b.overrideProvider(AnomalyService).useValue(anomaly),
    );
    engine = t.app.get(RuleEngineService);
  });
  afterAll(() => t.close());

  beforeEach(async () => {
    jest.useRealTimers();
    await resetDatabase(t.prisma);
    anomaly.getAnomalyScore.mockReset();
    A = await createTenant(t.prisma, 'Alpha');
    B = await createTenant(t.prisma, 'Bravo');
    freezeClockAt('2026-09-01T12:00:00.000Z');
  });
  afterEach(() => jest.useRealTimers());

  const alertsOf = (rule: Rule) =>
    t.prisma.alert.findMany({ where: { ruleId: rule.id } });
  const seedCpu = (serverId: string, secondsAgo: number[], cpu = 95) =>
    t.prisma.metric.createMany({
      data: secondsAgo.map((s) => ({
        serverId,
        cpuUsage: cpu,
        memUsage: 40,
        diskUsage: 40,
        timestamp: ago(s),
      })),
    });
  const seedEvents = (
    organizationId: string,
    eventType: string,
    items: { secondsAgo: number; metadata: Prisma.InputJsonObject }[],
  ) =>
    t.prisma.event.createMany({
      data: items.map((i) => ({
        eventType,
        source: 'test',
        message: eventType,
        organizationId,
        metadata: i.metadata,
        createdAt: ago(i.secondsAgo),
      })),
    });
  const resolveAllIncidents = async () => {
    for (const incident of await t.prisma.incident.findMany()) {
      const res = await request(
        t.app,
        'PATCH',
        `/incidents/${incident.id}/status`,
        { token: A.tokens.OWNER, body: { status: 'RESOLVED' } },
      );
      expect(res.status).toBe(200);
    }
  };

  describe('DEF-15 metric duration is really sustained', () => {
    let rule: Rule;
    beforeEach(async () => {
      rule = await createRule(t.prisma, A.org.id); // CPU > 80 for 60 s
    });

    it.each([
      [45, 1],
      [44, 0],
      [20, 0],
    ])(
      'REG-001 breaching readings every 10 s since %is ago → %i alert(s)',
      async (oldest, expected) => {
        const readings: number[] = [];
        for (let s = oldest; s > 0; s -= 10) readings.push(s);
        await seedCpu(A.server.id, readings);

        await engine.evaluateRules();

        await expect(alertsOf(rule)).resolves.toHaveLength(expected);
      },
    );

    it('REG-002 the first reading after a long silence is not a sustained breach', async () => {
      await seedCpu(A.server.id, [3600], 20); // last normal reading an hour ago
      await seedCpu(A.server.id, [2]); // server comes back hot

      await engine.evaluateRules();

      await expect(alertsOf(rule)).resolves.toHaveLength(0);
    });
  });

  describe('no duplicate alert from the same events after resolving', () => {
    it('REG-010 brute force: resolved incident + the same 5 events → still 1 alert; 5 new events → a 2nd alert', async () => {
      const rule = await createRule(t.prisma, A.org.id, {
        ruleType: 'EVENT_FREQUENCY',
        metricField: null,
        operator: null,
        threshold: null,
        eventType: 'AUTH_LOGIN_FAILURE',
        groupByField: 'ipAddress',
        maxCount: 5,
        windowSeconds: 300,
      });
      const burst = (from: number) =>
        seedEvents(
          A.org.id,
          'AUTH_LOGIN_FAILURE',
          [0, 1, 2, 3, 4].map((i) => ({
            secondsAgo: from - i,
            metadata: { ipAddress: '203.0.113.7' },
          })),
        );
      await burst(60);
      await engine.evaluateRules();
      await engine.correlateAlertsIntoIncidents();
      await resolveAllIncidents();

      await engine.evaluateRules(); // same events, still inside the 300 s window
      await expect(alertsOf(rule)).resolves.toHaveLength(1);

      await burst(10); // a new burst from the same IP
      await engine.evaluateRules();
      const alerts = await alertsOf(rule);
      expect(alerts).toHaveLength(2);
      expect(alerts.map((a) => (a.details as { count: number }).count)).toEqual(
        [5, 5],
      );
    });

    it('REG-011 credential stuffing: resolved + same success → 1 alert; a later new success → 2', async () => {
      const rule = await createRule(t.prisma, A.org.id, {
        ruleType: 'CREDENTIAL_STUFFING',
        metricField: null,
        operator: null,
        threshold: null,
        maxCount: 3,
        windowSeconds: 600,
      });
      const attempt = (outcome: string, ip: string, secondsAgo: number) =>
        seedEvents(A.org.id, `AUTH_LOGIN_${outcome}`, [
          {
            secondsAgo,
            metadata: { email: 'victim@example.com', ipAddress: ip },
          },
        ]);
      await attempt('FAILURE', '198.51.100.1', 100);
      await attempt('FAILURE', '198.51.100.2', 90);
      await attempt('FAILURE', '198.51.100.3', 80);
      await attempt('SUCCESS', '198.51.100.4', 70);
      await engine.evaluateRules();
      await engine.correlateAlertsIntoIncidents();
      await resolveAllIncidents();

      await engine.evaluateRules();
      await expect(alertsOf(rule)).resolves.toHaveLength(1);

      await attempt('SUCCESS', '198.51.100.5', 10); // the attacker logs in again
      await engine.evaluateRules();
      await expect(alertsOf(rule)).resolves.toHaveLength(2);
    });
  });

  describe('SSH alerts are linked to their server', () => {
    let rule: Rule;
    beforeEach(async () => {
      rule = await createRule(t.prisma, A.org.id, {
        ruleType: 'EVENT_FREQUENCY',
        metricField: null,
        operator: null,
        threshold: null,
        eventType: 'SSH_LOGIN_FAILURE',
        groupByField: 'ipAddress',
        maxCount: 3,
        windowSeconds: 300,
      });
    });
    const ssh = (serverIds: string[]) =>
      seedEvents(
        A.org.id,
        'SSH_LOGIN_FAILURE',
        serverIds.map((serverId, i) => ({
          secondsAgo: 10 + i,
          metadata: { ipAddress: '198.51.100.9', username: 'root', serverId },
        })),
      );

    it('REG-020 all events from one server → alert linked to that server', async () => {
      await ssh([A.server.id, A.server.id, A.server.id]);
      await engine.evaluateRules();
      const [alert] = await alertsOf(rule);
      expect(alert.serverId).toBe(A.server.id);
    });

    it('REG-021 events from two servers → alert without a server', async () => {
      const second = await createServer(t.prisma, A.org.id);
      await ssh([A.server.id, second.id, A.server.id]);
      await engine.evaluateRules();
      const [alert] = await alertsOf(rule);
      expect(alert.serverId).toBeNull();
    });

    it('REG-022 a server id of another organization is never linked', async () => {
      await ssh([B.server.id, B.server.id, B.server.id]);
      await engine.evaluateRules();
      const [alert] = await alertsOf(rule);
      expect(alert.serverId).toBeNull();
    });
  });

  describe('correlation', () => {
    const alertOn = (
      rule: Rule,
      serverId: string | null,
      details: Prisma.InputJsonObject = {},
      createdAt?: Date,
    ) =>
      t.prisma.alert.create({
        data: {
          ruleId: rule.id,
          serverId,
          details,
          ...(createdAt && { createdAt }),
        },
      });

    it('REG-030 two different attacker IPs (no server) → two incidents; same IP from two rules → joined', async () => {
      jest.useRealTimers();
      const brute = await createRule(t.prisma, A.org.id, { name: 'web brute' });
      const ssh = await createRule(t.prisma, A.org.id, { name: 'ssh brute' });
      await alertOn(brute, null, { groupValue: '203.0.113.7' });
      await alertOn(brute, null, { groupValue: '203.0.113.8' });
      await alertOn(ssh, null, { groupValue: '203.0.113.7' });

      await engine.correlateAlertsIntoIncidents();

      const incidents = await t.prisma.incident.findMany({
        include: { alerts: true },
      });
      expect(incidents.map((i) => i.alerts.length).sort()).toEqual([1, 2]);
    });

    it('REG-031 brute force (IP) and credential stuffing (account) are separate incidents', async () => {
      jest.useRealTimers();
      const brute = await createRule(t.prisma, A.org.id);
      const stuffing = await createRule(t.prisma, A.org.id);
      await alertOn(brute, null, { groupValue: '203.0.113.7' });
      await alertOn(stuffing, null, { email: 'victim@example.com' });

      await engine.correlateAlertsIntoIncidents();

      await expect(t.prisma.incident.count()).resolves.toBe(2);
    });

    it('REG-032 joining raises the severity and updates the title', async () => {
      jest.useRealTimers();
      const medium = await createRule(t.prisma, A.org.id, {
        name: 'cpu',
        severity: 'MEDIUM',
      });
      const critical = await createRule(t.prisma, A.org.id, {
        name: 'disk',
        severity: 'CRITICAL',
      });
      await alertOn(medium, A.server.id);
      await engine.correlateAlertsIntoIncidents();
      await alertOn(critical, A.server.id);
      await engine.correlateAlertsIntoIncidents();

      const incidents = await t.prisma.incident.findMany({
        include: { alerts: true },
      });
      expect(incidents).toHaveLength(1);
      expect(incidents[0]).toMatchObject({
        severity: 'CRITICAL',
        title: 'cpu + 1 more alert(s)',
      });
      expect(incidents[0].alerts).toHaveLength(2);
    });

    it('REG-033 an open incident whose last alert is older than 5 minutes is not joined', async () => {
      jest.useRealTimers();
      const rule = await createRule(t.prisma, A.org.id);
      await alertOn(rule, A.server.id, {}, new Date(Date.now() - 10 * 60_000));
      await engine.correlateAlertsIntoIncidents();
      await alertOn(rule, A.server.id);
      await engine.correlateAlertsIntoIncidents();

      await expect(t.prisma.incident.count()).resolves.toBe(2);
    });

    it('REG-034 a resolved incident is never reopened', async () => {
      jest.useRealTimers();
      const rule = await createRule(t.prisma, A.org.id);
      await alertOn(rule, A.server.id);
      await engine.correlateAlertsIntoIncidents();
      await resolveAllIncidents();
      await alertOn(rule, A.server.id);
      await engine.correlateAlertsIntoIncidents();

      const incidents = await t.prisma.incident.findMany({
        orderBy: { createdAt: 'asc' },
      });
      expect(incidents.map((i) => i.status)).toEqual(['RESOLVED', 'OPEN']);
    });

    it('REG-035 an INVESTIGATING incident is still joined', async () => {
      jest.useRealTimers();
      const rule = await createRule(t.prisma, A.org.id);
      await alertOn(rule, A.server.id);
      await engine.correlateAlertsIntoIncidents();
      await t.prisma.incident.updateMany({ data: { status: 'INVESTIGATING' } });
      await alertOn(rule, A.server.id);
      await engine.correlateAlertsIntoIncidents();

      await expect(t.prisma.incident.count()).resolves.toBe(1);
    });

    it('REG-036 never joins across organizations', async () => {
      jest.useRealTimers();
      const aRule = await createRule(t.prisma, A.org.id);
      const bRule = await createRule(t.prisma, B.org.id);
      await alertOn(aRule, null, { groupValue: '203.0.113.7' });
      await engine.correlateAlertsIntoIncidents();
      await alertOn(bRule, null, { groupValue: '203.0.113.7' });
      await engine.correlateAlertsIntoIncidents();

      const incidents = await t.prisma.incident.findMany();
      expect(incidents.map((i) => i.organizationId).sort()).toEqual(
        [A.org.id, B.org.id].sort(),
      );
    });
  });

  describe('engine robustness', () => {
    it('REG-040 one failing rule does not stop the others', async () => {
      const first = await createRule(t.prisma, A.org.id, {
        ruleType: 'ANOMALY_DETECTION',
        metricField: null,
        operator: null,
        threshold: null,
      });
      const second = await createRule(t.prisma, A.org.id, {
        ruleType: 'ANOMALY_DETECTION',
        metricField: null,
        operator: null,
        threshold: null,
      });
      anomaly.getAnomalyScore
        .mockRejectedValueOnce(new Error('boom'))
        .mockResolvedValue({
          isAnomaly: true,
          reconstructionError: 1,
          threshold: 0.1,
        });

      await expect(engine.evaluateRules()).resolves.toBeUndefined();

      const alerts = [...(await alertsOf(first)), ...(await alertsOf(second))];
      expect(alerts).toHaveLength(1);
    });

    it('REG-041 two overlapping ticks raise an ongoing breach only once', async () => {
      const rule = await createRule(t.prisma, A.org.id);
      await seedCpu(A.server.id, [50, 40, 30, 20, 10]);

      await Promise.all([engine.evaluateRules(), engine.evaluateRules()]);

      await expect(alertsOf(rule)).resolves.toHaveLength(1);
    });
  });

  describe('rules that could never fire are rejected', () => {
    const post = (body: Record<string, unknown>) =>
      request<{ message: string | string[] }>(t.app, 'POST', '/rules', {
        token: A.tokens.SECURITY_ANALYST,
        body: { name: 'r', severity: 'HIGH', ...body },
      });

    it.each([
      [
        'EVENT_FREQUENCY without an event type',
        {
          ruleType: 'EVENT_FREQUENCY',
          groupByField: 'ipAddress',
          maxCount: 5,
          windowSeconds: 60,
        },
        /eventType/,
      ],
      [
        'a misspelled event type',
        {
          ruleType: 'EVENT_FREQUENCY',
          eventType: 'AUTH_LOGIN_FAILED',
          groupByField: 'ipAddress',
          maxCount: 5,
          windowSeconds: 60,
        },
        /eventType/,
      ],
      [
        'an unknown group-by field',
        {
          ruleType: 'EVENT_FREQUENCY',
          eventType: 'AUTH_LOGIN_FAILURE',
          groupByField: 'ip',
          maxCount: 5,
          windowSeconds: 60,
        },
        /groupByField/,
      ],
      [
        'METRIC_THRESHOLD without a threshold',
        {
          ruleType: 'METRIC_THRESHOLD',
          metricField: 'CPU_USAGE',
          operator: 'GREATER_THAN',
        },
        /threshold/,
      ],
      [
        'CREDENTIAL_STUFFING without a window',
        { ruleType: 'CREDENTIAL_STUFFING', maxCount: 3 },
        /windowSeconds/,
      ],
      [
        'a duration of 0',
        { ruleType: 'HEARTBEAT_MISSING', durationSeconds: 0 },
        /durationSeconds/,
      ],
      ['an empty name', { ruleType: 'HEARTBEAT_MISSING', name: '' }, /name/],
    ])('REG-050 %s → 400 naming the problem', async (_, body, field) => {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(JSON.stringify(res.body.message)).toMatch(field);
    });

    it('REG-051 a complete SSH brute-force rule is accepted', async () => {
      const res = await post({
        ruleType: 'EVENT_FREQUENCY',
        eventType: 'SSH_LOGIN_FAILURE',
        groupByField: 'ipAddress',
        maxCount: 5,
        windowSeconds: 60,
      });
      expect(res.status).toBe(201);
    });

    it('REG-052 an update that would leave the rule incomplete → 400; a rename → 200', async () => {
      const rule = await createRule(t.prisma, A.org.id); // complete METRIC rule
      const patch = (body: Record<string, unknown>) =>
        request(t.app, 'PATCH', `/rules/${rule.id}`, {
          token: A.tokens.SECURITY_ANALYST,
          body,
        });

      expect((await patch({ ruleType: 'EVENT_FREQUENCY' })).status).toBe(400);
      expect((await patch({ name: 'renamed' })).status).toBe(200);
    });

    it('REG-053 toggle requires a boolean (400) and the positive case still works', async () => {
      const rule = await createRule(t.prisma, A.org.id);
      const toggle = (isActive: unknown) =>
        request<{ isActive: boolean }>(
          t.app,
          'PATCH',
          `/rules/${rule.id}/toggle`,
          { token: A.tokens.OWNER, body: { isActive } },
        );

      expect((await toggle('yes')).status).toBe(400);
      const ok = await toggle(false);
      expect(ok.status).toBe(200);
      expect(ok.body.isActive).toBe(false);
    });

    it.each([
      ['only a start hour', { businessHourStartUTC: 9 }],
      [
        'start not before end',
        { businessHourStartUTC: 18, businessHourEndUTC: 9 },
      ],
      ['neither approved users nor hours', {}],
      ['an empty approved-user list and no hours', { approvedUsernames: '  ' }],
    ])('REG-054 UNUSUAL_ACCESS with %s → 400', async (_, body) => {
      const res = await post({ ruleType: 'UNUSUAL_ACCESS', ...body });
      expect(res.status).toBe(400);
    });

    it('REG-055 UNUSUAL_ACCESS with approved users only (any time) is accepted', async () => {
      const res = await post({
        ruleType: 'UNUSUAL_ACCESS',
        approvedUsernames: 'saad,hashim',
      });
      expect(res.status).toBe(201);
    });
  });

  describe('deleting a rule keeps its history', () => {
    it('REG-060 the rule disappears, its alert and incident stay, and it never fires again', async () => {
      jest.useRealTimers();
      const rule = await createRule(t.prisma, A.org.id, { name: 'cpu watch' });
      await t.prisma.alert.create({
        data: { ruleId: rule.id, serverId: A.server.id, details: {} },
      });
      await engine.correlateAlertsIntoIncidents();

      const del = await request(t.app, 'DELETE', `/rules/${rule.id}`, {
        token: A.tokens.OWNER,
      });
      expect(del.status).toBe(200);

      const rules = await request<{ id: string }[]>(t.app, 'GET', '/rules', {
        token: A.tokens.OWNER,
      });
      expect(rules.body.map((r) => r.id)).not.toContain(rule.id);

      const incidents = await request<
        { alerts: { rule: { name: string } }[] }[]
      >(t.app, 'GET', '/incidents', {
        token: A.tokens.OWNER,
      });
      expect(incidents.body).toHaveLength(1);
      expect(incidents.body[0].alerts[0].rule.name).toBe('cpu watch');

      for (const [method, path, body] of [
        ['PATCH', `/rules/${rule.id}/toggle`, { isActive: true }],
        ['PATCH', `/rules/${rule.id}`, { name: 'x' }],
        ['DELETE', `/rules/${rule.id}`, undefined],
      ] as const) {
        const res = await request(t.app, method, path, {
          token: A.tokens.OWNER,
          body,
        });
        expect([method, path, res.status]).toEqual([method, path, 404]);
      }

      await t.prisma.metric.createMany({
        data: [55, 45, 35, 25, 15, 5].map((s) => ({
          serverId: A.server.id,
          cpuUsage: 99,
          memUsage: 40,
          diskUsage: 40,
          timestamp: new Date(Date.now() - s * 1000),
        })),
      });
      await engine.evaluateRules();
      await expect(alertsOf(rule)).resolves.toHaveLength(1);
    });
  });

  describe('sudo events from agents', () => {
    it('REG-070 an agent can report a sudo command; an unapproved user raises an alert on that server', async () => {
      jest.useRealTimers();
      const rule = await createRule(t.prisma, A.org.id, {
        ruleType: 'UNUSUAL_ACCESS',
        metricField: null,
        operator: null,
        threshold: null,
        approvedUsernames: 'saad',
      });

      const res = await request(t.app, 'POST', '/agent/log-event', {
        apiKey: A.server.apiKey,
        body: {
          eventType: 'SUDO_COMMAND',
          outcome: 'SUCCESS',
          username: 'mallory',
          ipAddress: 'local',
          command: '/bin/cat /etc/shadow',
        },
      });
      expect(res.status).toBe(201);

      const event = await t.prisma.event.findFirstOrThrow({
        where: { eventType: 'SUDO_COMMAND' },
      });
      expect(event.metadata).toMatchObject({
        username: 'mallory',
        command: '/bin/cat /etc/shadow',
        serverId: A.server.id,
      });

      await engine.evaluateRules();
      const [alert] = await alertsOf(rule);
      expect(alert).toMatchObject({
        serverId: A.server.id,
        details: {
          username: 'mallory',
          reason: 'unapproved_user',
          command: '/bin/cat /etc/shadow',
        },
      });
    });
  });
});
