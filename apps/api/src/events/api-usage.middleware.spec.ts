import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventsService } from './events.service';
import { ApiUsageMiddleware } from './api-usage.middleware';

// NOTE for the test strategy: these unit tests PASS — the exclusion logic is
// correct when handed a correct URL. The integration suite (LOG-002/003) shows
// that on the real Fastify platform the middleware receives "/" as the URL, so
// the exclusions never apply (DEF-34). Unit tests alone could not find that.
describe('ApiUsageMiddleware (unit)', () => {
  const jwt = new JwtService({});
  let record: jest.Mock;
  let middleware: ApiUsageMiddleware;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    record = jest.fn().mockResolvedValue(undefined);
    middleware = new ApiUsageMiddleware(
      { record } as unknown as EventsService,
      jwt,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const run = async (url: string, method = 'GET', authorization?: string) => {
    const next = jest.fn();
    middleware.use(
      { method, url, ip: '198.51.100.20', headers: { authorization } },
      {},
      next,
    );
    await new Promise((resolve) => setImmediate(resolve));
    expect(next).toHaveBeenCalledTimes(1); // never blocks the real request
  };

  it.each([
    '/servers',
    '/servers/abc/metrics?limit=50',
    '/servers/abc/anomaly-score',
    '/incidents',
  ])('does not log dashboard polling route %s', async (url) => {
    await run(url);

    expect(record).not.toHaveBeenCalled();
  });

  it('does not log CORS preflight requests', async () => {
    await run('/rules', 'OPTIONS');

    expect(record).not.toHaveBeenCalled();
  });

  it('logs other calls with method, path (query stripped) and client IP', async () => {
    await run('/rules?x=1', 'POST');

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'API_REQUEST',
        metadata: {
          method: 'POST',
          path: '/rules',
          ipAddress: '198.51.100.20',
        },
        organizationId: undefined,
      }),
    );
  });

  it('attributes the call to the organization in a valid access token', async () => {
    const token = jwt.sign(
      { organizationId: 'org-A' },
      { secret: process.env.JWT_ACCESS_SECRET },
    );

    await run('/rules', 'GET', `Bearer ${token}`);

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: 'org-A' }),
    );
  });

  it('does not trust the organization in a forged token', async () => {
    const forged = jwt.sign(
      { organizationId: 'org-A' },
      { secret: 'attacker' },
    );

    await run('/rules', 'GET', `Bearer ${forged}`);

    expect(record).toHaveBeenCalledWith(
      expect.objectContaining({ organizationId: undefined }),
    );
  });

  it('a logging failure never breaks the request', async () => {
    record.mockRejectedValue(new Error('db down'));

    await expect(run('/rules')).resolves.toBeUndefined();
  });
});
