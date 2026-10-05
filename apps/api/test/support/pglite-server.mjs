// Throwaway PostgreSQL (+ pgvector) for tests written in other languages, e.g.
// the Python AI-service suite. In-memory: everything is discarded on exit.
// Prints "READY <port>" once it accepts connections.
import { PGlite } from '@electric-sql/pglite';
import { vector } from '@electric-sql/pglite-pgvector';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';

const db = await PGlite.create({ extensions: { vector } });
const server = new PGLiteSocketServer({
  db,
  port: Number(process.env.PORT ?? 0),
  host: '127.0.0.1',
  maxConnections: 10,
});
await server.start();
console.log(`READY ${server.getServerConn().split(':').pop()}`);

const shutdown = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
