export interface NewScore {
  name: string;
  score: number;
  correct: number;
}

export interface ScoreEntry extends NewScore {
  id: number;
  createdAt: string;
}

export interface ScoreRepository {
  add(score: NewScore): Promise<ScoreEntry>;
  /** Highest scores first; ties go to whoever got there first. */
  top(limit: number): Promise<ScoreEntry[]>;
  /** 1-based leaderboard position for a score (ties share a rank). */
  rankOf(score: number): Promise<number>;
  /** Throws if the underlying storage is unreachable. */
  ping(): Promise<void>;
}
