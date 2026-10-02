import type { NewScore, ScoreEntry, ScoreRepository } from '../types.js';

/** A ScoreRepository kept in memory, for tests. */
export class InMemoryScoreRepository implements ScoreRepository {
  entries: ScoreEntry[] = [];
  healthy = true;
  private nextId = 1;
  private clock = Date.UTC(2026, 0, 1);

  async add(score: NewScore): Promise<ScoreEntry> {
    const entry: ScoreEntry = { ...score, id: this.nextId++, createdAt: new Date(this.clock++).toISOString() };
    this.entries.push(entry);
    return entry;
  }

  async top(limit: number): Promise<ScoreEntry[]> {
    return [...this.entries]
      .sort((a, b) => b.score - a.score || a.createdAt.localeCompare(b.createdAt))
      .slice(0, limit);
  }

  async rankOf(score: number): Promise<number> {
    return this.entries.filter((entry) => entry.score > score).length + 1;
  }

  async ping(): Promise<void> {
    if (!this.healthy) throw new Error('database down');
  }
}
