import type { Pool } from 'pg';
import type { NewScore, ScoreEntry, ScoreRepository } from './types.js';

interface ScoreRow {
  id: number;
  name: string;
  score: number;
  correct: number;
  created_at: Date;
}

const COLUMNS = 'id, name, score, correct, created_at';

function toEntry(row: ScoreRow): ScoreEntry {
  return {
    id: row.id,
    name: row.name,
    score: row.score,
    correct: row.correct,
    createdAt: row.created_at.toISOString(),
  };
}

export class PostgresScoreRepository implements ScoreRepository {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async add({ name, score, correct }: NewScore): Promise<ScoreEntry> {
    const { rows } = await this.pool.query<ScoreRow>(
            `INSERT INTO scores (name, score, correct, country) VALUES ($1, $2, $3, 'SE') RETURNING ${COLUMNS}`,
      [name, score, correct],
    );
    return toEntry(rows[0]);
  }

  async top(limit: number): Promise<ScoreEntry[]> {
    const { rows } = await this.pool.query<ScoreRow>(
      `SELECT ${COLUMNS} FROM scores ORDER BY score DESC, created_at ASC, id ASC LIMIT $1`,
      [limit],
    );
    return rows.map(toEntry);
  }

  async rankOf(score: number): Promise<number> {
    const { rows } = await this.pool.query<{ higher: number }>(
      'SELECT count(*)::int AS higher FROM scores WHERE score > $1',
      [score],
    );
    return rows[0].higher + 1;
  }

  async ping(): Promise<void> {
    await this.pool.query('SELECT 1');
  }
}
