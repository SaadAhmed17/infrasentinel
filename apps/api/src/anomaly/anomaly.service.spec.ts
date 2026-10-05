import { Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnomalyService } from './anomaly.service';
import { knownDefect } from '../../test/helpers/known-defect';

// The rule engine awaits this client on every tick, so its failure behaviour
// decides whether an AI-service problem degrades one detection or all of them.
describe('AnomalyService (AI service client)', () => {
  let service: AnomalyService;
  let fetchSpy: jest.SpyInstance;
  const findServer = jest.fn();
  const savedSecret = process.env.AI_SERVICE_SHARED_SECRET;

  beforeEach(() => {
    findServer.mockReset();
    process.env.AI_SERVICE_SHARED_SECRET = 'test-shared-secret';
    service = new AnomalyService({
      server: { findFirst: findServer },
    } as unknown as PrismaService);
    fetchSpy = jest.spyOn(global, 'fetch');
    for (const level of ['error', 'warn', 'debug'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation(() => undefined);
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.AI_SERVICE_SHARED_SECRET = savedSecret;
  });

  const reply = (status: number, body: unknown) =>
    fetchSpy.mockResolvedValue(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json' },
      }),
    );

  it('returns the score when the AI service answers normally', async () => {
    reply(200, {
      serverId: 's1',
      reconstructionError: 0.1,
      threshold: 0.2,
      isAnomaly: false,
      windowSize: 20,
    });

    await expect(service.getAnomalyScore('s1')).resolves.toMatchObject({
      isAnomaly: false,
    });
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringMatching(/\/anomaly-score\/s1$/),
      expect.anything(),
    );
  });

  it('sends the shared secret so the AI service accepts the call', async () => {
    reply(200, { error: 'No trained model exists for server s1' });

    await service.getAnomalyScore('s1');

    const init = (fetchSpy.mock.calls as [string, RequestInit][])[0][1];
    expect(new Headers(init.headers).get('x-internal-secret')).toBe(
      'test-shared-secret',
    );
  });

  it('sends no secret header at all when none is configured', async () => {
    delete process.env.AI_SERVICE_SHARED_SECRET;
    reply(200, { error: 'No trained model exists for server s1' });

    await service.getAnomalyScore('s1');

    const init = (fetchSpy.mock.calls as [string, RequestInit][])[0][1];
    expect(new Headers(init.headers).has('x-internal-secret')).toBe(false);
  });

  it('returns null (never throws) when no model exists for the server', async () => {
    reply(200, { error: 'No trained model exists for server s1' });

    await expect(service.getAnomalyScore('s1')).resolves.toBeNull();
  });

  it('returns null when the AI service responds with an HTTP error', async () => {
    reply(500, { detail: 'boom' });

    await expect(service.getAnomalyScore('s1')).resolves.toBeNull();
  });

  it('returns null when the AI service is unreachable', async () => {
    fetchSpy.mockRejectedValue(new TypeError('fetch failed'));

    await expect(service.getAnomalyScore('s1')).resolves.toBeNull();
  });

  knownDefect(
    'DEF-26',
    'gives up within 5 seconds when the AI service hangs (the rule engine must not stall)',
    async () => {
      // A hanging AI service: like real fetch, the request only ends if aborted.
      fetchSpy.mockImplementation(
        (_url: string, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () =>
              reject(
                new DOMException('The operation timed out.', 'TimeoutError'),
              ),
            );
          }),
      );

      const outcome = await Promise.race([
        service.getAnomalyScore('s1').then(() => 'settled'),
        new Promise((resolve) =>
          setTimeout(() => resolve('still waiting'), 5500),
        ),
      ]);

      expect(outcome).toBe('settled');
    },
    10_000,
  );

  it('refuses to score a server outside the caller’s organization (404)', async () => {
    findServer.mockResolvedValue(null);

    await expect(
      service.getAnomalyScoreForOrganization('org-A', 'server-of-B'),
    ).rejects.toThrow(NotFoundException);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(findServer).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'server-of-B', organizationId: 'org-A' },
      }),
    );
  });
});
