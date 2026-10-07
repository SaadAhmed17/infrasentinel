import {
  createIncidentWithAlert,
  createTenant,
  resetDatabase,
  Tenant,
} from './helpers/factory';
import { createTestApp, request, TestApp } from './helpers/test-app';

// Renaming and deleting servers (PATCH / DELETE /servers/:id).
describe('Server management (SRV)', () => {
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
    org = await createTenant(t.prisma, 'Servers');
  });

  it('SRV-001 rename returns the new name and never the agent key', async () => {
    const res = await request(t.app, 'PATCH', `/servers/${org.server.id}`, {
      token: org.tokens.OWNER,
      body: { name: 'web-01' },
    });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('web-01');
    expect(res.body).not.toHaveProperty('apiKey');
  });

  it.each([{}, { name: '' }, { name: 'x' }, { name: 42 }])(
    'SRV-002 rename with an invalid name %j → 400 and nothing changes',
    async (body) => {
      const res = await request(t.app, 'PATCH', `/servers/${org.server.id}`, {
        token: org.tokens.OWNER,
        body,
      });

      expect(res.status).toBe(400);
      const after = await t.prisma.server.findUniqueOrThrow({
        where: { id: org.server.id },
      });
      expect(after.name).toBe(org.server.name);
    },
  );

  it('SRV-003 delete removes the server and its metrics but keeps its alerts', async () => {
    const { alert, incident } = await createIncidentWithAlert(t.prisma, org);
    await t.prisma.metric.create({
      data: { serverId: org.server.id, cpuUsage: 1, memUsage: 1, diskUsage: 1 },
    });

    const res = await request(t.app, 'DELETE', `/servers/${org.server.id}`, {
      token: org.tokens.OWNER,
    });

    expect(res.status).toBe(200);
    await expect(
      t.prisma.server.count({ where: { id: org.server.id } }),
    ).resolves.toBe(0);
    await expect(
      t.prisma.metric.count({ where: { serverId: org.server.id } }),
    ).resolves.toBe(0);
    const kept = await t.prisma.alert.findUniqueOrThrow({
      where: { id: alert.id },
    });
    expect(kept.serverId).toBeNull();
    expect(kept.incidentId).toBe(incident.id);
  });

  it('SRV-004 deleting an unknown server → 404', async () => {
    const res = await request(
      t.app,
      'DELETE',
      '/servers/00000000-0000-0000-0000-000000000000',
      { token: org.tokens.OWNER },
    );

    expect(res.status).toBe(404);
  });
});
