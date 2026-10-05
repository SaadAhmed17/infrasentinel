import { JwtService } from '@nestjs/jwt';
import { MailService } from '../src/mail/mail.service';
import {
  createTenant,
  resetDatabase,
  Tenant,
  TEST_PASSWORD,
} from './helpers/factory';
import { createTestApp, request, TestApp } from './helpers/test-app';

// Forgot password and password reset (PWR-xxx). E-mails are captured by a
// replacement MailService, so no mail server is needed or contacted.
interface Tokens {
  accessToken: string;
  refreshToken: string;
}

describe('Password reset (PWR)', () => {
  let t: TestApp;
  let org: Tenant;
  const sent: { to: string; link: string; minutes: number }[] = [];

  beforeAll(async () => {
    t = await createTestApp((b) =>
      b.overrideProvider(MailService).useValue({
        isConfigured: () => true,
        sendPasswordResetEmail: (to: string, link: string, minutes: number) => {
          sent.push({ to, link, minutes });
          return Promise.resolve();
        },
      }),
    );
  });

  afterAll(async () => {
    await t.close();
  });

  beforeEach(async () => {
    sent.length = 0;
    await resetDatabase(t.prisma);
    org = await createTenant(t.prisma, `Pwr${Date.now()}`);
  });

  const forgot = (email: string) =>
    request<{ message: string }>(t.app, 'POST', '/auth/forgot-password', {
      body: { email },
    });
  const reset = (token: string, password: string) =>
    request<{ message: string }>(t.app, 'POST', '/auth/reset-password', {
      body: { token, password },
    });
  const login = (email: string, password: string) =>
    request<Tokens>(t.app, 'POST', '/auth/login', {
      body: { email, password },
    });
  const tokenFromLink = (link: string) =>
    decodeURIComponent(new URL(link).searchParams.get('token')!);
  const flush = () => new Promise((r) => setTimeout(r, 20));

  it('PWR-001 known and unknown emails get the identical 200 answer; only the known one gets an email', async () => {
    const known = await forgot(org.users.VIEWER.email);
    const unknown = await forgot('nobody@example.com');
    await flush();

    expect(known.status).toBe(200);
    expect(unknown.status).toBe(200);
    expect(unknown.body).toEqual(known.body);
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(org.users.VIEWER.email);
    expect(sent[0].minutes).toBe(30);
    expect(sent[0].link).toMatch(
      /^http:\/\/localhost:3000\/reset-password\?token=/,
    );
  });

  it('PWR-002 invalid email body is a 400, not a 500', async () => {
    expect((await forgot('not-an-email')).status).toBe(400);
    expect(
      (await request(t.app, 'POST', '/auth/forgot-password', { body: {} }))
        .status,
    ).toBe(400);
  });

  it('PWR-003 a valid link resets the password: new password works, old one fails', async () => {
    const user = org.users.ADMIN;
    await forgot(user.email);
    await flush();

    const res = await reset(tokenFromLink(sent[0].link), 'Brand-New-Pass-1');
    expect(res.status).toBe(200);

    expect((await login(user.email, TEST_PASSWORD)).status).toBe(401);
    expect((await login(user.email, 'Brand-New-Pass-1')).status).toBe(200);
  });

  it('PWR-004 a link works only once', async () => {
    await forgot(org.users.OWNER.email);
    await flush();
    const token = tokenFromLink(sent[0].link);

    expect((await reset(token, 'First-New-Pass-1')).status).toBe(200);
    const again = await reset(token, 'Second-New-Pass-2');
    expect(again.status).toBe(400);
    expect(
      (await login(org.users.OWNER.email, 'First-New-Pass-1')).status,
    ).toBe(200);
  });

  it('PWR-005 two simultaneous uses of one link: exactly one succeeds', async () => {
    await forgot(org.users.DEVELOPER.email);
    await flush();
    const token = tokenFromLink(sent[0].link);

    const results = await Promise.all([
      reset(token, 'Race-Pass-One-1'),
      reset(token, 'Race-Pass-Two-2'),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 400]);
  });

  it('PWR-006 expired, tampered, foreign-purpose and garbage tokens are rejected with 400', async () => {
    const user = org.users.SECURITY_ANALYST;
    const jwt = new JwtService({});
    const key = `${process.env.JWT_ACCESS_SECRET}:${user.passwordHash}`;

    const expired = jwt.sign(
      {
        sub: user.id,
        purpose: 'password-reset',
        iat: Math.floor(Date.now() / 1000) - 3600,
      },
      { secret: key, expiresIn: 60 },
    );
    const wrongKey = jwt.sign(
      { sub: user.id, purpose: 'password-reset' },
      { secret: 'guess', expiresIn: 600 },
    );
    const accessTokenAsReset = org.tokens.SECURITY_ANALYST;
    const noPurpose = jwt.sign(
      { sub: user.id },
      { secret: key, expiresIn: 600 },
    );

    for (const token of [
      expired,
      wrongKey,
      accessTokenAsReset,
      noPurpose,
      'garbage',
      'a.b.c',
      '',
    ]) {
      const res = await reset(token, 'Whatever-Pass-1');
      expect([token.slice(0, 12), res.status]).toEqual([
        token.slice(0, 12),
        400,
      ]);
    }
    expect((await login(user.email, TEST_PASSWORD)).status).toBe(200);
  });

  it('PWR-007 new password shorter than 8 characters is rejected (400) and nothing changes', async () => {
    await forgot(org.users.VIEWER.email);
    await flush();
    const res = await reset(tokenFromLink(sent[0].link), 'short');
    expect(res.status).toBe(400);
    expect((await login(org.users.VIEWER.email, TEST_PASSWORD)).status).toBe(
      200,
    );
  });

  it('PWR-008 sessions from before the reset can no longer refresh; new sessions can', async () => {
    const user = org.users.DEVOPS_ENGINEER;
    const before = (await login(user.email, TEST_PASSWORD)).body;
    expect(
      (
        await request(t.app, 'POST', '/auth/refresh', {
          body: { refreshToken: before.refreshToken },
        })
      ).status,
    ).toBe(200);

    await forgot(user.email);
    await flush();
    await reset(tokenFromLink(sent[0].link), 'After-Reset-Pass-1');

    const oldRefresh = await request(t.app, 'POST', '/auth/refresh', {
      body: { refreshToken: before.refreshToken },
    });
    expect(oldRefresh.status).toBe(401);

    const after = (await login(user.email, 'After-Reset-Pass-1')).body;
    expect(
      (
        await request(t.app, 'POST', '/auth/refresh', {
          body: { refreshToken: after.refreshToken },
        })
      ).status,
    ).toBe(200);
  });

  it('PWR-009 at most one email per address per minute (but the answer stays the same)', async () => {
    const email = org.users.VIEWER.email;
    const a = await forgot(email);
    const b = await forgot(email);
    await flush();
    expect(a.body).toEqual(b.body);
    expect(sent).toHaveLength(1);
  });

  it('PWR-010 requests and completed resets are recorded as security events', async () => {
    const user = org.users.ADMIN;
    await forgot(user.email);
    await forgot('ghost@example.com');
    await flush();
    await reset(tokenFromLink(sent[0].link), 'Evented-Pass-1');

    const events = await t.prisma.event.findMany({
      where: { eventType: { startsWith: 'AUTH_PASSWORD_RESET' } },
      orderBy: { createdAt: 'asc' },
    });
    expect(events.map((e) => [e.eventType, e.organizationId])).toEqual([
      ['AUTH_PASSWORD_RESET_REQUESTED', org.org.id],
      ['AUTH_PASSWORD_RESET_REQUESTED', null],
      ['AUTH_PASSWORD_RESET_COMPLETED', org.org.id],
    ]);
  });

  it('PWR-011 the reset link never appears in the HTTP response', async () => {
    const res = await forgot(org.users.VIEWER.email);
    expect(JSON.stringify(res.body)).not.toMatch(/token|reset-password\?/);
  });
});
