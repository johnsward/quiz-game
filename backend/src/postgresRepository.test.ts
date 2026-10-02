import pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { migrate } from './migrate.js';
import { PostgresScoreRepository } from './postgresRepository.js';

// Runs against a real database only when TEST_DATABASE_URL is set. The tables in it get wiped.
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('PostgresScoreRepository (integration)', () => {
  let pool: pg.Pool;
  let repo: PostgresScoreRepository;

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: url });
    await migrate(pool, () => {});
    repo = new PostgresScoreRepository(pool);
  });

  beforeEach(async () => {
    await pool.query('TRUNCATE scores RESTART IDENTITY');
  });

  afterAll(async () => {
    await pool?.end();
  });

  it('is idempotent when migrating twice', async () => {
    expect(await migrate(pool, () => {})).toEqual([]);
  });

  it('stores scores and ranks them', async () => {
    const saved = await repo.add({ name: 'Ada', score: 450, correct: 4 });
    expect(saved).toMatchObject({ id: 1, name: 'Ada', score: 450, correct: 4 });
    expect(new Date(saved.createdAt).toISOString()).toBe(saved.createdAt);

    await repo.add({ name: 'Grace', score: 900, correct: 6 });
    await repo.add({ name: 'Linus', score: 450, correct: 4 });

    const top = await repo.top(10);
    expect(top.map((e) => e.name)).toEqual(['Grace', 'Ada', 'Linus']);
    expect(await repo.top(1)).toHaveLength(1);
    expect(await repo.rankOf(450)).toBe(2);
    expect(await repo.rankOf(1000)).toBe(1);
  });

  it('enforces name length in the database too', async () => {
    await expect(repo.add({ name: 'x'.repeat(25), score: 0, correct: 0 })).rejects.toThrow();
  });

  it('answers pings', async () => {
    await expect(repo.ping()).resolves.toBeUndefined();
  });
});
