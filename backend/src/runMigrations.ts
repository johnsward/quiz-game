import pg from 'pg';
import { loadConfig } from './config.js';
import { migrate } from './migrate.js';

const pool = new pg.Pool({ connectionString: loadConfig().databaseUrl });
try {
  const applied = await migrate(pool);
  console.log(applied.length ? `Done: ${applied.length} migration(s) applied.` : 'Database is up to date.');
} finally {
  await pool.end();
}
