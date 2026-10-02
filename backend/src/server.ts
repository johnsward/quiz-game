import pg from 'pg';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { migrate, waitForDatabase } from './migrate.js';
import { PostgresScoreRepository } from './postgresRepository.js';

const config = loadConfig();
const pool = new pg.Pool({ connectionString: config.databaseUrl });
// Idle connections can drop (e.g. the database restarts). Without a listener this would crash the
// process; the pool discards the broken client and opens a new one on the next query.
pool.on('error', (error) => {
  console.error('Idle database connection lost:', error.message);
});

await waitForDatabase(pool);
await migrate(pool);

const app = createApp(new PostgresScoreRepository(pool), { trustProxy: config.trustProxy });
const server = app.listen(config.port, () => {
  console.log(`API listening on http://localhost:${config.port}`);
});

function shutdown(signal: string) {
  console.log(`${signal} received, shutting down…`);
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
