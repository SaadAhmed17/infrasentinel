import {
  createServer,
  createTenant,
  resetDatabase,
  Tenant,
} from './helpers/factory';
import { knownDefect } from './helpers/known-defect';
import {
  createTestApp,
  eventually,
  request,
  TestApp,
} from './helpers/test-app';

// The ingestion pipeline is the platform's untrusted edge: anything that holds
// an API key (or steals one) can send data here, and everything downstream —
// dashboards, SIEM rules, the LSTM model — trusts what was stored.
describe('Agent ingestion (AGENT / METRIC / EVENT)', () => {
  let t: TestApp;
  let org: Tenant;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
    org = await createTenant(t.prisma, 'Ingest');
  });

  const VALID = { cpuUsage: 50, memUsage: 50, diskUsage: 50 };
  const pushMetric = (body: unknown, apiKey = org.server.apiKey) =>
    request(t.app, 'POST', '/agent/metrics', { apiKey, body });

  describe('API-key authentication', () => {
    it('AGENT-001 a valid key is accepted and marks the server ONLINE with a heartbeat', async () => {
      const before = Date.now();

      const res = await pushMetric(VALID);

      expect(res.status).toBe(201);
      const server = await t.prisma.server.findUniqueOrThrow({
        where: { id: org.server.id },
      });
      expect(server.status).toBe('ONLINE');
      expect(server.lastHeartbeat!.getTime()).toBeGreaterThanOrEqual(
        before - 1000,
      );
    });

    it('AGENT-002 a missing key is rejected with 401', async () => {
      const res = await request(t.app, 'POST', '/agent/metrics', {
        body: VALID,
      });

      expect(res.status).toBe(401);
    });

    it('AGENT-003 a user JWT is not accepted in place of an agent key', async () => {
      const res = await request(t.app, 'POST', '/agent/metrics', {
        token: org.tokens.OWNER,
        body: VALID,
      });

      expect(res.status).toBe(401);
    });

    it('AGENT-004 the key of a deleted server stops working (revocation by deletion)', async () => {
      const doomed = await createServer(t.prisma, org.org.id);
      await t.prisma.server.delete({ where: { id: doomed.id } });

      const res = await pushMetric(VALID, doomed.apiKey);

      expect([401, 403, 404]).toContain(res.status);
      await expect(t.prisma.metric.count()).resolves.toBe(0);
    });

    knownDefect(
      'DEF-21',
      'AGENT-005 an invalid key is rejected with 401 (not 404)',
      async () => {
        const res = await pushMetric(VALID, 'isk_totally_made_up');

        expect(res.status).toBe(401);
      },
    );
  });

  describe('metric validation — boundary value analysis on percentages', () => {
    const cases = ['cpuUsage', 'memUsage', 'diskUsage'].flatMap((field) =>
      (
        [
          [-0.01, 400],
          [0, 201],
          [50, 201],
          [100, 201],
          [100.01, 400],
        ] as const
      ).map(([value, status]) => ({ field, value, status })),
    );

    it.each(cases)(
      'METRIC-001 $field = $value → $status',
      async ({ field, value, status }) => {
        const res = await pushMetric({ ...VALID, [field]: value });

        expect(res.status).toBe(status);
      },
    );
  });

  describe('metric validation — equivalence partitions of invalid input', () => {
    it.each([
      ['a numeric string', { cpuUsage: '50' }],
      ['null', { cpuUsage: null }],
      ['a boolean', { cpuUsage: true }],
      ['an array', { cpuUsage: [50] }],
      ['a missing required field', { cpuUsage: undefined }],
      ['a negative rate', { networkIn: -1 }],
      ['a fractional process count', { processCount: 1.5 }],
    ])(
      'METRIC-010 rejects %s with 400 and stores nothing',
      async (_, override) => {
        const res = await pushMetric({ ...VALID, ...override });

        expect(res.status).toBe(400);
        await expect(t.prisma.metric.count()).resolves.toBe(0);
      },
    );

    it('METRIC-011 rejects Infinity (1e309 in JSON) instead of storing it', async () => {
      const res = await request(t.app, 'POST', '/agent/metrics', {
        apiKey: org.server.apiKey,
        rawBody:
          '{"cpuUsage":50,"memUsage":50,"diskUsage":50,"networkIn":1e309}',
      });

      expect(res.status).toBe(400);
    });

    it('METRIC-012 rejects a body that is not valid JSON', async () => {
      const res = await request(t.app, 'POST', '/agent/metrics', {
        apiKey: org.server.apiKey,
        rawBody: '{"cpuUsage": NaN}',
      });

      expect(res.status).toBe(400);
    });

    it('METRIC-013 accepts optional fields at realistic magnitudes', async () => {
      const res = await pushMetric({
        ...VALID,
        networkIn: 1.25e9,
        networkOut: 0,
        diskReadRate: 5e8,
        diskWriteRate: 0,
        processCount: 412,
        loadAverage: 3.5,
      });

      expect(res.status).toBe(201);
    });
  });

  describe('agents cannot falsify what they are not trusted with', () => {
    it('METRIC-020 a client-sent timestamp is ignored (no back-dating to dodge rule windows)', async () => {
      await pushMetric({ ...VALID, timestamp: '2000-01-01T00:00:00Z' });

      const metric = await t.prisma.metric.findFirstOrThrow();
      expect(metric.timestamp.getFullYear()).toBeGreaterThan(2000);
    });

    it('METRIC-021 a client-sent serverId is ignored (attribution comes from the key)', async () => {
      const other = await createServer(t.prisma, org.org.id);

      await pushMetric({ ...VALID, serverId: other.id });

      await expect(
        t.prisma.metric.count({ where: { serverId: other.id } }),
      ).resolves.toBe(0);
    });
  });

  describe('security log events', () => {
    const pushEvent = (body: Record<string, unknown>) =>
      request(t.app, 'POST', '/agent/log-event', {
        apiKey: org.server.apiKey,
        body,
      });
    const SSH_FAIL = {
      eventType: 'SSH_LOGIN_FAILURE',
      outcome: 'FAILURE',
      username: 'root',
      ipAddress: '198.51.100.7',
    };

    it('EVENT-001 an SSH failure is stored as a WARNING with server attribution', async () => {
      const res = await pushEvent(SSH_FAIL);

      expect(res.status).toBe(201);
      const event = await t.prisma.event.findFirstOrThrow({
        where: { eventType: 'SSH_LOGIN_FAILURE' },
      });
      expect(event.severity).toBe('WARNING');
      expect(event.metadata).toMatchObject({
        serverId: org.server.id,
        ipAddress: '198.51.100.7',
      });
    });

    it.each([
      ['an outcome outside SUCCESS/FAILURE', { outcome: 'MAYBE' }],
      ['a missing username', { username: undefined }],
      ['a numeric ip address', { ipAddress: 12345 }],
    ])('EVENT-002 rejects %s with 400', async (_, override) => {
      const res = await pushEvent({ ...SSH_FAIL, ...override });

      expect(res.status).toBe(400);
    });

    knownDefect(
      'DEF-19',
      'EVENT-003 an agent cannot inject platform auth events (event type allow-list)',
      async () => {
        const res = await pushEvent({
          ...SSH_FAIL,
          eventType: 'AUTH_LOGIN_SUCCESS',
        });

        expect(res.status).toBe(400);
      },
    );
  });

  describe('secrets and monitoring state exposed to the dashboard', () => {
    it('AGENT-010 the server list does not expose API keys', async () => {
      const res = await request(t.app, 'GET', '/servers', {
        token: org.tokens.VIEWER,
      });

      expect(JSON.stringify(res.body)).not.toContain(org.server.apiKey);
    });

    knownDefect(
      'DEF-07',
      'AGENT-011 the metrics endpoint does not expose the agent API key to a VIEWER',
      async () => {
        const res = await request(
          t.app,
          'GET',
          `/servers/${org.server.id}/metrics`,
          {
            token: org.tokens.VIEWER,
          },
        );

        expect(JSON.stringify(res.body)).not.toContain(org.server.apiKey);
      },
    );

    knownDefect(
      'DEF-14',
      'MON-001 a server silent for an hour is not reported as online',
      async () => {
        await t.prisma.server.update({
          where: { id: org.server.id },
          data: {
            status: 'ONLINE',
            lastHeartbeat: new Date(Date.now() - 3_600_000),
          },
        });

        const res = await request<{ servers: { online: number } }>(
          t.app,
          'GET',
          '/incidents/dashboard-summary',
          { token: org.tokens.VIEWER },
        );

        expect(res.body.servers.online).toBe(0);
      },
    );
  });

  describe('API request logging (feeds the API-abuse detection)', () => {
    type RequestLog = { method: string; path: string; ipAddress: string };
    const apiRequestLogs = async () =>
      (
        await t.prisma.event.findMany({ where: { eventType: 'API_REQUEST' } })
      ).map((e) => ({ org: e.organizationId, ...(e.metadata as RequestLog) }));
    // Logging is fire-and-forget, so give in-flight writes time to land.
    const settle = () => new Promise((resolve) => setTimeout(resolve, 500));

    it('LOG-001 an authenticated API call is logged with its organization and client IP', async () => {
      await request(t.app, 'GET', '/rules', { token: org.tokens.VIEWER });

      const logged = await eventually(async () =>
        (await apiRequestLogs()).some((l) => l.org === org.org.id),
      );
      expect(logged).toBe(true);
      const [log] = await apiRequestLogs();
      expect(log.method).toBe('GET');
      expect(log.ipAddress).not.toBe('unknown');
    });

    knownDefect(
      'DEF-34',
      'LOG-002 the logged path is the real request path',
      async () => {
        await request(t.app, 'GET', '/rules', { token: org.tokens.VIEWER });
        await settle();

        const [log] = await apiRequestLogs();
        expect(log.path).toBe('/rules');
      },
    );

    knownDefect(
      'DEF-34',
      'LOG-003 dashboard polling routes are excluded from abuse logging, as designed',
      async () => {
        await request(t.app, 'GET', '/servers', { token: org.tokens.VIEWER });
        await request(t.app, 'GET', '/incidents', { token: org.tokens.VIEWER });
        await settle();

        await expect(apiRequestLogs()).resolves.toHaveLength(0);
      },
    );

    knownDefect(
      'DEF-10',
      'LOG-004 agent telemetry is not logged as user API traffic',
      async () => {
        for (let i = 0; i < 3; i++) await pushMetric(VALID);
        await settle();

        const posts = (await apiRequestLogs()).filter(
          (l) => l.method === 'POST',
        );
        expect(posts).toHaveLength(0);
      },
    );
  });
});
