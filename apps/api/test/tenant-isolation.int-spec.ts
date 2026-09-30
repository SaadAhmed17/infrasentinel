import {
  createIncidentWithAlert,
  createRule,
  createTenant,
  resetDatabase,
  Tenant,
} from './helpers/factory';
import { knownDefect } from './helpers/known-defect';
import { createTestApp, request, TestApp } from './helpers/test-app';

// Requirement (README): "multi-tenant isolated … one tenant's incidents are never
// retrievable by another"; "organizationId is resolved from the JWT — never
// trusted from client input".
//
// Method: two real organizations in a real database. The attacker is the OWNER
// of Org A — the most privileged role — so any pass here proves that no role can
// cross the tenant boundary. Every check targets Org B's real record IDs, which
// models the worst case (IDs leaked or guessed).
describe('Tenant isolation (TENANT)', () => {
  let t: TestApp;
  let A: Tenant;
  let B: Tenant;
  let bFixture: Awaited<ReturnType<typeof createIncidentWithAlert>>;
  let bSecrets: string[];

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    await resetDatabase(t.prisma);
    A = await createTenant(t.prisma, 'Alpha');
    B = await createTenant(t.prisma, 'Bravo');
    await createIncidentWithAlert(t.prisma, A);
    bFixture = await createIncidentWithAlert(t.prisma, B);
    await t.prisma.metric.create({
      data: {
        serverId: B.server.id,
        cpuUsage: 42.4242,
        memUsage: 1,
        diskUsage: 1,
      },
    });
    const bInvite = await t.prisma.invitation.create({
      data: {
        email: 'bravo.invitee@example.com',
        token: 'bravo-invite-token',
        organizationId: B.org.id,
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    // Anything that identifies Org B's data. None may appear in Org A responses.
    bSecrets = [
      B.org.id,
      B.server.id,
      B.server.apiKey,
      bFixture.rule.id,
      bFixture.incident.id,
      bFixture.alert.id,
      B.users.OWNER.email,
      bInvite.email,
      '42.4242',
    ];
  });

  const expectNoTenantBLeak = (body: unknown) => {
    const text = JSON.stringify(body);
    for (const secret of bSecrets) expect(text).not.toContain(secret);
  };

  describe('collection endpoints return only the caller’s organization', () => {
    it.each([
      '/servers',
      '/rules',
      '/incidents',
      '/incidents/dashboard-summary',
      '/organizations/me',
      '/organizations/members',
      '/organizations/invitations',
    ])('TENANT-001 GET %s leaks nothing from another org', async (path) => {
      const res = await request(t.app, 'GET', path, { token: A.tokens.OWNER });

      expect(res.status).toBe(200);
      expectNoTenantBLeak(res.body);
    });

    it('TENANT-002 positive control: Org A does see its own server', async () => {
      const res = await request<{ id: string }[]>(t.app, 'GET', '/servers', {
        token: A.tokens.OWNER,
      });

      expect(res.body.map((s) => s.id)).toEqual([A.server.id]);
    });
  });

  describe('object endpoints refuse another org’s record IDs (IDOR)', () => {
    it('TENANT-010 GET /servers/:id/metrics → 404 without data', async () => {
      const res = await request(
        t.app,
        'GET',
        `/servers/${B.server.id}/metrics`,
        {
          token: A.tokens.OWNER,
        },
      );

      expect(res.status).toBe(404);
      expectNoTenantBLeak(res.body);
    });

    it('TENANT-011 PATCH /servers/:id → 404 and the server is unchanged', async () => {
      const res = await request(t.app, 'PATCH', `/servers/${B.server.id}`, {
        token: A.tokens.OWNER,
        body: { name: 'pwned' },
      });

      expect(res.status).toBe(404);
      const after = await t.prisma.server.findUniqueOrThrow({
        where: { id: B.server.id },
      });
      expect(after.name).toBe(B.server.name);
    });

    it('TENANT-012 DELETE /servers/:id → 404 and server + metrics survive', async () => {
      const res = await request(t.app, 'DELETE', `/servers/${B.server.id}`, {
        token: A.tokens.OWNER,
      });

      expect(res.status).toBe(404);
      await expect(
        t.prisma.server.count({ where: { id: B.server.id } }),
      ).resolves.toBe(1);
      await expect(
        t.prisma.metric.count({ where: { serverId: B.server.id } }),
      ).resolves.toBe(1);
    });

    it('TENANT-013 PATCH /rules/:id → 404 and the rule is unchanged', async () => {
      const res = await request(t.app, 'PATCH', `/rules/${bFixture.rule.id}`, {
        token: A.tokens.OWNER,
        body: { threshold: 1 },
      });

      expect(res.status).toBe(404);
      const after = await t.prisma.rule.findUniqueOrThrow({
        where: { id: bFixture.rule.id },
      });
      expect(after.threshold).toBe(bFixture.rule.threshold);
    });

    it('TENANT-014 DELETE /rules/:id → 404 and rule + alerts survive', async () => {
      const res = await request(t.app, 'DELETE', `/rules/${bFixture.rule.id}`, {
        token: A.tokens.OWNER,
      });

      expect(res.status).toBe(404);
      await expect(
        t.prisma.alert.count({ where: { ruleId: bFixture.rule.id } }),
      ).resolves.toBe(1);
    });

    it('TENANT-015 PATCH /rules/:id/toggle cannot deactivate another org’s rule', async () => {
      await request(t.app, 'PATCH', `/rules/${bFixture.rule.id}/toggle`, {
        token: A.tokens.OWNER,
        body: { isActive: false },
      });

      const after = await t.prisma.rule.findUniqueOrThrow({
        where: { id: bFixture.rule.id },
      });
      expect(after.isActive).toBe(true);
    });

    it('TENANT-016 PATCH /incidents/:id/status cannot resolve another org’s incident', async () => {
      await request(
        t.app,
        'PATCH',
        `/incidents/${bFixture.incident.id}/status`,
        {
          token: A.tokens.OWNER,
          body: { status: 'RESOLVED' },
        },
      );

      const after = await t.prisma.incident.findUniqueOrThrow({
        where: { id: bFixture.incident.id },
      });
      expect(after.status).toBe('OPEN');
    });

    it('TENANT-017 PATCH /organizations/members/:id/role → 404 and role unchanged', async () => {
      const res = await request(
        t.app,
        'PATCH',
        `/organizations/members/${B.users.OWNER.id}/role`,
        { token: A.tokens.OWNER, body: { role: 'VIEWER' } },
      );

      expect(res.status).toBe(404);
      const after = await t.prisma.user.findUniqueOrThrow({
        where: { id: B.users.OWNER.id },
      });
      expect(after.role).toBe('OWNER');
    });

    knownDefect(
      'DEF-08',
      'TENANT-018 GET /servers/:id/anomaly-score refuses another org’s server',
      async () => {
        const res = await request(
          t.app,
          'GET',
          `/servers/${B.server.id}/anomaly-score`,
          { token: A.tokens.OWNER },
        );

        expect(res.status).toBe(404);
      },
    );

    knownDefect(
      'DEF-22',
      'TENANT-019 cross-org toggle / status update answers 404 (not 200)',
      async () => {
        const res = await request(
          t.app,
          'PATCH',
          `/rules/${bFixture.rule.id}/toggle`,
          { token: A.tokens.OWNER, body: { isActive: false } },
        );

        expect(res.status).toBe(404);
      },
    );
  });

  describe('client-supplied organization IDs are never trusted', () => {
    it('TENANT-020 positive control: a normal rule update succeeds', async () => {
      const aRule = await createRule(t.prisma, A.org.id);

      const res = await request(t.app, 'PATCH', `/rules/${aRule.id}`, {
        token: A.tokens.SECURITY_ANALYST,
        body: { name: 'renamed' },
      });

      expect(res.status).toBe(200);
    });

    it('TENANT-021 PATCH /rules/:id cannot move a rule into another org (mass assignment)', async () => {
      const aRule = await createRule(t.prisma, A.org.id);

      await request(t.app, 'PATCH', `/rules/${aRule.id}`, {
        token: A.tokens.SECURITY_ANALYST,
        body: { name: 'renamed', organizationId: B.org.id },
      });

      const after = await t.prisma.rule.findUniqueOrThrow({
        where: { id: aRule.id },
      });
      expect(after.organizationId).toBe(A.org.id);
    });

    it('TENANT-025 PATCH /rules/:id validates field values (invalid threshold → 400)', async () => {
      const aRule = await createRule(t.prisma, A.org.id);

      const res = await request(t.app, 'PATCH', `/rules/${aRule.id}`, {
        token: A.tokens.SECURITY_ANALYST,
        body: { threshold: 'lots' },
      });

      expect(res.status).toBe(400);
    });

    it('TENANT-022 POST /rules ignores an organizationId in the body', async () => {
      const res = await request<{ id: string }>(t.app, 'POST', '/rules', {
        token: A.tokens.OWNER,
        body: {
          name: 'cpu high',
          ruleType: 'METRIC_THRESHOLD',
          metricField: 'CPU_USAGE',
          operator: 'GREATER_THAN',
          threshold: 90,
          severity: 'HIGH',
          organizationId: B.org.id,
        },
      });

      expect(res.status).toBe(201);
      const created = await t.prisma.rule.findUniqueOrThrow({
        where: { id: res.body.id },
      });
      expect(created.organizationId).toBe(A.org.id);
    });

    it('TENANT-023 POST /servers ignores an organizationId in the body', async () => {
      const res = await request<{ id: string }>(t.app, 'POST', '/servers', {
        token: A.tokens.OWNER,
        body: { name: 'new-box', organizationId: B.org.id },
      });

      expect(res.status).toBe(201);
      const created = await t.prisma.server.findUniqueOrThrow({
        where: { id: res.body.id },
      });
      expect(created.organizationId).toBe(A.org.id);
    });

    it('TENANT-024 RAG questions are scoped to the JWT organization, not the body', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ answer: 'ok', sources: [] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      );

      try {
        const res = await request(t.app, 'POST', '/rag/query', {
          token: A.tokens.VIEWER,
          body: { question: 'what happened?', organizationId: B.org.id },
        });

        expect(res.status).toBe(201);
        const [, init] = fetchSpy.mock.calls[0];
        const forwarded = JSON.parse(init?.body as string) as {
          organizationId: string;
        };
        expect(forwarded.organizationId).toBe(A.org.id);
      } finally {
        fetchSpy.mockRestore();
      }
    });
  });

  describe('agent API keys are bound to exactly one server', () => {
    it('TENANT-030 metrics pushed with Org B’s key are stored only on Org B’s server', async () => {
      const res = await request(t.app, 'POST', '/agent/metrics', {
        apiKey: B.server.apiKey,
        body: {
          cpuUsage: 12,
          memUsage: 34,
          diskUsage: 56,
          serverId: A.server.id,
        },
      });

      expect(res.status).toBe(201);
      await expect(
        t.prisma.metric.count({ where: { serverId: A.server.id } }),
      ).resolves.toBe(0);
      await expect(
        t.prisma.metric.count({ where: { serverId: B.server.id } }),
      ).resolves.toBe(2);
    });

    it('TENANT-031 log events pushed with Org B’s key are recorded under Org B', async () => {
      await request(t.app, 'POST', '/agent/log-event', {
        apiKey: B.server.apiKey,
        body: {
          eventType: 'SSH_LOGIN_FAILURE',
          outcome: 'FAILURE',
          username: 'root',
          ipAddress: '203.0.113.9',
        },
      });

      const events = await t.prisma.event.findMany({
        where: { eventType: 'SSH_LOGIN_FAILURE' },
      });
      expect(events).toHaveLength(1);
      expect(events[0].organizationId).toBe(B.org.id);
    });
  });
});
