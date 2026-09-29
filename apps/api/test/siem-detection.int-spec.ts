import { Prisma, Rule } from '@prisma/client';
import { AnomalyService } from '../src/anomaly/anomaly.service';
import { RagService } from '../src/rag/rag.service';
import { RuleEngineService } from '../src/rules/rule-engine.service';
import {
  createRule,
  createServer,
  createTenant,
  resetDatabase,
  Tenant,
} from './helpers/factory';
import { knownDefect } from './helpers/known-defect';
import { createTestApp, request, TestApp } from './helpers/test-app';

// Detection scenario tests, in the style of Prometheus `promtool test rules`:
// given a timeline of metrics/events, assert exactly which alerts fire.
//
// Only `Date` is faked: the rule engine computes its windows from Date.now(),
// so freezing the clock makes windows and boundaries exact and repeatable,
// while real timers keep database I/O working normally.
const REAL_TIMERS = [
  'hrtime',
  'nextTick',
  'performance',
  'queueMicrotask',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'requestIdleCallback',
  'cancelIdleCallback',
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

describe('SIEM detection engine (SIEM / INC)', () => {
  let t: TestApp;
  let engine: RuleEngineService;
  const anomaly = { getAnomalyScore: jest.fn() };
  const rag = {
    indexIncident: jest.fn(),
    query: jest.fn(),
    reindex: jest.fn(),
  };
  let A: Tenant;
  let B: Tenant;

  beforeAll(async () => {
    t = await createTestApp((builder) =>
      builder
        .overrideProvider(AnomalyService)
        .useValue(anomaly)
        .overrideProvider(RagService)
        .useValue(rag),
    );
    engine = t.app.get(RuleEngineService);
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    jest.useRealTimers();
    await resetDatabase(t.prisma);
    anomaly.getAnomalyScore.mockReset();
    rag.indexIncident.mockReset();
    A = await createTenant(t.prisma, 'Alpha');
    B = await createTenant(t.prisma, 'Bravo');
    freezeClockAt('2026-09-01T12:00:00.000Z');
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const seedMetrics = (
    serverId: string,
    readings: { secondsAgo: number; cpu: number }[],
  ) =>
    t.prisma.metric.createMany({
      data: readings.map((r) => ({
        serverId,
        cpuUsage: r.cpu,
        memUsage: 40,
        diskUsage: 40,
        timestamp: ago(r.secondsAgo),
      })),
    });
  const seedEvents = (
    organizationId: string | null,
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
  const alertsOf = (rule: Rule) =>
    t.prisma.alert.findMany({ where: { ruleId: rule.id } });
  const breachFor = (seconds: number[], cpu = 95) =>
    seconds.map((secondsAgo) => ({ secondsAgo, cpu }));

  describe('METRIC_THRESHOLD (CPU > 80 sustained for 60s)', () => {
    let rule: Rule;
    beforeEach(async () => {
      rule = await createRule(t.prisma, A.org.id);
    });

    it('SIEM-001 every reading in the window breaches → exactly one alert with evidence', async () => {
      await seedMetrics(A.server.id, breachFor([50, 40, 30, 20, 10]));

      await engine.evaluateRules();

      const alerts = await alertsOf(rule);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({
        serverId: A.server.id,
        status: 'OPEN',
        details: { value: 95, threshold: 80, metricField: 'CPU_USAGE' },
      });
    });

    it('SIEM-002 one reading back under the threshold → no alert (not sustained)', async () => {
      await seedMetrics(A.server.id, [
        ...breachFor([50, 40, 20, 10]),
        { secondsAgo: 30, cpu: 75 },
      ]);

      await engine.evaluateRules();

      await expect(alertsOf(rule)).resolves.toHaveLength(0);
    });

    it.each([
      [80, 0],
      [80.01, 1],
    ])(
      'SIEM-003 boundary: readings of exactly %d with "> 80" → %i alert(s)',
      async (cpu, expected) => {
        await seedMetrics(A.server.id, breachFor([40, 20], cpu));

        await engine.evaluateRules();

        await expect(alertsOf(rule)).resolves.toHaveLength(expected);
      },
    );

    it('SIEM-004 LESS_THAN operator (memory below 5%) fires symmetrically', async () => {
      const low = await createRule(t.prisma, A.org.id, {
        metricField: 'MEM_USAGE',
        operator: 'LESS_THAN',
        threshold: 5,
      });
      await t.prisma.metric.createMany({
        data: [30, 10].map((s) => ({
          serverId: A.server.id,
          cpuUsage: 10,
          memUsage: 3,
          diskUsage: 40,
          timestamp: ago(s),
        })),
      });

      await engine.evaluateRules();

      await expect(alertsOf(low)).resolves.toHaveLength(1);
    });

    it('SIEM-005 breaches older than the window are ignored (stale data)', async () => {
      await seedMetrics(A.server.id, [
        ...breachFor([300, 200, 120]),
        { secondsAgo: 30, cpu: 20 },
      ]);

      await engine.evaluateRules();

      await expect(alertsOf(rule)).resolves.toHaveLength(0);
    });

    it('SIEM-006 no data in the window → no alert, no crash', async () => {
      await engine.evaluateRules();

      await expect(alertsOf(rule)).resolves.toHaveLength(0);
    });

    it('SIEM-007 de-duplication: re-evaluating an ongoing breach adds no second alert', async () => {
      await seedMetrics(A.server.id, breachFor([40, 20]));

      await engine.evaluateRules();
      await engine.evaluateRules();
      await engine.evaluateRules();

      await expect(alertsOf(rule)).resolves.toHaveLength(1);
    });

    it('SIEM-008 a deactivated rule never fires', async () => {
      await t.prisma.rule.update({
        where: { id: rule.id },
        data: { isActive: false },
      });
      await seedMetrics(A.server.id, breachFor([40, 20]));

      await engine.evaluateRules();

      await expect(alertsOf(rule)).resolves.toHaveLength(0);
    });

    it('SIEM-009 a misconfigured rule (no metric field) is skipped safely', async () => {
      await t.prisma.rule.update({
        where: { id: rule.id },
        data: { metricField: null },
      });
      await seedMetrics(A.server.id, breachFor([40, 20]));

      await expect(engine.evaluateRules()).resolves.toBeUndefined();
      await expect(alertsOf(rule)).resolves.toHaveLength(0);
    });

    it('SIEM-010 tenant scope: Org A’s rule ignores Org B’s breaching server', async () => {
      await seedMetrics(B.server.id, breachFor([40, 20]));

      await engine.evaluateRules();

      await expect(alertsOf(rule)).resolves.toHaveLength(0);
    });

    knownDefect(
      'DEF-15',
      'SIEM-011 a breach observed for only 5s does not satisfy a 60s duration',
      async () => {
        await seedMetrics(A.server.id, breachFor([5]));

        await engine.evaluateRules();

        await expect(alertsOf(rule)).resolves.toHaveLength(0);
      },
    );

    knownDefect(
      'DEF-06',
      'SIEM-012 after the incident is resolved, a new breach raises a new alert',
      async () => {
        await seedMetrics(A.server.id, breachFor([40, 20]));
        await engine.evaluateRules();
        await engine.correlateAlertsIntoIncidents();
        const incident = await t.prisma.incident.findFirstOrThrow();
        const resolved = await request(
          t.app,
          'PATCH',
          `/incidents/${incident.id}/status`,
          {
            token: A.tokens.SECURITY_ANALYST,
            body: { status: 'RESOLVED' },
          },
        );
        expect(resolved.status).toBe(200);

        freezeClockAt('2026-09-02T12:00:00.000Z'); // the next day, a new breach
        await seedMetrics(A.server.id, breachFor([40, 20]));
        await engine.evaluateRules();

        await expect(alertsOf(rule)).resolves.toHaveLength(2);
      },
    );
  });

  describe('HEARTBEAT_MISSING (silent for more than 120s)', () => {
    let rule: Rule;
    const heartbeat = (secondsAgo: number | null) =>
      t.prisma.server.update({
        where: { id: A.server.id },
        data: { lastHeartbeat: secondsAgo === null ? null : ago(secondsAgo) },
      });

    beforeEach(async () => {
      rule = await createRule(t.prisma, A.org.id, {
        ruleType: 'HEARTBEAT_MISSING',
        metricField: null,
        operator: null,
        threshold: null,
        durationSeconds: 120,
      });
    });

    it.each([
      [60, 0],
      [120, 0],
      [121, 1],
      [300, 1],
    ])(
      'SIEM-020 last heartbeat %is ago → %i alert(s)',
      async (secondsAgo, expected) => {
        await heartbeat(secondsAgo);

        await engine.evaluateRules();

        await expect(alertsOf(rule)).resolves.toHaveLength(expected);
      },
    );

    it('SIEM-021 the alert records how long the server has been silent', async () => {
      await heartbeat(300);

      await engine.evaluateRules();

      const [alert] = await alertsOf(rule);
      expect(alert.details).toMatchObject({ secondsSinceLastHeartbeat: 300 });
    });

    it('SIEM-022 documented limitation: a server that never reported is not flagged', async () => {
      await heartbeat(null);

      await engine.evaluateRules();

      await expect(alertsOf(rule)).resolves.toHaveLength(0);
    });
  });

  describe('EVENT_FREQUENCY (≥5 failed logins per IP in 300s — brute force)', () => {
    let rule: Rule;
    const failures = (orgId: string | null, ip: string, secondsAgo: number[]) =>
      seedEvents(
        orgId,
        'AUTH_LOGIN_FAILURE',
        secondsAgo.map((s) => ({ secondsAgo: s, metadata: { ipAddress: ip } })),
      );

    beforeEach(async () => {
      rule = await createRule(t.prisma, A.org.id, {
        ruleType: 'EVENT_FREQUENCY',
        metricField: null,
        operator: null,
        threshold: null,
        eventType: 'AUTH_LOGIN_FAILURE',
        groupByField: 'ipAddress',
        maxCount: 5,
        windowSeconds: 300,
        severity: 'HIGH',
      });
    });

    it.each([
      [4, 0],
      [5, 1],
    ])(
      'SIEM-030 boundary: %i failures from one IP → %i alert(s)',
      async (count, expected) => {
        await failures(
          A.org.id,
          '203.0.113.7',
          [...Array(count).keys()].map((i) => 10 + i),
        );

        await engine.evaluateRules();

        const alerts = await alertsOf(rule);
        expect(alerts).toHaveLength(expected);
        if (expected) {
          expect(alerts[0].details).toMatchObject({
            groupValue: '203.0.113.7',
            count: 5,
          });
        }
      },
    );

    it('SIEM-031 window boundary: an event exactly 300s old counts, 301s does not', async () => {
      await failures(A.org.id, '203.0.113.7', [10, 20, 30, 300]);
      await failures(A.org.id, '203.0.113.8', [10, 20, 30, 40, 301]);

      await engine.evaluateRules();

      const alerts = await alertsOf(rule);
      expect(alerts).toHaveLength(0);
    });

    it('SIEM-032 attempts are counted per IP, not pooled across IPs', async () => {
      await failures(A.org.id, '203.0.113.7', [10, 20, 30]);
      await failures(A.org.id, '203.0.113.8', [10, 20, 30]);

      await engine.evaluateRules();

      await expect(alertsOf(rule)).resolves.toHaveLength(0);
    });

    it('SIEM-033 one alert per attacking IP; a second IP still alerts', async () => {
      await failures(A.org.id, '203.0.113.7', [10, 20, 30, 40, 50]);
      await engine.evaluateRules();
      await failures(A.org.id, '203.0.113.9', [11, 21, 31, 41, 51]);
      await engine.evaluateRules();

      const alerts = await alertsOf(rule);
      expect(
        alerts
          .map((a) => (a.details as { groupValue: string }).groupValue)
          .sort(),
      ).toEqual(['203.0.113.7', '203.0.113.9']);
    });

    it('SIEM-034 tenant scope: Org B’s login failures never trigger Org A’s rule', async () => {
      await failures(B.org.id, '203.0.113.7', [10, 20, 30, 40, 50]);

      await engine.evaluateRules();

      await expect(alertsOf(rule)).resolves.toHaveLength(0);
    });

    knownDefect(
      'DEF-05',
      'SIEM-035 events with no organization do not raise alerts in every tenant',
      async () => {
        const bRule = await createRule(t.prisma, B.org.id, {
          ruleType: 'EVENT_FREQUENCY',
          metricField: null,
          operator: null,
          threshold: null,
          eventType: 'AUTH_LOGIN_FAILURE',
          groupByField: 'ipAddress',
          maxCount: 5,
          windowSeconds: 300,
        });
        // e.g. failed logins against e-mail addresses that belong to no tenant
        await failures(null, '203.0.113.66', [10, 20, 30, 40, 50]);

        await engine.evaluateRules();

        const leaked = [...(await alertsOf(rule)), ...(await alertsOf(bRule))];
        expect(leaked).toHaveLength(0);
      },
    );
  });

  describe('CREDENTIAL_STUFFING (≥3 distinct IPs fail, then a success, within 600s)', () => {
    let rule: Rule;
    const attempt = (
      outcome: 'FAILURE' | 'SUCCESS',
      ip: string,
      secondsAgo: number,
    ) =>
      seedEvents(A.org.id, `AUTH_LOGIN_${outcome}`, [
        {
          secondsAgo,
          metadata: { email: 'victim@example.com', ipAddress: ip },
        },
      ]);

    beforeEach(async () => {
      rule = await createRule(t.prisma, A.org.id, {
        ruleType: 'CREDENTIAL_STUFFING',
        metricField: null,
        operator: null,
        threshold: null,
        maxCount: 3,
        windowSeconds: 600,
        severity: 'CRITICAL',
      });
    });

    it('SIEM-040 3 distinct IPs fail then one succeeds → alert naming the account', async () => {
      await attempt('FAILURE', '198.51.100.1', 100);
      await attempt('FAILURE', '198.51.100.2', 90);
      await attempt('FAILURE', '198.51.100.3', 80);
      await attempt('SUCCESS', '198.51.100.4', 70);

      await engine.evaluateRules();

      const alerts = await alertsOf(rule);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].details).toMatchObject({
        email: 'victim@example.com',
        distinctIpCount: 3,
      });
    });

    it('SIEM-041 boundary: only 2 distinct IPs → no alert', async () => {
      await attempt('FAILURE', '198.51.100.1', 100);
      await attempt('FAILURE', '198.51.100.2', 90);
      await attempt('SUCCESS', '198.51.100.4', 70);

      await engine.evaluateRules();

      await expect(alertsOf(rule)).resolves.toHaveLength(0);
    });

    it('SIEM-042 many failures from ONE IP is brute force, not stuffing → no alert here', async () => {
      for (const s of [100, 95, 90, 85, 80])
        await attempt('FAILURE', '198.51.100.1', s);
      await attempt('SUCCESS', '198.51.100.1', 70);

      await engine.evaluateRules();

      await expect(alertsOf(rule)).resolves.toHaveLength(0);
    });

    it('SIEM-043 failures that never succeed → no stuffing alert (by design)', async () => {
      for (const [ip, s] of [
        ['198.51.100.1', 100],
        ['198.51.100.2', 90],
        ['198.51.100.3', 80],
      ] as const) {
        await attempt('FAILURE', ip, s);
      }

      await engine.evaluateRules();

      await expect(alertsOf(rule)).resolves.toHaveLength(0);
    });

    knownDefect(
      'DEF-16',
      'SIEM-044 a failure AFTER the compromising success does not hide the attack',
      async () => {
        await attempt('FAILURE', '198.51.100.1', 100);
        await attempt('FAILURE', '198.51.100.2', 90);
        await attempt('FAILURE', '198.51.100.3', 80);
        await attempt('SUCCESS', '198.51.100.4', 70);
        await attempt('FAILURE', '198.51.100.5', 60);

        await engine.evaluateRules();

        await expect(alertsOf(rule)).resolves.toHaveLength(1);
      },
    );
  });

  describe('UNUSUAL_ACCESS (sudo by unapproved users or outside 09:00–18:00 UTC)', () => {
    let rule: Rule;
    const sudo = (username: string, secondsAgo = 10) =>
      seedEvents(A.org.id, 'SUDO_COMMAND', [
        {
          secondsAgo,
          metadata: { username, command: '/usr/bin/cat /etc/shadow' },
        },
      ]);

    beforeEach(async () => {
      // Seeded directly: creating this configuration through the API is DEF-09.
      rule = await createRule(t.prisma, A.org.id, {
        ruleType: 'UNUSUAL_ACCESS',
        metricField: null,
        operator: null,
        threshold: null,
        approvedUsernames: 'saad, hashim',
        businessHourStartUTC: 9,
        businessHourEndUTC: 18,
        severity: 'HIGH',
      });
    });

    it('SIEM-050 sudo by an unapproved user → alert with reason and command', async () => {
      await sudo('mallory');

      await engine.evaluateRules();

      const alerts = await alertsOf(rule);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].details).toMatchObject({
        username: 'mallory',
        reason: 'unapproved_user',
        command: '/usr/bin/cat /etc/shadow',
      });
    });

    it('SIEM-051 sudo by an approved user in business hours → no alert', async () => {
      await sudo('hashim');

      await engine.evaluateRules();

      await expect(alertsOf(rule)).resolves.toHaveLength(0);
    });

    it.each([
      ['08:59:30', 1],
      ['09:00:30', 0],
      ['17:59:30', 0],
      ['18:00:30', 1],
    ])(
      'SIEM-052 boundary: approved user at %s UTC → %i alert(s)',
      async (time, expected) => {
        freezeClockAt(`2026-09-01T${time}.000Z`);
        await sudo('saad', 5);

        await engine.evaluateRules();

        await expect(alertsOf(rule)).resolves.toHaveLength(expected);
      },
    );

    it('SIEM-053 each sudo event alerts once, however many ticks pass', async () => {
      await sudo('mallory');

      await engine.evaluateRules();
      await engine.evaluateRules();

      await expect(alertsOf(rule)).resolves.toHaveLength(1);
    });

    it('SIEM-054 documented limitation: events older than the 5-minute scan are not revisited', async () => {
      await sudo('mallory', 301);

      await engine.evaluateRules();

      await expect(alertsOf(rule)).resolves.toHaveLength(0);
    });

    knownDefect(
      'DEF-09',
      'SIEM-055 an UNUSUAL_ACCESS rule created through the API keeps its configuration',
      async () => {
        jest.useRealTimers();
        const res = await request<{ id: string }>(t.app, 'POST', '/rules', {
          token: A.tokens.SECURITY_ANALYST,
          body: {
            name: 'sudo watch',
            ruleType: 'UNUSUAL_ACCESS',
            severity: 'HIGH',
            approvedUsernames: 'saad',
            businessHourStartUTC: 9,
            businessHourEndUTC: 18,
          },
        });

        const created = await t.prisma.rule.findUniqueOrThrow({
          where: { id: res.body.id },
        });
        expect(created).toMatchObject({
          approvedUsernames: 'saad',
          businessHourStartUTC: 9,
          businessHourEndUTC: 18,
        });
      },
    );
  });

  describe('ANOMALY_DETECTION (LSTM score from the AI service)', () => {
    let rule: Rule;
    beforeEach(async () => {
      rule = await createRule(t.prisma, A.org.id, {
        ruleType: 'ANOMALY_DETECTION',
        metricField: null,
        operator: null,
        threshold: null,
      });
    });

    it('SIEM-060 an anomalous score → alert carrying the model evidence', async () => {
      anomaly.getAnomalyScore.mockResolvedValue({
        serverId: A.server.id,
        reconstructionError: 0.42,
        threshold: 0.05,
        isAnomaly: true,
        windowSize: 20,
      });

      await engine.evaluateRules();

      const [alert] = await alertsOf(rule);
      expect(alert.details).toMatchObject({
        reconstructionError: 0.42,
        threshold: 0.05,
        detectionMethod: 'LSTM-Autoencoder',
      });
    });

    it('SIEM-061 a normal score → no alert', async () => {
      anomaly.getAnomalyScore.mockResolvedValue({ isAnomaly: false });

      await engine.evaluateRules();

      await expect(alertsOf(rule)).resolves.toHaveLength(0);
    });

    it('SIEM-062 AI service unavailable → no alert and the engine keeps running', async () => {
      anomaly.getAnomalyScore.mockResolvedValue(null);

      await expect(engine.evaluateRules()).resolves.toBeUndefined();
      await expect(alertsOf(rule)).resolves.toHaveLength(0);
    });
  });

  describe('Alert → incident correlation', () => {
    const openAlert = (ruleId: string, serverId: string | null) =>
      t.prisma.alert.create({ data: { ruleId, serverId, details: {} } });

    it('INC-001 alerts on one server become one incident at the highest severity', async () => {
      const medium = await createRule(t.prisma, A.org.id, {
        severity: 'MEDIUM',
        name: 'cpu',
      });
      const critical = await createRule(t.prisma, A.org.id, {
        severity: 'CRITICAL',
        name: 'disk',
      });
      await openAlert(medium.id, A.server.id);
      await openAlert(critical.id, A.server.id);

      await engine.correlateAlertsIntoIncidents();

      const incidents = await t.prisma.incident.findMany({
        include: { alerts: true },
      });
      expect(incidents).toHaveLength(1);
      expect(incidents[0].severity).toBe('CRITICAL');
      expect(incidents[0].title).toMatch(/\+ 1 more alert\(s\)$/);
      expect(incidents[0].alerts).toHaveLength(2);
    });

    it('INC-002 alerts on different servers become separate incidents', async () => {
      const second = await createServer(t.prisma, A.org.id);
      const rule = await createRule(t.prisma, A.org.id);
      await openAlert(rule.id, A.server.id);
      await openAlert(rule.id, second.id);

      await engine.correlateAlertsIntoIncidents();

      await expect(t.prisma.incident.count()).resolves.toBe(2);
    });

    it('INC-003 tenant scope: incidents never mix alerts from two organizations', async () => {
      const aRule = await createRule(t.prisma, A.org.id);
      const bRule = await createRule(t.prisma, B.org.id);
      await openAlert(aRule.id, null);
      await openAlert(bRule.id, null);

      await engine.correlateAlertsIntoIncidents();

      const incidents = await t.prisma.incident.findMany({
        include: { alerts: { include: { rule: true } } },
      });
      expect(incidents).toHaveLength(2);
      for (const incident of incidents) {
        for (const alert of incident.alerts) {
          expect(alert.rule.organizationId).toBe(incident.organizationId);
        }
      }
    });

    it('INC-004 correlation is idempotent: a second run creates nothing new', async () => {
      const rule = await createRule(t.prisma, A.org.id);
      await openAlert(rule.id, A.server.id);

      await engine.correlateAlertsIntoIncidents();
      await engine.correlateAlertsIntoIncidents();

      await expect(t.prisma.incident.count()).resolves.toBe(1);
    });

    it('INC-005 each new incident is sent for RAG indexing under its own organization', async () => {
      const rule = await createRule(t.prisma, A.org.id);
      await openAlert(rule.id, A.server.id);

      await engine.correlateAlertsIntoIncidents();

      const incident = await t.prisma.incident.findFirstOrThrow();
      expect(rag.indexIncident).toHaveBeenCalledWith(incident.id, A.org.id);
    });

    knownDefect(
      'DEF-18',
      'INC-006 the incident’s alerts are linked BEFORE it is sent for RAG indexing',
      async () => {
        // Asserts call ORDER, not database state: whether the AI service happens
        // to see the alerts in production is a timing race, but the order in
        // which the engine issues the two operations is deterministic.
        const rule = await createRule(t.prisma, A.org.id);
        await openAlert(rule.id, A.server.id);
        const linkAlerts = jest.spyOn(t.prisma.alert, 'updateMany');

        try {
          await engine.correlateAlertsIntoIncidents();

          const [linkedAt] = linkAlerts.mock.invocationCallOrder;
          const [indexedAt] = rag.indexIncident.mock.invocationCallOrder;
          expect(linkedAt).toBeLessThan(indexedAt);
        } finally {
          linkAlerts.mockRestore();
        }
      },
    );

    knownDefect(
      'DEF-17',
      'INC-007 a new alert on the same server within minutes joins the open incident',
      async () => {
        const rule = await createRule(t.prisma, A.org.id);
        const other = await createRule(t.prisma, A.org.id);
        await openAlert(rule.id, A.server.id);
        await engine.correlateAlertsIntoIncidents();
        await openAlert(other.id, A.server.id); // 90 seconds later in real life

        await engine.correlateAlertsIntoIncidents();

        await expect(t.prisma.incident.count()).resolves.toBe(1);
      },
    );
  });

  describe('Incident status workflow', () => {
    let incidentId: string;
    beforeEach(async () => {
      jest.useRealTimers();
      const rule = await createRule(t.prisma, A.org.id);
      await t.prisma.alert.create({
        data: { ruleId: rule.id, serverId: A.server.id, details: {} },
      });
      await engine.correlateAlertsIntoIncidents();
      incidentId = (await t.prisma.incident.findFirstOrThrow()).id;
    });
    const setStatus = (status: string) =>
      request(t.app, 'PATCH', `/incidents/${incidentId}/status`, {
        token: A.tokens.SECURITY_ANALYST,
        body: { status },
      });

    it('INC-010 OPEN → INVESTIGATING → RESOLVED records the resolution time', async () => {
      await setStatus('INVESTIGATING');
      await setStatus('RESOLVED');

      const incident = await t.prisma.incident.findUniqueOrThrow({
        where: { id: incidentId },
      });
      expect(incident.status).toBe('RESOLVED');
      expect(incident.resolvedAt).toBeInstanceOf(Date);
    });

    knownDefect(
      'DEF-20',
      'INC-011 an unknown status value is rejected with 400',
      async () => {
        const res = await setStatus('CLOSED');

        expect(res.status).toBe(400);
      },
    );

    knownDefect(
      'DEF-06',
      'INC-012 resolving an incident resolves its alerts',
      async () => {
        await setStatus('RESOLVED');

        const alerts = await t.prisma.alert.findMany({ where: { incidentId } });
        expect(alerts.every((a) => a.status === 'RESOLVED')).toBe(true);
      },
    );
  });
});
