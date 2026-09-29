import { JwtService } from '@nestjs/jwt';
import {
  accessTokenFor,
  createTenant,
  resetDatabase,
  Tenant,
  TEST_PASSWORD,
} from './helpers/factory';
import { knownDefect } from './helpers/known-defect';
import { createTestApp, request, TestApp } from './helpers/test-app';

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

const decode = (token: string) =>
  new JwtService({}).decode<{
    sub: string;
    role: string;
    organizationId: string;
  }>(token);

describe('Authentication (AUTH)', () => {
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
    org = await createTenant(t.prisma, 'Auth');
  });

  const login = (email: string, password: string) =>
    request<Tokens>(t.app, 'POST', '/auth/login', {
      body: { email, password },
    });

  describe('signup', () => {
    it('AUTH-001 creates an organization whose creator is OWNER', async () => {
      const res = await request<Tokens>(t.app, 'POST', '/auth/signup', {
        body: {
          email: 'founder@example.com',
          password: 'long-enough',
          organizationName: 'Founders',
        },
      });

      expect(res.status).toBe(201);
      const claims = decode(res.body.accessToken);
      expect(claims.role).toBe('OWNER');
      const user = await t.prisma.user.findUniqueOrThrow({
        where: { email: 'founder@example.com' },
      });
      expect(user.organizationId).toBe(claims.organizationId);
      expect(user.passwordHash).not.toContain('long-enough');
    });

    it('AUTH-002 rejects a duplicate email with 409', async () => {
      const res = await request(t.app, 'POST', '/auth/signup', {
        body: {
          email: org.users.OWNER.email,
          password: 'long-enough',
          organizationName: 'Dup',
        },
      });

      expect(res.status).toBe(409);
    });

    // Boundary value analysis on the 8-character minimum password length.
    it.each([
      ['7-char password (below boundary)', { password: '1234567' }, 400],
      ['8-char password (on boundary)', { password: '12345678' }, 201],
      ['malformed email', { email: 'not-an-email' }, 400],
      ['missing organization name', { organizationName: undefined }, 400],
    ])('AUTH-003 signup with %s → %i', async (_, override, expected) => {
      const res = await request(t.app, 'POST', '/auth/signup', {
        body: {
          email: `bva.${Math.random().toString(36).slice(2)}@example.com`,
          password: 'long-enough',
          organizationName: 'BVA',
          ...override,
        },
      });

      expect(res.status).toBe(expected);
    });
  });

  describe('login and the security events it produces', () => {
    it('AUTH-010 valid credentials → tokens + AUTH_LOGIN_SUCCESS for the org', async () => {
      const res = await login(org.users.ADMIN.email, TEST_PASSWORD);

      expect(res.status).toBe(200);
      expect(decode(res.body.accessToken).sub).toBe(org.users.ADMIN.id);
      const event = await t.prisma.event.findFirstOrThrow({
        where: { eventType: 'AUTH_LOGIN_SUCCESS' },
      });
      expect(event.organizationId).toBe(org.org.id);
    });

    it('AUTH-011 wrong password → 401 + AUTH_LOGIN_FAILURE attributed to the org', async () => {
      const res = await login(org.users.ADMIN.email, 'wrong-password');

      expect(res.status).toBe(401);
      const event = await t.prisma.event.findFirstOrThrow({
        where: { eventType: 'AUTH_LOGIN_FAILURE' },
      });
      expect(event.organizationId).toBe(org.org.id);
      expect(event.metadata).toMatchObject({ reason: 'wrong_password' });
    });

    it('AUTH-012 unknown email and wrong password give an identical response (no account enumeration)', async () => {
      const unknown = await login('nobody@example.com', 'whatever');
      const wrong = await login(org.users.ADMIN.email, 'wrong-password');

      expect(unknown.status).toBe(401);
      expect(unknown.body).toEqual(wrong.body);
    });

    knownDefect(
      'DEF-13',
      'AUTH-013 repeated failed logins are throttled (HTTP 429) before 20 attempts',
      async () => {
        const statuses: number[] = [];
        for (let i = 0; i < 20; i++) {
          statuses.push(
            (await login(org.users.ADMIN.email, `guess-${i}`)).status,
          );
        }

        expect(statuses).toContain(429);
      },
    );
  });

  describe('access-token verification', () => {
    const PROTECTED = '/organizations/me';
    const b64 = (value: object) =>
      Buffer.from(JSON.stringify(value)).toString('base64url');

    it('AUTH-020 positive control: a valid access token is accepted', async () => {
      const res = await request(t.app, 'GET', PROTECTED, {
        token: org.tokens.VIEWER,
      });

      expect(res.status).toBe(200);
    });

    it.each([
      ['a random string', () => 'not.a.jwt'],
      [
        'a token signed with the wrong secret',
        () => accessTokenFor(org.users.OWNER, { secret: 'attacker-secret' }),
      ],
      [
        'an expired token',
        () => accessTokenFor(org.users.OWNER, { expiresIn: -10 }),
      ],
      [
        'a refresh token presented as an access token',
        () =>
          accessTokenFor(org.users.OWNER, {
            secret: process.env.JWT_REFRESH_SECRET,
          }),
      ],
      [
        'a payload tampered to another org (signature kept)',
        () => {
          const [header, payload, signature] = org.tokens.VIEWER.split('.');
          const claims = JSON.parse(
            Buffer.from(payload, 'base64url').toString(),
          ) as Record<string, unknown>;
          return `${header}.${b64({ ...claims, role: 'OWNER', organizationId: 'other-org' })}.${signature}`;
        },
      ],
      [
        'an unsigned token (alg: none)',
        () =>
          `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
            sub: org.users.OWNER.id,
            role: 'OWNER',
            organizationId: org.org.id,
          })}.`,
      ],
    ])('AUTH-021 rejects %s with 401', async (_, makeToken) => {
      const res = await request(t.app, 'GET', PROTECTED, {
        token: makeToken(),
      });

      expect(res.status).toBe(401);
    });
  });

  describe('refresh tokens', () => {
    const refresh = (refreshToken: string) =>
      request<Tokens>(t.app, 'POST', '/auth/refresh', {
        body: { refreshToken },
      });

    it('AUTH-030 a valid refresh token yields a new token pair', async () => {
      const { body } = await login(org.users.DEVELOPER.email, TEST_PASSWORD);

      const res = await refresh(body.refreshToken);

      expect(res.status).toBe(200);
      expect(decode(res.body.accessToken).sub).toBe(org.users.DEVELOPER.id);
    });

    it('AUTH-031 an access token cannot be used as a refresh token', async () => {
      const res = await refresh(org.tokens.DEVELOPER);

      expect(res.status).toBe(401);
    });

    it('AUTH-032 refresh picks up role changes made since login', async () => {
      const { body } = await login(org.users.DEVELOPER.email, TEST_PASSWORD);
      await t.prisma.user.update({
        where: { id: org.users.DEVELOPER.id },
        data: { role: 'SECURITY_ANALYST' },
      });

      const res = await refresh(body.refreshToken);

      expect(decode(res.body.accessToken).role).toBe('SECURITY_ANALYST');
    });

    it('AUTH-033 refresh is refused once the user no longer exists', async () => {
      const { body } = await login(org.users.DEVELOPER.email, TEST_PASSWORD);
      await t.prisma.user.delete({ where: { id: org.users.DEVELOPER.id } });

      const res = await refresh(body.refreshToken);

      expect(res.status).toBe(401);
    });

    knownDefect(
      'DEF-12',
      'AUTH-034 a refresh token cannot be replayed after it has been used (rotation)',
      async () => {
        const { body } = await login(org.users.DEVELOPER.email, TEST_PASSWORD);
        await refresh(body.refreshToken);

        const replay = await refresh(body.refreshToken);

        expect(replay.status).toBe(401);
      },
    );

    knownDefect(
      'DEF-12',
      'AUTH-035 a demoted user loses privileges immediately (not after token expiry)',
      async () => {
        const staleAdminToken = org.tokens.ADMIN;
        await t.prisma.user.update({
          where: { id: org.users.ADMIN.id },
          data: { role: 'VIEWER' },
        });

        const res = await request(t.app, 'POST', '/organizations/invitations', {
          token: staleAdminToken,
          body: { email: 'late.invite@example.com', role: 'VIEWER' },
        });

        expect(res.status).toBe(403);
      },
    );
  });

  describe('invitations', () => {
    const invite = async (expiresInMs = 86_400_000) =>
      t.prisma.invitation.create({
        data: {
          email: `invitee.${Math.random().toString(36).slice(2)}@example.com`,
          role: 'SECURITY_ANALYST',
          token: `tok-${Math.random().toString(36).slice(2)}`,
          organizationId: org.org.id,
          expiresAt: new Date(Date.now() + expiresInMs),
        },
      });
    const accept = (token: string, password = 'long-enough') =>
      request<Tokens>(t.app, 'POST', '/auth/accept-invitation', {
        body: { token, password },
      });

    it('AUTH-040 accepting creates the user in the inviting org with the invited role', async () => {
      const inv = await invite();

      const res = await accept(inv.token);

      expect(res.status).toBe(200);
      const claims = decode(res.body.accessToken);
      expect(claims.organizationId).toBe(org.org.id);
      expect(claims.role).toBe('SECURITY_ANALYST');
    });

    it('AUTH-041 an invitation token works only once', async () => {
      const inv = await invite();
      await accept(inv.token);

      const second = await accept(inv.token);

      expect(second.status).toBe(401);
    });

    it('AUTH-042 an expired invitation is refused', async () => {
      const inv = await invite(-1000);

      const res = await accept(inv.token);

      expect(res.status).toBe(401);
    });

    it('AUTH-043 an unknown invitation token is refused', async () => {
      const res = await accept('made-up-token');

      expect(res.status).toBe(401);
    });

    knownDefect(
      'DEF-23',
      'AUTH-044 accepting an invite for an email that registered meanwhile → 409, not 500',
      async () => {
        const inv = await invite();
        await request(t.app, 'POST', '/auth/signup', {
          body: {
            email: inv.email,
            password: 'long-enough',
            organizationName: 'Other',
          },
        });

        const res = await accept(inv.token);

        expect(res.status).toBe(409);
      },
    );
  });

  it('AUTH-050 member listings never expose password hashes', async () => {
    const res = await request(t.app, 'GET', '/organizations/members', {
      token: org.tokens.VIEWER,
    });

    expect(res.status).toBe(200);
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });
});
