import { Logger } from '@nestjs/common';
import { RagService } from './rag.service';
import { knownDefect } from '../../test/helpers/known-defect';

describe('RagService (AI service client)', () => {
  let service: RagService;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;
  const savedSecret = process.env.AI_SERVICE_SHARED_SECRET;

  beforeEach(() => {
    process.env.AI_SERVICE_SHARED_SECRET = 'test-shared-secret';
    service = new RagService();
    fetchSpy = jest.spyOn(global, 'fetch');
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env.AI_SERVICE_SHARED_SECRET = savedSecret;
  });

  const sentBody = () =>
    JSON.parse(fetchSpy.mock.calls[0][1]?.body as string) as Record<
      string,
      unknown
    >;
  const sentHeaders = () => new Headers(fetchSpy.mock.calls[0][1]?.headers);

  it('forwards exactly the organization it was given with the question', async () => {
    fetchSpy.mockResolvedValue(Response.json({ answer: 'a', sources: [] }));

    await service.query('org-A', 'why is cpu high?');

    expect(sentBody()).toEqual({
      organizationId: 'org-A',
      question: 'why is cpu high?',
    });
  });

  it.each([
    ['query', (s: RagService) => s.query('org-A', 'q?')],
    ['reindex', (s: RagService) => s.reindex('org-A')],
  ])(
    '%s sends JSON and the shared secret',
    async (_, call: (s: RagService) => Promise<unknown>) => {
      fetchSpy.mockResolvedValue(
        Response.json({ answer: 'a', sources: [], indexed: 0 }),
      );

      await call(service);

      expect(sentHeaders().get('x-internal-secret')).toBe('test-shared-secret');
      expect(sentHeaders().get('content-type')).toBe('application/json');
    },
  );

  it('surfaces an AI-service failure as an error instead of an empty answer', async () => {
    fetchSpy.mockResolvedValue(new Response('down', { status: 503 }));

    await expect(service.query('org-A', 'q?')).rejects.toThrow(
      'Failed to process query',
    );
  });

  knownDefect(
    'DEF-27',
    'an unreachable AI service becomes a 503 with a clear message',
    async () => {
      fetchSpy.mockRejectedValue(new TypeError('fetch failed'));

      await expect(service.query('org-A', 'q?')).rejects.toMatchObject({
        status: 503,
        message: expect.stringContaining('temporarily unavailable') as unknown,
      });
    },
  );

  it('reindex is scoped to the given organization', async () => {
    fetchSpy.mockResolvedValue(Response.json({ indexed: 3 }));

    await expect(service.reindex('org-A')).resolves.toEqual({ indexed: 3 });
    expect(sentBody()).toEqual({ organizationId: 'org-A' });
  });
});
