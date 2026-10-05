import { createTestApp, request, TestApp } from './helpers/test-app';

// Smoke test: the full application boots on Fastify against a migrated database
// and answers HTTP requests. If this fails, every other integration result is void.
describe('Application smoke test (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.close();
  });

  it('GET / responds 200 with the service greeting', async () => {
    const res = await request(t.app, 'GET', '/');

    expect(res.status).toBe(200);
    expect(res.body).toBe('Hello World!');
  });

  it('the database schema is migrated (pgvector extension installed)', async () => {
    const rows = await t.prisma.$queryRaw<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname = 'vector'`;

    expect(rows).toHaveLength(1);
  });
});
