// Forgot password when e-mail cannot be sent: the user is told, and a wrong SMTP login is reported.
import * as net from 'net';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { MailService } from '../mail/mail.service';

const USER = {
  id: 'u1',
  email: 'member@example.com',
  passwordHash: '$2b$10$abcdefghijklmnopqrstuv',
  role: 'VIEWER',
  organizationId: 'org-1',
};

describe('Forgot password: email delivery problems are not silent', () => {
  const savedEnv = { ...process.env };
  let prisma: { user: { findUnique: jest.Mock } };
  let mail: MailService;
  let service: AuthService;
  let warn: jest.SpyInstance;
  let error: jest.SpyInstance;

  beforeEach(() => {
    process.env.JWT_ACCESS_SECRET = 'test-access';
    process.env.JWT_REFRESH_SECRET = 'test-refresh';
    for (const k of [
      'SMTP_HOST',
      'SMTP_PORT',
      'SMTP_USER',
      'SMTP_PASS',
      'NODE_ENV',
    ])
      delete process.env[k];
    warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    error = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    prisma = { user: { findUnique: jest.fn() } };
    mail = new MailService();
    service = new AuthService(
      prisma as never,
      new JwtService({}),
      { record: jest.fn() } as never,
      mail,
    );
  });

  afterEach(() => {
    process.env = { ...savedEnv };
    jest.restoreAllMocks();
  });

  it('without SMTP the user is told no email was sent (503), identically for known and unknown emails', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(USER);
    const known = await service
      .forgotPassword({ email: USER.email }, '1.2.3.4')
      .catch((e: unknown) => e);
    prisma.user.findUnique.mockResolvedValueOnce(null);
    const unknown = await service
      .forgotPassword({ email: 'ghost@example.com' }, '1.2.3.4')
      .catch((e: unknown) => e);

    expect(known).toBeInstanceOf(ServiceUnavailableException);
    expect(unknown).toBeInstanceOf(ServiceUnavailableException);
    expect((known as Error).message).toBe((unknown as Error).message);
    expect((known as Error).message).toMatch(/not set up|not available/i);
  });

  it('in development the link for an existing account is still printed in the API terminal', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(USER);
    await service
      .forgotPassword({ email: USER.email }, '1.2.3.4')
      .catch(() => undefined);
    await new Promise((r) => setTimeout(r, 10));
    expect(warn.mock.calls.flat().join(' ')).toMatch(/reset-password\?token=/);
  });

  it('in production no link is printed', async () => {
    process.env.NODE_ENV = 'production';
    prisma.user.findUnique.mockResolvedValueOnce(USER);
    const res = await service
      .forgotPassword({ email: USER.email }, '1.2.3.4')
      .catch((e: unknown) => e);
    await new Promise((r) => setTimeout(r, 10));
    expect(res).toBeInstanceOf(ServiceUnavailableException);
    expect(
      (warn.mock.calls as unknown[][])
        .concat(error.mock.calls as unknown[][])
        .flat()
        .join(' '),
    ).not.toMatch(/token=/);
  });

  it('with SMTP configured the answer is the normal 200 message and the email is sent', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    const send = jest
      .spyOn(mail, 'sendPasswordResetEmail')
      .mockResolvedValue(undefined);
    prisma.user.findUnique.mockResolvedValueOnce(USER);
    const res = await service.forgotPassword({ email: USER.email }, '1.2.3.4');
    expect(res.message).toMatch(/If an account exists/);
    expect(send).toHaveBeenCalledWith(
      USER.email,
      expect.stringMatching(/reset-password\?token=/),
      30,
    );
  });

  describe('SMTP check at startup', () => {
    let server: net.Server;
    let port: number;

    beforeEach(async () => {
      // A mail server that rejects the login, like Gmail with a normal (non app) password.
      server = net.createServer((sock) => {
        sock.write('220 fake ESMTP\r\n');
        sock.on('data', (d) => {
          const cmd = d.toString().slice(0, 4).toUpperCase();
          if (cmd === 'EHLO')
            sock.write('250-fake\r\n250 AUTH PLAIN LOGIN\r\n');
          else if (cmd === 'AUTH')
            sock.write('535 5.7.8 Username and Password not accepted\r\n');
          else if (cmd === 'QUIT') sock.end('221 bye\r\n');
          else sock.write('250 OK\r\n');
        });
        sock.on('error', () => undefined);
      });
      await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
      port = (server.address() as net.AddressInfo).port;
    });

    afterEach(() => new Promise<void>((r) => server.close(() => r())));

    it('reports a rejected SMTP login clearly', async () => {
      process.env.SMTP_HOST = '127.0.0.1';
      process.env.SMTP_PORT = String(port);
      process.env.SMTP_USER = 'team@example.com';
      process.env.SMTP_PASS = 'wrong';
      await expect(mail.verifyConnection()).resolves.toBe(false);
      expect(error.mock.calls.flat().join(' ')).toMatch(
        /SMTP check failed.*Username and Password not accepted.*app password/s,
      );
    });

    it('reports that SMTP is not configured', async () => {
      await expect(mail.verifyConnection()).resolves.toBe(false);
      expect(warn.mock.calls.flat().join(' ')).toMatch(
        /SMTP is not configured/,
      );
    });
  });
});
