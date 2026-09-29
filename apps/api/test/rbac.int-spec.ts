import { Role } from '@prisma/client';
import {
  ALL_ROLES,
  createIncidentWithAlert,
  createRule,
  createServer,
  createTenant,
  resetDatabase,
  Tenant,
} from './helpers/factory';
import { knownDefect } from './helpers/known-defect';
import {
  createTestApp,
  HttpMethod,
  request,
  TestApp,
} from './helpers/test-app';

// Requirement (README): "6-role RBAC via Guards".
//
// The expected policy below is the documented access-control matrix (see
// docs/sqa/RBAC_MATRIX.md). Every protected endpoint is called by every role
// through the real guard chain. Denied roles must get 403; allowed roles must
// get past authorization (any status other than 401/403).
interface Endpoint {
  method: HttpMethod;
  path: (t: Tenant, ids: Ids) => string;
  body?: Record<string, unknown>;
  allowed: Role[] | 'ALL';
}
interface Ids {
  serverId: string;
  ruleId: string;
  incidentId: string;
  memberId: string;
}

const MANAGE_SERVERS: Role[] = ['OWNER', 'ADMIN', 'DEVOPS_ENGINEER'];
const MANAGE_SECURITY: Role[] = ['OWNER', 'ADMIN', 'SECURITY_ANALYST'];
const MANAGE_ORG: Role[] = ['OWNER', 'ADMIN'];

const MATRIX: Endpoint[] = [
  { method: 'GET', path: () => '/servers', allowed: 'ALL' },
  {
    method: 'GET',
    path: (_, i) => `/servers/${i.serverId}/metrics`,
    allowed: 'ALL',
  },
  {
    method: 'POST',
    path: () => '/servers',
    body: { name: 'rbac-box' },
    allowed: MANAGE_SERVERS,
  },
  {
    method: 'PATCH',
    path: (_, i) => `/servers/${i.serverId}`,
    body: { name: 'renamed' },
    allowed: MANAGE_SERVERS,
  },
  {
    method: 'DELETE',
    path: (_, i) => `/servers/${i.serverId}`,
    allowed: MANAGE_SERVERS,
  },
  { method: 'GET', path: () => '/rules', allowed: 'ALL' },
  {
    method: 'POST',
    path: () => '/rules',
    body: {
      name: 'r',
      ruleType: 'HEARTBEAT_MISSING',
      durationSeconds: 120,
      severity: 'HIGH',
    },
    allowed: MANAGE_SECURITY,
  },
  {
    method: 'PATCH',
    path: (_, i) => `/rules/${i.ruleId}`,
    body: { name: 'renamed' },
    allowed: MANAGE_SECURITY,
  },
  {
    method: 'PATCH',
    path: (_, i) => `/rules/${i.ruleId}/toggle`,
    body: { isActive: false },
    allowed: MANAGE_SECURITY,
  },
  {
    method: 'DELETE',
    path: (_, i) => `/rules/${i.ruleId}`,
    allowed: MANAGE_SECURITY,
  },
  { method: 'GET', path: () => '/incidents', allowed: 'ALL' },
  { method: 'GET', path: () => '/incidents/dashboard-summary', allowed: 'ALL' },
  {
    method: 'PATCH',
    path: (_, i) => `/incidents/${i.incidentId}/status`,
    body: { status: 'INVESTIGATING' },
    allowed: MANAGE_SECURITY,
  },
  { method: 'GET', path: () => '/organizations/me', allowed: 'ALL' },
  { method: 'GET', path: () => '/organizations/members', allowed: 'ALL' },
  {
    method: 'PATCH',
    path: () => '/organizations/settings',
    body: { name: 'New Name' },
    allowed: MANAGE_ORG,
  },
  {
    method: 'PATCH',
    path: (_, i) => `/organizations/members/${i.memberId}/role`,
    body: { role: 'DEVELOPER' },
    allowed: MANAGE_ORG,
  },
  {
    method: 'POST',
    path: () => '/organizations/invitations',
    body: { email: 'new.person@example.com', role: 'VIEWER' },
    allowed: MANAGE_ORG,
  },
  {
    method: 'GET',
    path: () => '/organizations/invitations',
    allowed: MANAGE_ORG,
  },
  { method: 'GET', path: () => '/protected', allowed: 'ALL' },
  { method: 'GET', path: () => '/admin-only', allowed: MANAGE_ORG },
];

