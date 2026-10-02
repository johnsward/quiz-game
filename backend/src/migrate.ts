import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Pool } from 'pg';

/** backend/migrations, from both src/ (tsx) and dist/ (compiled). */
const MIGRATIONS_DIR = fileURLToPath(new URL('../migrations/', import.meta.url));

/** Arbitrary constant so only one process runs migrations at a time. */
const MIGRATION_LOCK_ID = 7_310_442;

/**
 * Applies any `.sql` files in `migrations/` that haven't run yet, in filename order.
 * Each migration runs in its own transaction. Returns the names of the applied files.
 */
export async function migrate(pool: Pool, log: (message: string) => void = console.log): Promise<string[]> {
  const client = await pool.connect();
  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        name       TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    const { rows } = await client.query<{ name: string }>('SELECT name FROM schema_migrations');
    const applied = new Set(rows.map((row) => row.name));
    const files = (await readdir(MIGRATIONS_DIR)).filter((file) => file.endsWith('.sql')).sort();

    const ran: string[] = [];
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw new Error(`Migration ${file} failed`, { cause: error });
      }
      log(`Applied migration ${file}`);
      ran.push(file);
    }
    return ran;
  } finally {
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]).catch(() => {});
    client.release();
  }
}

/** Retries a trivial query until the database accepts connections. */
export async function waitForDatabase(pool: Pool, attempts = 10, delayMs = 1000): Promise<void> {
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (error) {
      if (attempt >= attempts) throw error;
      console.log(`Database not ready (attempt ${attempt}/${attempts}), retrying…`);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}
