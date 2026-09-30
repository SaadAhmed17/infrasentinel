import { Logger } from '@nestjs/common';
import { RagService } from './rag.service';

describe('RagService (AI service client)', () => {
  let service: RagService;
  let fetchSpy: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    service = new RagService();
    fetchSpy = jest.spyOn(global, 'fetch');
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const sentBody = () =>
    JSON.parse(fetchSpy.mock.calls[0][1]?.body as string) as Record<
      string,
      unknown
    >;

  it('forwards exactly the organization it was given with the question', async () => {
    fetchSpy.mockResolvedValue(Response.json({ answer: 'a', sources: [] }));

    await service.query('org-A', 'why is cpu high?');

    expect(sentBody()).toEqual({
      organizationId: 'org-A',
      question: 'why is cpu high?',
    });
  });

  it('surfaces an AI-service failure as an error instead of an empty answer', async () => {
    fetchSpy.mockResolvedValue(new Response('down', { status: 503 }));

    await expect(service.query('org-A', 'q?')).rejects.toThrow(
      'Failed to process query',
    );
  });

  it('an unreachable AI service becomes a 503 with a clear message', async () => {
    fetchSpy.mockRejectedValue(new TypeError('fetch failed'));

    await expect(service.query('org-A', 'q?')).rejects.toMatchObject({
      status: 503,
      message: expect.stringContaining('temporarily unavailable') as unknown,
    });
  });

  it('reindex is scoped to the given organization', async () => {
    fetchSpy.mockResolvedValue(Response.json({ indexed: 3 }));

    await expect(service.reindex('org-A')).resolves.toEqual({ indexed: 3 });
    expect(sentBody()).toEqual({ organizationId: 'org-A' });
  });

  it('auto-indexing never throws, so incident creation cannot be blocked by the AI service', async () => {
    fetchSpy.mockRejectedValue(new TypeError('fetch failed'));

    await expect(
      service.indexIncident('inc-1', 'org-A'),
    ).resolves.toBeUndefined();
  });
});
