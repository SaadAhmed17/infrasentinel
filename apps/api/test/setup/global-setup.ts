import { execFile } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

// Runs once before the whole integration run.
//
// - In CI, TEST_DATABASE_URL points at a disposable Postgres+pgvector service
//   container, so tests run against the same engine as production.
// - Locally (no Docker needed), we start PGlite — real PostgreSQL compiled to
//   WebAssembly — in this process and expose it over the normal Postgres wire
//   protocol, so Prisma connects to it exactly like any other database.
//
// Either way the schema comes from `prisma migrate deploy`, i.e. the project's
// real migration history, never a hand-written test schema.
export default async function globalSetup() {
  let databaseUrl = process.env.TEST_DATABASE_URL;

  if (!databaseUrl) {
    const db = await PGlite.create({ extensions: { vector } });
    const server = new PGLiteSocketServer({
      db,
      port: 0,
      host: '127.0.0.1',
      maxConnections: 20,
    });
    await server.start();
    const port = Number(server.getServerConn().split(':').pop());
    databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?sslmode=disable&connection_limit=1`;

    (globalThis as Record<string, unknown>).__PGLITE__ = { db, server };
  }

  // Safety net: integration tests TRUNCATE every table. Refuse to run against
  // anything that looks like a shared/cloud database.
  if (/neon\.tech|amazonaws|supabase|render\.com/i.test(databaseUrl)) {
    throw new Error(
      'Refusing to run destructive integration tests against a cloud database.',
    );
  }

  const prismaCli = path.join(
    path.dirname(require.resolve('prisma/package.json')),
    'build',
    'index.js',
  );
  // Must be async: PGlite serves connections from THIS process's event loop,
  // so a blocking (sync) child process call would deadlock the migration.
  await promisify(execFile)(
    process.execPath,
    [prismaCli, 'migrate', 'deploy'],
    {
      cwd: path.resolve(__dirname, '..', '..'),
      env: { ...process.env, DATABASE_URL: databaseUrl },
    },
  );

  // Worker processes are spawned after globalSetup and inherit this.
  process.env.DATABASE_URL = databaseUrl;
}