const CASES = MATRIX.flatMap((endpoint) =>
  ALL_ROLES.map((role) => {
    const allowed =
      endpoint.allowed === 'ALL' || endpoint.allowed.includes(role);
    const label = `${endpoint.method} ${endpoint.path({} as Tenant, {
      serverId: ':id',
      ruleId: ':id',
      incidentId: ':id',
      memberId: ':id',
    })}`;
    return { endpoint, role, allowed, label };
  }),
);

describe('Role-based access control (RBAC)', () => {
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
    org = await createTenant(t.prisma, 'Rbac');
  });

  // Fresh target records per case, so destructive calls never affect other cases.
  const freshIds = async (): Promise<Ids> => {
    const server = await createServer(t.prisma, org.org.id);
    const rule = await createRule(t.prisma, org.org.id);
    const { incident } = await createIncidentWithAlert(t.prisma, {
      org: org.org,
      server,
    });
    return {
      serverId: server.id,
      ruleId: rule.id,
      incidentId: incident.id,
      memberId: org.users.VIEWER.id,
    };
  };

  it.each(CASES)(
    'RBAC-001 $label as $role → allowed=$allowed',
    async ({ endpoint, role, allowed }) => {
      const ids = await freshIds();

      const res = await request(
        t.app,
        endpoint.method,
        endpoint.path(org, ids),
        {
          token: org.tokens[role],
          body: endpoint.body,
        },
      );

      if (allowed) {
        expect([401, 403]).not.toContain(res.status);
      } else {
        expect(res.status).toBe(403);
      }
    },
  );

  it('RBAC-002 every protected endpoint rejects anonymous callers with 401', async () => {
    const ids = await freshIds();
    for (const endpoint of MATRIX) {
      const res = await request(
        t.app,
        endpoint.method,
        endpoint.path(org, ids),
        {
          body: endpoint.body,
        },
      );
      expect({ endpoint: endpoint.path(org, ids), status: res.status }).toEqual(
        {
          endpoint: endpoint.path(org, ids),
          status: 401,
        },
      );
    }
  });

  describe('privilege escalation through role management', () => {
    const setRole = (token: string, userId: string, role: string) =>
      request(t.app, 'PATCH', `/organizations/members/${userId}/role`, {
        token,
        body: { role },
      });

    it('RBAC-010 positive control: OWNER can promote a VIEWER to ADMIN', async () => {
      const res = await setRole(org.tokens.OWNER, org.users.VIEWER.id, 'ADMIN');

      expect(res.status).toBe(200);
      const after = await t.prisma.user.findUniqueOrThrow({
        where: { id: org.users.VIEWER.id },
      });
      expect(after.role).toBe('ADMIN');
    });

    knownDefect(
      'DEF-03',
      'RBAC-011 ADMIN cannot promote another member to OWNER',
      async () => {
        const res = await setRole(
          org.tokens.ADMIN,
          org.users.VIEWER.id,
          'OWNER',
        );

        expect(res.status).toBe(403);
      },
    );

    knownDefect(
      'DEF-03',
      'RBAC-012 ADMIN cannot promote themselves to OWNER',
      async () => {
        const res = await setRole(
          org.tokens.ADMIN,
          org.users.ADMIN.id,
          'OWNER',
        );

        expect(res.status).toBe(403);
      },
    );

    knownDefect(
      'DEF-03',
      'RBAC-013 ADMIN cannot demote the OWNER',
      async () => {
        const res = await setRole(
          org.tokens.ADMIN,
          org.users.OWNER.id,
          'VIEWER',
        );

        expect(res.status).toBe(403);
        const owner = await t.prisma.user.findUniqueOrThrow({
          where: { id: org.users.OWNER.id },
        });
        expect(owner.role).toBe('OWNER');
      },
    );

    knownDefect(
      'DEF-03',
      'RBAC-014 ADMIN cannot issue an invitation carrying the OWNER role',
      async () => {
        const res = await request(t.app, 'POST', '/organizations/invitations', {
          token: org.tokens.ADMIN,
          body: { email: 'future.owner@example.com', role: 'OWNER' },
        });

        expect(res.status).toBe(403);
      },
    );

    knownDefect(
      'DEF-03',
      'RBAC-015 the last OWNER cannot demote themselves (org would have no owner)',
      async () => {
        const res = await setRole(
          org.tokens.OWNER,
          org.users.OWNER.id,
          'VIEWER',
        );

        expect([400, 403, 409]).toContain(res.status);
      },
    );

    knownDefect(
      'DEF-20',
      'RBAC-016 an unknown role value is rejected with 400',
      async () => {
        const res = await setRole(
          org.tokens.OWNER,
          org.users.VIEWER.id,
          'SUPERUSER',
        );

        expect(res.status).toBe(400);
      },
    );
  });
});
