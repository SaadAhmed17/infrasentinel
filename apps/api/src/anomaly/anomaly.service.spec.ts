import { Logger } from '@nestjs/common';
import { knownDefect } from '../../test/helpers/known-defect';
import { AnomalyService } from './anomaly.service';

// The rule engine awaits this client on every tick, so its failure behaviour
// decides whether an AI-service problem degrades one detection or all of them.
describe('AnomalyService (AI service client)', () => {
  let service: AnomalyService;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    service = new AnomalyService();
    fetchSpy = jest.spyOn(global, 'fetch');
    for (const level of ['error', 'warn', 'debug'] as const) {
      jest.spyOn(Logger.prototype, level).mockImplementation(() => undefined);
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
    );
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
      fetchSpy.mockReturnValue(new Promise<Response>(() => undefined));

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
});
