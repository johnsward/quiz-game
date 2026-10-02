import type { NewScore } from './types.js';

// Must match the game rules in frontend/src/game/logic.ts.
export const QUESTIONS_PER_GAME = 10;
export const MIN_POINTS_PER_CORRECT = 100;
export const MAX_POINTS_PER_CORRECT = 200;

export const NAME_MAX_LENGTH = 24;
export const DEFAULT_LEADERBOARD_LIMIT = 10;
export const MAX_LEADERBOARD_LIMIT = 50;

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

/** Control and invisible formatting characters (zero-width spaces, bidi overrides, ...). */
const INVALID_NAME_CHARS = /[\p{Cc}\p{Cf}]/u;

export function parseNewScore(body: unknown): Result<NewScore> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return fail('Request body must be a JSON object.');
  }
  const { name, score, correct } = body as Record<string, unknown>;

  if (typeof name !== 'string') return fail('name must be a string.');
  const cleanName = name.trim().replace(/\s+/g, ' ');
  // Count code points, not UTF-16 units, to match Postgres char_length().
  const nameLength = [...cleanName].length;
  if (nameLength < 1 || nameLength > NAME_MAX_LENGTH) {
    return fail(`name must be 1–${NAME_MAX_LENGTH} characters.`);
  }
  if (INVALID_NAME_CHARS.test(cleanName)) return fail('name contains invalid characters.');

  if (typeof correct !== 'number' || !Number.isInteger(correct) || correct < 0 || correct > QUESTIONS_PER_GAME) {
    return fail(`correct must be an integer from 0 to ${QUESTIONS_PER_GAME}.`);
  }

  // Every correct answer is worth between 100 and 200 points, so the score must fall in that range.
  if (
    typeof score !== 'number' ||
    !Number.isInteger(score) ||
    score < correct * MIN_POINTS_PER_CORRECT ||
    score > correct * MAX_POINTS_PER_CORRECT
  ) {
    return fail('score is not possible for that number of correct answers.');
  }

  return { ok: true, value: { name: cleanName, score, correct } };
}

export function parseLimit(raw: unknown): Result<number> {
  if (raw === undefined) return { ok: true, value: DEFAULT_LEADERBOARD_LIMIT };
  const limit = typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : NaN;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LEADERBOARD_LIMIT) {
    return fail(`limit must be an integer from 1 to ${MAX_LEADERBOARD_LIMIT}.`);
  }
  return { ok: true, value: limit };
}
